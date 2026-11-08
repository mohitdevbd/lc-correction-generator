import * as pdfjsLib from 'pdfjs-dist';
import type { LcAuditResult, LcAuditIssue, UserSettings, ChargeBreakdown, ChargePayerItem } from '../types';

// Set up pdf.js worker using web worker URL
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  // Fallback for non-standard environments
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

/**
 * Extracts plain text from an uploaded PDF file in the browser using pdfjs-dist.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by their vertical position (y coordinate) to preserve lines
    const items = textContent.items as Array<any>;
    if (!items || items.length === 0) continue;

    // Sort items top-to-bottom, left-to-right
    const sorted = [...items].sort((a, b) => {
      const yDiff = (b.transform?.[5] || 0) - (a.transform?.[5] || 0);
      if (Math.abs(yDiff) > 4) return yDiff;
      return (a.transform?.[4] || 0) - (b.transform?.[4] || 0);
    });

    const lines: string[] = [];
    let currentY = sorted[0]?.transform?.[5];
    let currentLine: string[] = [];

    for (const item of sorted) {
      const y = item.transform?.[5] || 0;
      if (Math.abs(y - currentY) > 4) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(' '));
        }
        currentLine = [];
        currentY = y;
      }
      if (item.str && item.str.trim()) {
        currentLine.push(item.str.trim());
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    pageTexts.push(lines.join('\n'));
  }

  return pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
}

interface SlabTier {
  fee: number;
  min: number;
  max: number;
  rawText: string;
}

// Parses multi-bracket slabs (e.g. Roman numerals I, II, III or numbered slabs 1, 2, 3)
function parseAllSlabTiers(clauseText: string): SlabTier[] {
  const tiers: SlabTier[] = [];
  
  const parts = clauseText
    .split(/(?=(?:[IVXLCDM]+\)|\b[0-9]{1,2}[\).]))/i)
    .map(p => p.trim())
    .filter(p => p.length > 5);

  for (const part of parts) {
    const norm = part.replace(/\s+/g, ' ');

    const feeMatch = norm.match(/(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)\s*(?:USD|EUR|GBP)?\s*(?:SHALL\s+BE\s+DEDUCTED|AS\s+(?:DISCREPANCY|PAYMENT|SETTLEMENT)|\(FOR\s+DOCUMENT\s+VALUE|\bFOR\s+BILL\s+VALUE|\bFOR\s+VALUE|\bFOR\s+DOCUMENTS?|\bFOR\s+INVOICE|\bAT\b)/i) ||
                     norm.match(/(?:(?:USD|EUR|GBP)\s*(\d+(?:\.\d{2})?))/i);
    if (!feeMatch) continue;

    const fee = parseFloat(feeMatch[1]);
    if (isNaN(fee) || fee <= 0 || fee > 500) continue;

    const parseNum = (str: string) => {
      const clean = str.replace(/,/g, '').trim();
      return parseFloat(clean);
    };

    let min = 0;
    let max = Infinity;
    let matchedRange = false;

    // Case 1: "USD 10,001 TO USD 50,000" or "USD 20,001 TO USD 50,000" or "10,001 - 50,000"
    const rangeMatch = norm.match(/(?:USD|EUR|GBP)?\s*([\d,]+(?:\.\d{2})?)\s*(?:TO|-|UNTIL)\s*(?:USD|EUR|GBP)?\s*([\d,]+(?:\.\d{2})?)/i);
    if (rangeMatch && !norm.match(/UP\s*TO/i)) {
      min = parseNum(rangeMatch[1]);
      max = parseNum(rangeMatch[2]);
      matchedRange = true;
    }

    // Case 2: "UPTO USD 10,000" or "UP TO USD 20,000" or "LESS THAN USD 15,000" or "BELOW USD 10,000"
    if (!matchedRange) {
      const upToMatch = norm.match(/(?:UP\s*TO|UPTO|LESS\s+THAN|BELOW|MAXIMUM)\s*(?:USD|EUR|GBP)?\s*([\d,]+(?:\.\d{2})?)/i);
      if (upToMatch) {
        min = 0;
        max = parseNum(upToMatch[1]);
        matchedRange = true;
      }
    }

    // Case 3: "USD 50,001 AND ABOVE" or "USD 100001 TO ABOVE" or "ABOVE USD 50,000" or "EXCEEDING USD 50,000"
    if (!matchedRange) {
      const aboveMatch1 = norm.match(/(?:USD|EUR|GBP)?\s*([\d,]+(?:\.\d{2})?)\s*(?:AND\s+ABOVE|TO\s+ABOVE|\bABOVE\b)/i);
      const aboveMatch2 = norm.match(/(?:ABOVE|EXCEEDING|OVER|GREATER\s+THAN)\s*(?:USD|EUR|GBP)?\s*([\d,]+(?:\.\d{2})?)/i);
      if (aboveMatch1) {
        min = parseNum(aboveMatch1[1]);
        max = Infinity;
        matchedRange = true;
      } else if (aboveMatch2) {
        min = parseNum(aboveMatch2[1]) + 0.01;
        max = Infinity;
        matchedRange = true;
      }
    }

    if (matchedRange && !isNaN(min) && !isNaN(max)) {
      tiers.push({ fee, min, max, rawText: norm });
    }
  }

  return tiers;
}

function evaluateSlabFee(tiers: SlabTier[], lcAmount: number): number | null {
  if (tiers.length === 0) return null;
  if (lcAmount <= 0) return tiers[0].fee;

  for (const tier of tiers) {
    if (lcAmount >= tier.min && lcAmount <= tier.max) {
      return tier.fee;
    }
  }

  const highestTier = [...tiers].sort((a, b) => b.min - a.min)[0];
  if (lcAmount >= highestTier.min) return highestTier.fee;

  return tiers[0].fee;
}

// Helper to parse tiered / slab fee clauses (e.g. Southeast Bank, UCBL, Bank Asia, Eastern Bank)
function parseTieredFee(clauseText: string, lcAmount: number): { lowerFee: number; higherFee: number; threshold: number; applicableFee: number } | null {
  const tiers = parseAllSlabTiers(clauseText);
  if (tiers.length >= 2) {
    const fee = evaluateSlabFee(tiers, lcAmount);
    if (fee !== null) {
      return {
        lowerFee: tiers[0].fee,
        higherFee: tiers[tiers.length - 1].fee,
        threshold: tiers[0].max,
        applicableFee: fee
      };
    }
  }

  const norm = clauseText.replace(/\s+/g, ' ');

  // Pattern A (e.g. UCBL):
  // "AT USD 25.00 AND USD 50.00 FOR BILL VALUE UPTO USD 5000.00 AND ABOVE USD 5000.00 RESPECTIVELY"
  const patternA = /(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)\s*(?:AND|\/)\s*(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)[^.]*?(?:UP\s*TO|LESS\s+THAN)[^.]*?(?:USD|EUR|GBP)?\s*([\d,]+(?:\.\d{2})?)/i;
  const matchA = norm.match(patternA);
  if (matchA) {
    const lowerFee = parseFloat(matchA[1]);
    const higherFee = parseFloat(matchA[2]);
    const threshold = parseFloat(matchA[3].replace(/,/g, ''));
    const applicableFee = (lcAmount > threshold && lcAmount > 0) ? higherFee : lowerFee;
    return { lowerFee, higherFee, threshold, applicableFee };
  }

  // Pattern B (e.g. Shahjalal: "USD 50.00 ... ABOVE USD 5000.00 OR USD 25.00 ... UPTO USD 5000.00"):
  const patternB = /(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)[^.]*?(?:ABOVE|EXCEEDING)[^.]*?(?:USD|EUR|GBP)?\s*([\d,]+(?:\.\d{2})?)[^.]*?(?:OR|AND|\/)[^.]*?(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)[^.]*?(?:UP\s*TO|LESS\s+THAN)/i;
  const matchB = norm.match(patternB);
  if (matchB) {
    const higherFee = parseFloat(matchB[1]);
    const threshold = parseFloat(matchB[2].replace(/,/g, ''));
    const lowerFee = parseFloat(matchB[3]);
    const applicableFee = (lcAmount > threshold && lcAmount > 0) ? higherFee : lowerFee;
    return { lowerFee, higherFee, threshold, applicableFee };
  }

  // Pattern C (e.g. Bank Asia, EBL):
  // "USD 30.00 (LESS THAN DOCUMENT VALUE USD15,000) AND USD 50.00(DOCUMENT VALUE USD15,000 AND ABOVE)"
  // or "USD 25.00 UP TO 20,000 AND USD 50.00 FOR ABOVE 20,000"
  const patternC = /(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)[^.]*?(?:UP\s*TO|LESS\s+THAN)[^.]*?(?:USD|EUR|GBP)?\s*([\d,]+(?:\.\d{2})?)[^.]*?(?:AND|\/)\s*(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)/i;
  const matchC = norm.match(patternC);
  if (matchC) {
    const lowerFee = parseFloat(matchC[1]);
    const threshold = parseFloat(matchC[2].replace(/,/g, ''));
    const higherFee = parseFloat(matchC[3]);
    const applicableFee = (lcAmount >= threshold && lcAmount > 0) ? higherFee : lowerFee;
    return { lowerFee, higherFee, threshold, applicableFee };
  }

  return null;
}

function extractClauseNumber(snippet?: string, parentText?: string): string | null {
  if (!snippet) return null;
  const trimmed = snippet.trim();

  // First check if snippet itself starts with e.g. 05. or 05(B)
  const mParentAndSub = trimmed.match(/^(?:Clause\s*)?([0-9]{1,2})\s*[\.\)]\s*(?:[A-Z\s]{0,20}:?\s*)?\(?([A-Z])[\.\)]?/i);
  if (mParentAndSub) {
    const p = mParentAndSub[1].padStart(2, '0');
    const sub = mParentAndSub[2];
    return `Clause ${p}(${sub})`;
  }

  // Check subclause (A), (B), (C) or sub-letter
  const mSub = trimmed.match(/^(?:Clause\s*)?\(?([A-Z])[\.\)]/i) ||
               trimmed.match(/(?:^|\n|\b|\()(?:Clause\s*)?([A-Z])[\.\)]/i);
  if (mSub) {
    const sub = mSub[1];
    if (parentText) {
      const idx = parentText.indexOf(trimmed.substring(0, Math.min(30, trimmed.length)));
      if (idx !== -1) {
        const lookBack = parentText.substring(Math.max(0, idx - 1200), idx);
        const parentMatches = [...lookBack.matchAll(/(?:^|\n|\.\s+)([0-9]{1,2})\s*\.\s*(?:[A-Z]{3,}|CHARGES)/gi)];
        if (parentMatches.length > 0) {
          const lastNum = parentMatches[parentMatches.length - 1][1];
          return `Clause ${lastNum.padStart(2, '0')}(${sub})`;
        }
      }
    }
    return `Clause ${sub}`;
  }

  // Check numbered clause 03., 14), etc.
  const mNum = trimmed.match(/^(?:Clause\s*)?\(?([0-9]{1,2})[\.\)]/i) ||
               trimmed.match(/(?:^|\n|\b|\()(?:Clause\s*)?([0-9]{1,2})[\.\)]\s*[A-Z]/i);
  if (mNum) {
    return `Clause ${mNum[1].padStart(2, '0')}`;
  }

  return null;
}

function resolveClauseLocation(defaultField: string, snippet?: string, parentText?: string): string {
  const num = extractClauseNumber(snippet, parentText);
  if (num) {
    return `${defaultField}, ${num}`;
  }
  return defaultField;
}

/**
 * Parses SWIFT MT700 / LC fields and checks standard commercial audit rules.
 */
export function auditLcText(text: string, settings?: UserSettings): LcAuditResult {
  const normalizedText = text.replace(/\r\n/g, '\n');
  const upper = normalizedText.toUpperCase();

  // 1. Extract Core Metadata
  const detectedLcNumber = extractLcNumber(normalizedText);
  
  // Issue date (Tag 31C or F31C)
  const detectedIssueDate = extractDate(
    normalizedText,
    /(?::31C:|F31C:[^\n]*Date[^\n]*Issue|ISSUE\s*DATE|DATE\s*OF\s*ISSUE)[^\n:]*[:#]?\s*([0-9A-Za-z\/\-\. ]{6,40})/i
  );

  // Expiry date (Tag 31D or F31D)
  const detectedExpiryDate = extractDate(
    normalizedText,
    /(?::31D:|F31D:[^\n]*Date[^\n]*Expiry|EXPIRY\s*DATE|DATE\s*OF\s*EXPIRY)[^\n:]*[:#]?\s*(?:Place:[^\n]*\n)?(?:Date:)?\s*([0-9A-Za-z\/\-\. ]{6,40})/i
  );

  // Latest Shipment date (Tag 44C or F44C)
  const detectedShipmentDate = extractDate(
    normalizedText,
    /(?::44C:|F44C:[^\n]*Latest\s*Date\s*of\s*Shipment|F44C:[^\n]*Shipment|LATEST\s*DATE\s*OF\s*SHIPMENT|LATEST\s*SHIPMENT|SHIPMENT\s*DATE)[^\n:]*[:#]?\s*([0-9A-Za-z\/\-\. ]{6,40})/i
  );
  
  // Extract currency and amount
  const { currency: detectedCurrency, amount: detectedAmount } = extractAmount(normalizedText);

  // Extract Beneficiary and Applicant (bounded before next SWIFT field tag)
  const detectedBeneficiary = extractParty(
    normalizedText,
    /(?::59[A-Z]?:|F59[A-Z]?:[^\n]*Beneficiary|\bBENEFICIARY\s*(?:NAME\s*(?:AND\s*ADDRESS)?)?\s*:)[^\n:]*[:#]?\s*\n?([\s\S]{1,500}?)(?=(?:\n\s*:[0-9]{2}|\n\s*F[0-9]{2}|$))/i
  );
  const detectedApplicant = extractParty(
    normalizedText,
    /(?::50[A-Z]?:|F50[A-Z]?:[^\n]*Applicant|\bAPPLICANT\s*(?:NAME\s*(?:AND\s*ADDRESS)?)?\s*:)[^\n:]*[:#]?\s*\n?([\s\S]{1,500}?)(?=(?:\n\s*:[0-9]{2}|\n\s*F[0-9]{2}|$))/i
  );

  const issues: LcAuditIssue[] = [];

  // ==========================================
  // ==========================================
  // RULE 1: Field 71D (Banking Charges)
  // ==========================================
  // Evaluates Field 71D:
  // 1. Allowed fee types (Payment, Settlement, Reimbursement, RTGS, Fund Transfer, Discrepancy, Handling Charge)
  //    are audited under Discrepancy & Payment/Settlement rules (Rule 2).
  // 2. Clauses like "ALL BANK CHARGES OUTSIDE BANGLADESH / OUTSIDE OUR COUNTER ARE ON BENEFICIARY'S ACCOUNT"
  //    are ACCEPTABLE and NOT flagged.
  // 3. Flags IF AND ONLY IF:
  //    a) Issuing bank places charges inside their country / inside counter on Beneficiary.
  //    b) Unauthorized fees (e.g. Confirmation, Advising, Amendment, Courier) are placed on Beneficiary.
  const chargesMatch = normalizedText.match(/(?::71D:|:71B:|(?:\b|\n|\s+)F71D:[^\n]*Charges|(?:\b|\n|\s+)F71D\s*:\s*(?:CHARGES)?|(?:\b|\n)\s*71D\s*:\s*(?:CHARGES)?)[ \t]*(?:Charges[ \t]*)?[:#]?\s*([\s\S]{1,400}?)(?=(?:\n:[0-9]{2}|\s+:[0-9]{2}:|(?:\n|\s+)F[0-9]{2}|\n\s*[0-9]{2}[A-Z]?\s*:|\s+[0-9]{2}[A-Z]?\s*:|$))/i);
  const chargesBlock = chargesMatch ? chargesMatch[1].toUpperCase().replace(/\s+/g, ' ') : '';

  if (chargesBlock) {
    const hasBeneficiaryCharge =
      chargesBlock.includes('FOR ACCOUNT OF BENEFICIARY') ||
      chargesBlock.includes("FOR BENEFICIARY'S ACCOUNT") ||
      chargesBlock.includes('FOR BENEFICIARY ACCOUNT') ||
      chargesBlock.includes('ON ACCOUNT OF BENEFICIARY') ||
      chargesBlock.includes("ON BENEFICIARY'S ACCOUNT") ||
      chargesBlock.includes('ON BENEFICIARY ACCOUNT') ||
      chargesBlock.includes('ARE ON BENEFICIARY') ||
      chargesBlock.includes('BE ON BENEFICIARY') ||
      chargesBlock.includes('WILL BE ON BENEFICIARY') ||
      chargesBlock.includes('BORNE BY BENEFICIARY');

    if (hasBeneficiaryCharge) {
      const hasOutsideQualifier =
        chargesBlock.includes('OUTSIDE ISSUING') ||
        chargesBlock.includes('OUTSIDE THE ISSUING') ||
        chargesBlock.includes('OUTSIDE ISSUING BANK') ||
        chargesBlock.includes("OUTSIDE ISSUING BANK'S") ||
        chargesBlock.includes('OUT SIDE ISSUING BANK') ||
        chargesBlock.includes("OUT SIDE ISSUING BANK'S") ||
        chargesBlock.includes('OUTSIDE OUR COUNTER') ||
        chargesBlock.includes('OUT SIDE OUR COUNTER') ||
        chargesBlock.includes('OUTSIDE OF OUR COUNTER') ||
        chargesBlock.includes('OUTSIDE BANGLADESH') ||
        chargesBlock.includes('OUT SIDE BANGLADESH');

      const hasInsideOrIssuingCharges =
        chargesBlock.includes('INSIDE BANGLADESH') ||
        chargesBlock.includes('IN BANGLADESH') ||
        chargesBlock.includes('WITHIN BANGLADESH') ||
        chargesBlock.includes('AT OUR COUNTER') ||
        chargesBlock.includes('INSIDE OUR COUNTER') ||
        chargesBlock.includes('ISSUING BANK CHARGES') ||
        chargesBlock.includes('OUR CHARGES') ||
        ((chargesBlock.includes('ALL CHARGES') || chargesBlock.includes('ALL BANK CHARGES') || chargesBlock.includes('ALL BANKING CHARGES')) && !hasOutsideQualifier);

      // Check for unauthorized extra fees placed on beneficiary in 71D:
      const hasConfirmationOnBene = chargesBlock.includes('CONFIRMATION');
      const hasAdvisingOnBene = chargesBlock.includes('ADVISING');
      const hasAmendmentOnBene = chargesBlock.includes('AMENDMENT');
      const hasCourierOnBene = chargesBlock.includes('COURIER') || chargesBlock.includes('POSTAGE');

      const hasOutsideBangladeshOnBene =
        (chargesBlock.includes('OUTSIDE BANGLADESH') ||
         chargesBlock.includes('OUT SIDE BANGLADESH') ||
         chargesBlock.includes('OUT-SIDE BANGLADESH') ||
         chargesBlock.includes('OUTSIDE BD')) &&
        hasBeneficiaryCharge;

      if (hasInsideOrIssuingCharges) {
        const snippet = extractSnippet(normalizedText, /(?:ALL (?:BANK )?CHARGES|ISSUING BANK CHARGES|OUR CHARGES|INSIDE BANGLADESH)[\s\S]{0,120}BENEFICIARY/i) || (chargesMatch ? chargesMatch[1].trim() : '');
        issues.push({
          id: 'issue_clause_71d_issuing_charges',
          correctionId: 'clause_71d_bank_charges',
          title: 'Clause 71D – Issuing Bank / Local Charges on Beneficiary',
          clauseLocation: 'Field 71D',
          severity: 'critical',
          reason: 'Field 71D places issuing bank charges or charges inside issuing counter / Bangladesh on the Beneficiary. As per standard practice, all issuing bank / local counter charges must be for Applicant\'s account.',
          detectedText: snippet
        });
      } else if (hasOutsideBangladeshOnBene) {
        const snippet = extractSnippet(normalizedText, /(?:OUT\s*SIDE\s*(?:BANGLADESH|BD)|ALL (?:BANK )?CHARGES)[\s\S]{0,120}BENEFICIARY/i) || (chargesMatch ? chargesMatch[1].trim() : '');
        issues.push({
          id: 'issue_clause_71d_outside_bangladesh',
          correctionId: 'clause_71d_bank_charges',
          title: 'Clause 71D – Bank Charges Outside Bangladesh on Beneficiary',
          clauseLocation: 'Field 71D',
          severity: 'warning',
          reason: 'Field 71D places all banking charges outside Bangladesh on the Beneficiary. As per agreed commercial terms, all banking charges outside Bangladesh must be for Applicant\'s account.',
          detectedText: snippet
        });
      } else if (hasConfirmationOnBene || hasAdvisingOnBene || hasAmendmentOnBene || hasCourierOnBene) {
        const extraFeeTypes = [
          hasConfirmationOnBene ? 'Confirmation charges' : '',
          hasAdvisingOnBene ? 'Advising charges' : '',
          hasAmendmentOnBene ? 'Amendment charges' : '',
          hasCourierOnBene ? 'Courier/Postage charges' : ''
        ].filter(Boolean).join(', ');

        const snippet = extractSnippet(normalizedText, /(?:CONFIRMATION|ADVISING|AMENDMENT|COURIER)[\s\S]{0,120}BENEFICIARY/i) || (chargesMatch ? chargesMatch[1].trim() : '');
        issues.push({
          id: 'issue_clause_71d_unauthorized_fees',
          correctionId: 'clause_71d_bank_charges',
          title: `Clause 71D – Unauthorized Charges on Beneficiary (${extraFeeTypes})`,
          clauseLocation: 'Field 71D',
          severity: 'warning',
          reason: `Field 71D places unauthorized extra charges (${extraFeeTypes}) on the Beneficiary. Beneficiary should only bear standard discrepancy & payment processing charges within limits. All other bank charges must be for Applicant's account.`,
          detectedText: snippet
        });
      }
    }
  }

  // ==========================================
  // RULE 2: Discrepancy Fee & Payment/Settlement/Reimbursement/RTGS/Cable Charges Audit
  // ==========================================
  // Exclude Field 71D so Tag 71D banking charges are audited completely separately from Tag 47A / conditions
  const textWithout71D = normalizedText.replace(
    /(?::71D:|:71B:|(?:\b|\n|\s+)F71D:[^\n]*Charges|(?:\b|\n|\s+)F71D\s*:\s*(?:CHARGES)?|(?:\b|\n)\s*71D\s*:\s*(?:CHARGES)?)[ \t]*(?:Charges[ \t]*)?[:#]?[\s\S]*?(?=(?:\n:[0-9]{2}|\s+:[0-9]{2}:|(?:\n|\s+)F[0-9]{2}|\n\s*[0-9]{2}[A-Z]?\s*:|\s+[0-9]{2}[A-Z]?\s*:|$))/i,
    ''
  );
  const numericLcAmount = detectedAmount ? parseFloat(detectedAmount.replace(/,/g, '')) : 0;

  // 1. DISCREPANCY FEE AUDIT:
  let discAmt = 0;
  let hasDiscrepancyMention = false;
  let isDiscOnApplicant = false;
  let discSnippet = '';

  // Top-level condition boundary: stops before next numbered (e.g. 1. or 4) or 10.) or lettered (e.g. A. or G.) condition, or bullet (+), or SWIFT tag (:XX:, FXX:, 71D:, 78:), or ALL CHARGES
  const conditionBoundary = '(?=(?:(?:\\n|\\.|;|:)\\s*(?:\\([A-Z0-9]{1,2}\\)|[0-9]{1,2}[\\.\\)]|\\b[A-Z][\\.\\)]|\\+)\\s*[A-Z]|\\n\\s*:[0-9]{2}[A-Z]?:|\\s+:[0-9]{2}[A-Z]?:|\\n\\s*F[0-9]{2}[A-Z]?:|\\n\\s*[0-9]{2}[A-Z]?\\s*:|\\s+[0-9]{2}[A-Z]?\\s*:|\\bALL\\s+(?:BANKING|BANK)?\\s*CHARGES|$))';
  const clausePrefix = '(?:(?:\\([A-Z0-9]{1,2}\\)|[0-9]{1,2}[\\.\\)]|[A-Z][\\.\\)])\\s*)?';

  const discRegex = new RegExp(
    `(?:` +
      `${clausePrefix}\\s*(?:A\\s+)?(?:FEE|CHARGE|COST|COMMISSION|EXPENSE|AN?\\s+AMOUNT)\\s+(?:OF\\s+)?(?:USD|EUR|GBP)?\\s*\\d+[\\s\\S]*?DISCREPA[A-Z]*[\\s\\S]*?${conditionBoundary}` +
      `|${clausePrefix}\\s*(?:(?:A\\s+)?(?:IN\\s+CASE\\s+OF\\s+)?DISCREPA[A-Z]*\\s*(?:FEE|CHARGE|COMMISSION|COST|DOCUMENTS?)?)[\\s\\S]*?${conditionBoundary}` +
      `|${clausePrefix}\\s*(?:(?:WE\\s+)?(?:WILL|SHALL)\\s+(?:BE\\s+)?DEDUCT(?:ED)?)[\\s\\S]*?DISCREPA[A-Z]*[\\s\\S]*?${conditionBoundary}` +
    `)`,
    'i'
  );
  const discMatch = textWithout71D.match(discRegex);
  let cleanDiscSnippet = '';

  if (discMatch) {
    hasDiscrepancyMention = true;
    cleanDiscSnippet = discMatch[0].trim();
    discSnippet = cleanDiscSnippet.replace(/\s+/g, ' ');
  } else {
    const discIndex = textWithout71D.search(/DISCREPA/i);
    if (discIndex !== -1) {
      hasDiscrepancyMention = true;
      const lookBackStart = Math.max(0, discIndex - 150);
      const precedingBlock = textWithout71D.substring(lookBackStart, discIndex);
      const condStartMatch = precedingBlock.match(/(?:(?:\n|\.|;|:)\s*(?:[0-9]{1,2}[\\.\\)]|\\b[A-Z][\\.\\)]|\\+)\s+[A-Z]|:[0-9]{2}[A-Z]?:)[^\n\.;:]*$/i);
      const effectiveStart = condStartMatch ? lookBackStart + condStartMatch.index! : lookBackStart;
      const clauseSnippet = textWithout71D.substring(effectiveStart, discIndex + 400);
      const tagStop = clauseSnippet.search(new RegExp(conditionBoundary, 'i'));
      cleanDiscSnippet = tagStop !== -1 ? clauseSnippet.substring(0, tagStop) : clauseSnippet;
      discSnippet = cleanDiscSnippet.replace(/\s+/g, ' ');
    }
  }

  if (hasDiscrepancyMention) {
    const tieredDisc = parseTieredFee(cleanDiscSnippet, numericLcAmount);
    if (tieredDisc) {
      discAmt = tieredDisc.applicableFee;
    } else {
      // Require explicit currency or fee indicator (never bare numbers or SWIFT tags like :78:)
      const feeMatches = [
        ...cleanDiscSnippet.matchAll(/(?:(?:USD|EUR|GBP)\s*(\d{2,3}(?:\.\d{2})?)|(?:AT|OF|COST|FEE|CHARGE)\s+(?:USD|EUR|GBP)?\s*(\d{2,3}(?:\.\d{2})?))\b(?!\s*,\s*000|\s*000)/gi)
      ];
      const candidateFees = feeMatches.map(m => parseFloat(m[1] || m[2])).filter(f => f >= 10 && f <= 350);
      if (candidateFees.length > 0) discAmt = Math.max(...candidateFees);
    }

    const upperDiscSnippet = cleanDiscSnippet.toUpperCase().replace(/\s+/g, ' ');
    isDiscOnApplicant =
      (upperDiscSnippet.includes("APPLICANT'S ACCOUNT") ||
       upperDiscSnippet.includes("APPLICANTS ACCOUNT") ||
       upperDiscSnippet.includes("APPLICANT ACCOUNT") ||
       upperDiscSnippet.includes("FOR APPLICANT") ||
       upperDiscSnippet.includes("FROM APPLICANT") ||
       upperDiscSnippet.includes("BORNE BY APPLICANT") ||
       upperDiscSnippet.includes("BUYER'S ACCOUNT") ||
       upperDiscSnippet.includes("BUYERS ACCOUNT") ||
       upperDiscSnippet.includes("BUYER ACCOUNT")) &&
      !upperDiscSnippet.includes("BENEFICIARY");
  }

  // 1B. EXPIRED L/C PRESENTATION FEE AUDIT:
  let expiredLcAmt = 0;
  let hasExpiredLcMention = false;
  let isExpiredLcOnApplicant = false;
  let cleanExpiredLcSnippet = '';
  let expiredLcSnippet = '';

  const expiredLcRegex = new RegExp(
    `(?:` +
      `${clausePrefix}(?:IN\\s+ADDITION\\s+TO\\s+(?:A\\s+)?DISCREPANCY\\s+FEE[\\s,]+)(?:A\\s+)?FEE\\s+(?:OF\\s+)?(?:USD|EUR|GBP)?\\s*\\d+(?:\\.\\d{2})?[\\s\\S]*?${conditionBoundary}` +
      `|${clausePrefix}(?:(?:EXPIRED\\s+(?:L\\/?C|CREDIT)|PRESENTATION\\s+UNDER\\s+EXPIRED\\s+(?:L\\/?C|CREDIT)|LATE\\s+PRESENTATION)[\\s\\S]{0,100}?(?:FEE|CHARGE|COST|COMMISSION|EXPENSE|DEDUCT(?:ED)?)[\\s\\S]*?${conditionBoundary})` +
      `|${clausePrefix}(?:A\\s+)?(?:FEE|CHARGE|COST)\\s+(?:OF\\s+)?(?:USD|EUR|GBP)?\\s*\\d+(?:\\.\\d{2})?[\\s\\S]{0,120}?(?:PRESENTATION\\s+UNDER\\s+EXPIRED|UNDER\\s+EXPIRED\\s+(?:L\\/?C|CREDIT))[\\s\\S]*?${conditionBoundary}` +
    `)`,
    'i'
  );

  const expMatch = textWithout71D.match(expiredLcRegex);
  if (expMatch) {
    hasExpiredLcMention = true;
    cleanExpiredLcSnippet = expMatch[0].trim();
    expiredLcSnippet = cleanExpiredLcSnippet.replace(/\s+/g, ' ');
    const amtM = cleanExpiredLcSnippet.match(/(?:(?:USD|EUR|GBP)\s*(\d+(?:\.\d{2})?)|(?:CHARGE|FEE|COMMISSION|COST|DEDUCT(?:ED)?|OF|AT)\s+(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(?:USD|EUR|GBP))\b/i);
    if (amtM) expiredLcAmt = parseFloat(amtM[1] || amtM[2] || amtM[3]);

    const upperExpSnippet = cleanExpiredLcSnippet.toUpperCase();
    isExpiredLcOnApplicant =
      (upperExpSnippet.includes("APPLICANT'S ACCOUNT") ||
       upperExpSnippet.includes("APPLICANTS ACCOUNT") ||
       upperExpSnippet.includes("APPLICANT ACCOUNT") ||
       upperExpSnippet.includes("FOR APPLICANT") ||
       upperExpSnippet.includes("FROM APPLICANT") ||
       upperExpSnippet.includes("BORNE BY APPLICANT") ||
       upperExpSnippet.includes("BUYER'S ACCOUNT") ||
       upperExpSnippet.includes("BUYERS ACCOUNT") ||
       upperExpSnippet.includes("BUYER ACCOUNT")) &&
      !upperExpSnippet.includes("BENEFICIARY");
  } else {
    const expIdx = textWithout71D.search(/PRESENTATION\s+UNDER\s+EXPIRED|EXPIRED\s+(?:L\/?C|CREDIT)/i);
    if (expIdx !== -1) {
      const surrounding = textWithout71D.substring(Math.max(0, expIdx - 150), expIdx + 250);
      if (/(?:FEE|CHARGE|COST|COMMISSION|DEDUCT)/i.test(surrounding)) {
        const amtM = surrounding.match(/(?:(?:USD|EUR|GBP)\s*(\d+(?:\.\d{2})?)|(?:CHARGE|FEE|COMMISSION|COST|DEDUCT(?:ED)?|OF|AT)\s+(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(?:USD|EUR|GBP))\b/i);
        if (amtM) {
          hasExpiredLcMention = true;
          expiredLcAmt = parseFloat(amtM[1] || amtM[2] || amtM[3]);
          cleanExpiredLcSnippet = surrounding.trim();
          expiredLcSnippet = cleanExpiredLcSnippet.replace(/\s+/g, ' ');
          const upperExp = cleanExpiredLcSnippet.toUpperCase();
          isExpiredLcOnApplicant = (upperExp.includes("APPLICANT") || upperExp.includes("BUYER")) && !upperExp.includes("BENEFICIARY");
        }
      }
    }
  }

  // 2. PAYMENT / REIMBURSEMENT / SETTLEMENT / FUND TRANSFER / RTGS CHARGES AUDIT:
  const paymentFeeRegex = /(?:PAYMENT|REIMBURSEMENT|SETTLEMENT|DOCUMENT\s*SETTLEMENT|FUND\s*TRANSFER|RTGS|L\/?C\s*PAYMENT)[\s\S]{0,40}?(?:CHARGE|COMMISSION|FEE|COST|EXPENSE|OF\s+USD|AT\s+USD|ATTRACT)/i;
  const paymentDeductRegex = /(?:(?:WE\s+)?(?:WILL|SHALL)\s+BE\s+DEDUCTED|WE\s+WILL\s+DEDUCT|DEDUCTED\s+FROM\s+(?:THE\s+)?BILL\s+VALUE)[\s\S]{1,60}?(?:AT\s+THE\s+TIME\s+OF\s+PAYMENT|PAYMENT)/i;
  const docSettlementRegex = /(?:AN\s+AMOUNT\s+OF\s+)?(?:USD|EUR|GBP)?\s*[\d.]+\s+AS\s+(?:DOCUMENT\s+)?SETTLEMENT/i;
  const hasAnyPaymentFeeMention = paymentFeeRegex.test(textWithout71D) ||
                                  paymentDeductRegex.test(textWithout71D) ||
                                  docSettlementRegex.test(textWithout71D) ||
                                  /DEDUCT\s+(?:PAYMENT|SETTLEMENT|REIMBURSEMENT)\s+CHARGE/i.test(textWithout71D) ||
                                  Boolean(chargesBlock && /(?:REIMBURS|PAYMENT|SETTLEMENT|RTGS|FUND\s*TRANSFER|HANDLING)/i.test(chargesBlock));

  let totalPaymentFeeBeneficiary = 0;
  let totalPaymentFeeApplicant = 0;
  const detectedPaymentFees: Array<{ type: string; amount: number; payer: string; text: string }> = [];

  if (hasAnyPaymentFeeMention) {
    const paymentRegexGlobal = new RegExp(
      `${clausePrefix}(?:(?:EACH\\s+)?(?:L\\/?C\\s+)?(?:PAYMENT|SETTLEMENT|REIMBURSEMENT|DOCUMENT\\s*SETTLEMENT|FUND\\s*TRANSFER|RTGS)[\\s\\S]{0,40}?(?:CHARGE|COMMISSION|FEE|COST|EXPENSE|ATTRACT)[S]?[\\s\\S]*?${conditionBoundary})` +
      `|${clausePrefix}(?:AT\\s+THE\\s+TIME\\s+OF\\s+PAYMENT[\\s\\S]{1,60}?(?:WE\\s+)?(?:WILL|SHALL)\\s+(?:BE\\s+)?DEDUCT(?:ED)?)[\\s\\S]*?${conditionBoundary}` +
      `|${clausePrefix}(?:(?:WE\\s+)?(?:WILL|SHALL)\\s+(?:BE\\s+)?DEDUCT(?:ED)?[\\s\\S]{1,60}?AS\\s+(?:PAYMENT|SETTLEMENT|REIMBURSEMENT)\\s+(?:FEE|CHARGE)[S]?)[\\s\\S]*?${conditionBoundary}` +
      `|(?:(?:AN\\s+AMOUNT\\s+OF\\s+)?(?:USD|EUR|GBP)?\\s*[\\d.]+\\s+AS\\s+(?:DOCUMENT\\s+)?SETTLEMENT[\\s\\S]*?${conditionBoundary})`,
      'gi'
    );
    let pMatch;
    while ((pMatch = paymentRegexGlobal.exec(textWithout71D)) !== null) {
      const snippet = pMatch[0].trim();
      if (snippet.includes('DISCREPA') && !snippet.includes('PAYMENT')) continue; // Skip accidental overlap with discrepancy condition
      const upperSnippet = snippet.toUpperCase();

      const isBorneByApplicant =
        (upperSnippet.includes("APPLICANT'S ACCOUNT") ||
         upperSnippet.includes("FOR APPLICANT ACCOUNT") ||
         upperSnippet.includes("FOR ACCOUNT OF APPLICANT") ||
         upperSnippet.includes("BORNE BY APPLICANT") ||
         upperSnippet.includes("BUYER'S ACCOUNT")) &&
        !upperSnippet.includes("BENEFICIARY");

      const tiered = parseTieredFee(snippet, numericLcAmount);
      let feeVal = 0;
      let feeType = 'Payment / Settlement Charge';

      if (tiered) {
        feeVal = tiered.applicableFee;
        feeType = 'Tiered Payment Charge';
      } else {
        const docSettleMatch = snippet.match(/(?:AN\s+AMOUNT\s+OF\s+)?(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)\s+AS\s+(?:DOCUMENT\s+)?SETTLEMENT/i);
        if (docSettleMatch) {
          feeVal = parseFloat(docSettleMatch[1]);
          feeType = 'Document Settlement Charge';
        } else {
          const amtM = snippet.match(/(?:(?:USD|EUR|GBP)\s*(\d{2,3}(?:\.\d{2})?)|(?:CHARGE|FEE|COMMISSION|COST|DEDUCT(?:ED)?|OF|AT)\s+(?:USD|EUR|GBP)?\s*(\d{2,3}(?:\.\d{2})?)|(\d{2,3}(?:\.\d{2})?)\s*(?:USD|EUR|GBP))\b/i);
          if (amtM) feeVal = parseFloat(amtM[1] || amtM[2] || amtM[3]);
        }
      }

      if (feeVal > 0 && feeVal <= 300) {
        if (isBorneByApplicant) {
          totalPaymentFeeApplicant += feeVal;
          detectedPaymentFees.push({ type: feeType, amount: feeVal, payer: 'Applicant', text: snippet.replace(/\s+/g, ' ') });
        } else {
          totalPaymentFeeBeneficiary += feeVal;
          detectedPaymentFees.push({ type: feeType, amount: feeVal, payer: 'Beneficiary', text: snippet.replace(/\s+/g, ' ') });
        }
      }
    }

    // Field 78 direct payment deduction
    const f78DeductMatch = normalizedText.match(/(?:(?:DEDUCT|LESS)\s+(?:PAYMENT|SETTLEMENT|REIMBURSEMENT)\s+CHARGE\s+(?:USD)?\s*(\d+(?:\.\d{2})?)|(?:DEDUCT|LESS)\s+(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)\s+(?:AS\s+)?(?:PAYMENT|SETTLEMENT|REIMBURSEMENT)\s+CHARGE)/i);
    if (f78DeductMatch) {
      const feeVal = parseFloat(f78DeductMatch[1] || f78DeductMatch[2]);
      if (feeVal > 0 && !detectedPaymentFees.some(f => f.amount === feeVal)) {
        totalPaymentFeeBeneficiary += feeVal;
        detectedPaymentFees.push({ type: 'Field 78 Payment Deduction', amount: feeVal, payer: 'Beneficiary', text: f78DeductMatch[0] });
      }
    }

    // Field 71D payment / reimbursement / handling / fund transfer charge check (jointly audited with Payment/Settlement charges)
    if (chargesBlock && chargesMatch && /(?:REIMBURS|PAYMENT|SETTLEMENT|RTGS|FUND\s*TRANSFER|HANDLING)/i.test(chargesBlock)) {
      const is71dBene = chargesBlock.includes('BENEFICIARY');
      const is71dApplicant = (chargesBlock.includes('APPLICANT') || chargesBlock.includes('BUYER')) && !is71dBene;

      const f71dFeeMatch = chargesMatch[1].match(/(?:(?:USD|EUR|GBP)\s*(\d+(?:\.\d{2})?)|(?:REIMBURSEMENT|PAYMENT|SETTLEMENT|RTGS|FUND\s*TRANSFER|HANDLING|BANKING|BANK)?\s*(?:CHARGE|FEE|COMMISSION|COST)[^\d\n]{0,25}?(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(?:USD|EUR|GBP))\b/i);
      if (f71dFeeMatch) {
        const feeVal = parseFloat(f71dFeeMatch[1] || f71dFeeMatch[2] || f71dFeeMatch[3]);
        if (feeVal > 0 && feeVal <= 300 && !detectedPaymentFees.some(f => f.amount === feeVal)) {
          if (is71dApplicant) {
            totalPaymentFeeApplicant += feeVal;
            detectedPaymentFees.push({ type: 'Field 71D Reimbursement/Payment Charge', amount: feeVal, payer: 'Applicant', text: chargesMatch[1].trim() });
          } else {
            totalPaymentFeeBeneficiary += feeVal;
            detectedPaymentFees.push({ type: 'Field 71D Reimbursement/Payment Charge', amount: feeVal, payer: 'Beneficiary', text: chargesMatch[1].trim() });
          }
        }
      }
    }
  }

  // 3. CABLE / SWIFT / TELEX CHARGES AUDIT:
  const cableMatches = [...textWithout71D.matchAll(/(?:CABLE\s*(?:COST|CHARGE|FEE)|SWIFT\s*(?:COST|CHARGE|FEE)|TELEX\s*(?:COST|CHARGE|FEE))\s*(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)/gi)];
  let cableSwiftTotal = 0;
  for (const cm of cableMatches) {
    const cVal = parseFloat(cm[1]);
    if (cVal > 0 && cVal <= 100) {
      cableSwiftTotal += cVal;
    }
  }

  // Payer Breakdown for UI Display
  const discPayerStr = hasDiscrepancyMention
    ? `Discrepancy Fee: USD ${discAmt.toFixed(2)} (${isDiscOnApplicant ? "Applicant's Account" : "Beneficiary's Account"})`
    : `Discrepancy Fee: None in LC`;

  const expPayerStr = hasExpiredLcMention
    ? ` | Expired L/C Fee: USD ${expiredLcAmt.toFixed(2)} (${isExpiredLcOnApplicant ? "Applicant's Account" : "Beneficiary's Account"})`
    : '';

  const payPayerStr = hasAnyPaymentFeeMention
    ? (totalPaymentFeeBeneficiary > 0
        ? `Payment Charges: USD ${totalPaymentFeeBeneficiary.toFixed(2)} (Beneficiary's Account)`
        : `Payment Charges: USD ${totalPaymentFeeApplicant.toFixed(2)} (Applicant's Account)`)
    : `Payment Charges: None in LC`;

  const cableStr = cableSwiftTotal > 0 ? ` | Cable/SWIFT: USD ${cableSwiftTotal.toFixed(2)} (Beneficiary's Account)` : '';
  const breakdownFull = `${discPayerStr}${expPayerStr} | ${payPayerStr}${cableStr}`;

  // 4. COMBINED CHARGE RULES EVALUATION & BREAKDOWN OBJECT
  const discOnBeneficiary = (!isDiscOnApplicant && hasDiscrepancyMention) ? discAmt : 0;
  const expiredOnBeneficiary = (!isExpiredLcOnApplicant && hasExpiredLcMention) ? expiredLcAmt : 0;
  const payOnBeneficiary = totalPaymentFeeBeneficiary;
  const totalBeneficiaryCharges = discOnBeneficiary + payOnBeneficiary + expiredOnBeneficiary + cableSwiftTotal;

  // Clause locations for discrepancy, expired LC & payment
  const discClauseNum = extractClauseNumber(cleanDiscSnippet, normalizedText);
  const discLoc = discClauseNum ? `Field 47A, ${discClauseNum}` : (hasDiscrepancyMention ? 'Field 47A' : 'Field 47A (Missing)');

  const expClauseNum = hasExpiredLcMention ? extractClauseNumber(cleanExpiredLcSnippet, normalizedText) : null;
  const expLoc = expClauseNum ? `Field 47A, ${expClauseNum}` : 'Field 47A';

  const primaryPayFee = detectedPaymentFees.find(f => f.payer === 'Beneficiary') || detectedPaymentFees[0];
  const payClauseNum = primaryPayFee ? extractClauseNumber(primaryPayFee.text, normalizedText) : null;
  const payLoc = primaryPayFee
    ? (primaryPayFee.type.includes('71D')
        ? 'Field 71D'
        : (primaryPayFee.type.includes('78')
            ? 'Field 78'
            : (payClauseNum ? `Field 47A, ${payClauseNum}` : 'Field 47A')))
    : 'Field 47A (Missing)';

  const relevantClauses = [discClauseNum, expClauseNum, payClauseNum].filter(Boolean) as string[];
  let combinedLoc = 'Field 47A';
  if (relevantClauses.length > 1) {
    const formatted = relevantClauses.map((c, i) => i === 0 ? c : c.replace(/^Clause\s*/i, ''));
    const last = formatted.pop();
    combinedLoc = `Field 47A (${formatted.join(', ')} & ${last})`;
  } else if (relevantClauses.length === 1) {
    combinedLoc = `Field 47A, ${relevantClauses[0]}`;
  }

  // Construct Charge Breakdown items (who pays what)
  const breakdownItems: ChargePayerItem[] = [];

  if (hasDiscrepancyMention && discAmt > 0) {
    breakdownItems.push({
      type: 'Discrepancy Fee',
      amount: discAmt,
      currency: detectedCurrency || 'USD',
      payer: isDiscOnApplicant ? 'Applicant' : 'Beneficiary',
      clauseSnippet: discSnippet,
      clauseLocation: discLoc,
      isExceeding: !isDiscOnApplicant && discAmt > 25
    });
  }

  if (hasExpiredLcMention && expiredLcAmt > 0) {
    breakdownItems.push({
      type: 'Expired L/C Presentation Fee',
      amount: expiredLcAmt,
      currency: detectedCurrency || 'USD',
      payer: isExpiredLcOnApplicant ? 'Applicant' : 'Beneficiary',
      clauseSnippet: expiredLcSnippet,
      clauseLocation: expLoc,
      isExceeding: !isExpiredLcOnApplicant
    });
  }

  for (const pf of detectedPaymentFees) {
    const itemLoc = pf.type.includes('71D') ? 'Field 71D' : (pf.type.includes('78') ? 'Field 78' : resolveClauseLocation('Field 47A', pf.text, normalizedText));
    breakdownItems.push({
      type: pf.type,
      amount: pf.amount,
      currency: detectedCurrency || 'USD',
      payer: pf.payer as 'Beneficiary' | 'Applicant',
      clauseSnippet: pf.text,
      clauseLocation: itemLoc,
      isExceeding: pf.payer === 'Beneficiary' && pf.amount > 25
    });
  }

  if (cableSwiftTotal > 0) {
    breakdownItems.push({
      type: 'Cable / SWIFT Charge',
      amount: cableSwiftTotal,
      currency: detectedCurrency || 'USD',
      payer: 'Beneficiary',
      clauseLocation: 'Field 47A',
      isExceeding: cableSwiftTotal > 50
    });
  }

  const chargeBreakdown: ChargeBreakdown = {
    totalBeneficiary: totalBeneficiaryCharges,
    totalApplicant: (isDiscOnApplicant ? discAmt : 0) + (isExpiredLcOnApplicant ? expiredLcAmt : 0) + totalPaymentFeeApplicant,
    items: breakdownItems,
    summaryText: breakdownFull
  };

  // Case A: Neither Discrepancy nor Payment charge is in the LC -> Ask for unified clause
  if (!hasDiscrepancyMention && !hasAnyPaymentFeeMention) {
    issues.push({
      id: 'issue_missing_discrepancy_payment_clauses',
      correctionId: 'discrepancy_payment_charges_revision',
      title: 'Missing Discrepancy & Payment Charge Clauses',
      clauseLocation: 'Field 47A (Missing Clauses)',
      severity: 'warning',
      reason: 'No clauses are defined in the LC regarding discrepancy handling fees or payment/settlement charges. Please add standard clauses capping discrepancy at max USD 25.00 and payment at max USD 25.00, not exceeding USD 50.00 in total.',
      detectedText: 'No discrepancy or payment charge clause found in LC conditions',
      chargeBreakdown: {
        totalBeneficiary: 0,
        totalApplicant: 0,
        items: [
          {
            type: 'Discrepancy Fee',
            amount: 0,
            currency: detectedCurrency || 'USD',
            payer: 'Beneficiary',
            clauseSnippet: 'No discrepancy clause found in LC conditions',
            clauseLocation: 'Field 47A (Missing)',
            isExceeding: true
          },
          {
            type: 'Payment Charge',
            amount: 0,
            currency: detectedCurrency || 'USD',
            payer: 'Beneficiary',
            clauseSnippet: 'No payment/settlement clause found in LC conditions',
            clauseLocation: 'Field 47A (Missing)',
            isExceeding: true
          }
        ],
        summaryText: 'Discrepancy & Payment Charge Clauses Missing from LC'
      },
      suggestedDetails: {
        discrepancyChargeInLc: 'Unspecified',
        paymentChargeInLc: 'Unspecified',
        acceptableDiscrepancyCharge: '25.00',
        acceptablePaymentCharge: '25.00'
      }
    });
  }
  // Case B: Both Discrepancy and Payment charges are present in LC (or Expired LC fee present)
  else if (hasDiscrepancyMention && hasAnyPaymentFeeMention) {
    const discNeedsRevision = discOnBeneficiary > 25;
    const payNeedsRevision = payOnBeneficiary > 25;
    const combinedNeedsRevision = totalBeneficiaryCharges > 50 || (hasExpiredLcMention && !isExpiredLcOnApplicant);

    // If both need revision OR combined total exceeds $50.00 OR extra expired LC fee present
    if ((discNeedsRevision && payNeedsRevision) || (combinedNeedsRevision && (discOnBeneficiary > 0 && payOnBeneficiary > 0))) {
      issues.push({
        id: 'issue_combined_charges_revision',
        correctionId: 'discrepancy_payment_charges_revision',
        title: hasExpiredLcMention
          ? `Revise Bank Charges & Deductions (Combined USD ${totalBeneficiaryCharges.toFixed(2)} Exceeds Limits)`
          : 'Revise Discrepancy & Payment Charges (Combined Exceeds Limits)',
        clauseLocation: combinedLoc,
        severity: 'warning',
        reason: `Bank charges placed on beneficiary exceed acceptable limits: ${breakdownFull}. Total beneficiary deductions USD ${totalBeneficiaryCharges.toFixed(2)} exceed the ceiling of USD 50.00. Discrepancy must be max USD 25.00, payment max USD 25.00${hasExpiredLcMention ? `, extra expired L/C fee of USD ${expiredLcAmt.toFixed(2)} deleted` : ''}, and combined total max USD 50.00.`,
        detectedText: breakdownFull,
        chargeBreakdown,
        suggestedDetails: {
          discrepancyChargeInLc: discAmt.toFixed(2),
          paymentChargeInLc: totalPaymentFeeBeneficiary.toFixed(2),
          acceptableDiscrepancyCharge: '25.00',
          acceptablePaymentCharge: '25.00',
          additionalNote: hasExpiredLcMention && !isExpiredLcOnApplicant ? `Delete extra Expired L/C fee of USD ${expiredLcAmt.toFixed(2)}` : undefined
        }
      });
    } else if (discNeedsRevision && !payNeedsRevision) {
      // Only discrepancy exceeds $25 on beneficiary
      issues.push({
        id: 'issue_excessive_discrepancy_fee',
        correctionId: 'discrepancy_charges',
        title: `Excessive Discrepancy Fee (USD ${discAmt.toFixed(2)})`,
        clauseLocation: discLoc,
        severity: 'warning',
        reason: `The discrepancy fee in the LC is USD ${discAmt.toFixed(2)} (${isDiscOnApplicant ? "Applicant's Account" : "Beneficiary's Account"}), which exceeds the standard acceptable limit of USD 25.00.`,
        detectedText: `${discPayerStr} | ${payPayerStr}`,
        chargeBreakdown,
        suggestedDetails: {
          discrepancyChargeInLc: discAmt.toFixed(2),
          acceptableDiscrepancyCharge: '25.00',
          maxChargeAmount: '25.00'
        }
      });
    } else if (!discNeedsRevision && payNeedsRevision) {
      // Only payment exceeds $25 on beneficiary
      const feesBreakdown = detectedPaymentFees.filter(f => f.payer === 'Beneficiary').map(f => `USD ${f.amount.toFixed(2)}`).join(' + ');
      issues.push({
        id: 'issue_payment_charges_limit_exceeded',
        correctionId: 'payment_processing_charges',
        title: `Payment / Settlement Charges Exceed USD 25.00 (Total: USD ${totalPaymentFeeBeneficiary.toFixed(2)})`,
        clauseLocation: payLoc,
        severity: 'warning',
        reason: `Payment/settlement charges in the LC total USD ${totalPaymentFeeBeneficiary.toFixed(2)} (${feesBreakdown}) on beneficiary account, which exceeds the allowable limit of USD 25.00.`,
        detectedText: `${payPayerStr} | ${discPayerStr}`,
        chargeBreakdown,
        suggestedDetails: {
          paymentChargeInLc: totalPaymentFeeBeneficiary.toFixed(2),
          acceptablePaymentCharge: '25.00',
          maxChargeAmount: '25.00'
        }
      });
    }
  }
  // Case C: Only Discrepancy is present, Payment is missing
  else if (hasDiscrepancyMention && !hasAnyPaymentFeeMention) {
    if (discOnBeneficiary > 25) {
      issues.push({
        id: 'issue_excessive_discrepancy_fee',
        correctionId: 'discrepancy_charges',
        title: `Excessive Discrepancy Fee (USD ${discAmt.toFixed(2)})`,
        clauseLocation: discLoc,
        severity: 'warning',
        reason: `The discrepancy fee in the LC is USD ${discAmt.toFixed(2)} (${isDiscOnApplicant ? "Applicant's Account" : "Beneficiary's Account"}), which exceeds the standard acceptable limit of USD 25.00.`,
        detectedText: discSnippet,
        chargeBreakdown,
        suggestedDetails: {
          discrepancyChargeInLc: discAmt.toFixed(2),
          acceptableDiscrepancyCharge: '25.00',
          maxChargeAmount: '25.00'
        }
      });
    }
    issues.push({
      id: 'issue_missing_payment_charge_clause',
      correctionId: 'payment_processing_charges',
      title: 'Missing Payment / Settlement Charge Clause',
      clauseLocation: 'Field 47A (Missing Payment Cap)',
      severity: 'info',
      reason: 'The LC contains a discrepancy fee clause, but does not define any cap for payment/settlement charges. Please specify that payment processing charges shall not exceed USD 25.00.',
      detectedText: 'No payment processing or settlement fee clause found in LC',
      suggestedDetails: {
        maxChargeAmount: '25.00'
      }
    });
  }
  // Case D: Only Payment is present, Discrepancy is missing
  else if (!hasDiscrepancyMention && hasAnyPaymentFeeMention) {
    if (payOnBeneficiary > 25) {
      const feesBreakdown = detectedPaymentFees.filter(f => f.payer === 'Beneficiary').map(f => `USD ${f.amount.toFixed(2)}`).join(' + ');
      issues.push({
        id: 'issue_payment_charges_limit_exceeded',
        correctionId: 'payment_processing_charges',
        title: `Payment / Settlement Charges Exceed USD 25.00 (Total: USD ${totalPaymentFeeBeneficiary.toFixed(2)})`,
        clauseLocation: payLoc,
        severity: 'warning',
        reason: `Payment/settlement charges in the LC total USD ${totalPaymentFeeBeneficiary.toFixed(2)} (${feesBreakdown}) on beneficiary account, which exceeds the allowable limit of USD 25.00.`,
        detectedText: payPayerStr,
        suggestedDetails: {
          paymentChargeInLc: totalPaymentFeeBeneficiary.toFixed(2),
          acceptablePaymentCharge: '25.00',
          maxChargeAmount: '25.00'
        }
      });
    }
    issues.push({
      id: 'issue_missing_discrepancy_clause',
      correctionId: 'discrepancy_charges',
      title: 'Missing Discrepancy Fee Clause (Uncapped Risk)',
      clauseLocation: 'Field 47A (Missing Discrepancy Cap)',
      severity: 'info',
      reason: 'The LC contains a payment charge clause, but does not specify any cap for discrepancy fees. Please specify that discrepancy charges, if any, shall not exceed USD 25.00.',
      detectedText: 'No discrepancy handling fee clause found in LC conditions',
      suggestedDetails: {
        maxChargeAmount: '25.00',
        acceptableDiscrepancyCharge: '25.00'
      }
    });
  }

  // Case E: Standalone Expired L/C Presentation Fee (if not already part of combined revision issue)
  if (hasExpiredLcMention && !isExpiredLcOnApplicant && !issues.some(i => i.id === 'issue_combined_charges_revision')) {
    issues.push({
      id: 'issue_expired_lc_presentation_fee',
      correctionId: 'discrepancy_charges',
      title: `Fee for Presentation Under Expired L/C (USD ${expiredLcAmt.toFixed(2)}) – Delete`,
      clauseLocation: expLoc,
      severity: 'warning',
      reason: `The LC imposes an additional fee of USD ${expiredLcAmt.toFixed(2)} for presentation under expired credit. Under standard commercial terms, beneficiary should only bear standard discrepancy fees up to USD 25.00-35.00. Additional expired presentation penalties must be deleted or borne by the applicant.`,
      detectedText: expiredLcSnippet,
      chargeBreakdown
    });
  }

  // ==========================================
  // RULE 3: Acceptance After Physical Verification / Receipt / Damage Claims – Delete
  // ==========================================
  const hasPhysicalVerificationMention =
    /PHYSICAL\s*VERIFICATION/i.test(normalizedText) ||
    /VERIFICATION\s+OF\s+GOODS/i.test(normalizedText) ||
    /PHYSICAL\s*RECEIPT/i.test(normalizedText) ||
    /RECEIPT\s+OF\s+GOODS/i.test(normalizedText) ||
    /GOODS\s+ARE\s+FOUND\s+(?:DAMAGED|DEFECTIVE)/i.test(normalizedText) ||
    /DEBIT\s+NOTE\s+ISSUED\s+BY\s+(?:THE\s+)?BUYER/i.test(normalizedText) ||
    (/CUSTOMS\s+CLEARANCE/i.test(normalizedText) && /ACCEPTANCE/i.test(normalizedText));

  if (hasPhysicalVerificationMention) {
    const isPhysicalVerif = /PHYSICAL\s*VERIFICATION|VERIFICATION\s+OF\s+GOODS/i.test(normalizedText);
    const pvClauseMatch = normalizedText.match(/(?:(?:\n|\.|;|^)\s*(?:CLAUSE\s+)?([0-9]{1,2}|[A-Z])[\.\)]\s*)([^\n\.;]*?(?:PHYSICAL\s*VERIFICATION|VERIFICATION\s+OF\s+GOODS|PHYSICAL\s*RECEIPT|RECEIPT\s+OF\s+GOODS|GOODS\s+ARE\s+FOUND\s+(?:DAMAGED|DEFECTIVE)|DEBIT\s+NOTE\s+ISSUED\s+BY\s+(?:THE\s+)?BUYER)[^\n\.;]*)/i);
    const detectedClauseNumber = pvClauseMatch && pvClauseMatch[1] ? `Clause ${pvClauseMatch[1].trim()}` : '';

    const snippet = pvClauseMatch
      ? pvClauseMatch[0].trim().replace(/\s+/g, ' ')
      : extractSnippet(normalizedText, /(?:ACCEPTANCE[\s\S]{0,60}?PHYSICAL\s*VERIFICATION[\s\S]{0,60}?(?:\.|$)|PHYSICAL\s*VERIFICATION[\s\S]{0,60}?(?:\.|$)|ACCEPTANCE\s+WILL\s+BE\s+GIVEN\s+AFTER[\s\S]{0,60}?(?:\.|$)|PHYSICAL\s*RECEIPT[\s\S]{0,60}?(?:\.|$)|RECEIPT\s*OF\s*GOODS[\s\S]{0,60}?(?:\.|$)|GOODS\s+ARE\s+FOUND\s+DAMAGED[^\n.]{0,100})/i);

    const isQualityOrDamageClaim = /DAMAGED|DEFECTIVE|DEBIT\s+NOTE/i.test(snippet || '');

    issues.push({
      id: 'issue_physical_verification_clause',
      correctionId: 'physical_verification_clause',
      title: detectedClauseNumber
        ? (isQualityOrDamageClaim
            ? `${detectedClauseNumber} – Quality Claim / Debit Note Deduction (Delete)`
            : `${detectedClauseNumber} – Physical Verification of Goods (Delete)`)
        : (isQualityOrDamageClaim
            ? 'Quality Claim / Debit Note Deduction Clause (Violates UCP 600)'
            : isPhysicalVerif
            ? 'Physical Verification of Goods Clause – Delete (Violates UCP 600)'
            : 'Acceptance After Physical Receipt Clause (Violates UCP 600)'),
      clauseLocation: detectedClauseNumber ? `Field 47A, ${detectedClauseNumber}` : 'Field 47A',
      severity: 'critical',
      reason: isQualityOrDamageClaim
        ? `LC payment or acceptance cannot be made subject to buyer damage claims, discounts, or debit notes${detectedClauseNumber ? ` (${detectedClauseNumber})` : ''}. In accordance with UCP 600, letters of credit deal exclusively with documents; quality claims or commercial disputes must be handled outside the documentary credit.`
        : isPhysicalVerif
        ? `Bill acceptance or payment cannot be made conditional upon physical verification of goods${detectedClauseNumber ? ` (${detectedClauseNumber})` : ''}. In accordance with UCP 600, banks deal with documents and not goods; acceptance must be strictly issued against compliant shipping documents.`
        : `Bill acceptance cannot be made conditional upon physical arrival or inspection of goods${detectedClauseNumber ? ` (${detectedClauseNumber})` : ''}. Under UCP 600, payment/acceptance must be strictly against compliant documents.`,
      detectedText: snippet || (isPhysicalVerif ? 'Acceptance conditional upon physical verification of goods' : 'Acceptance after physical receipt of goods'),
      suggestedDetails: {
        clauseNumber: detectedClauseNumber
      }
    });
  }

  // ==========================================
  // RULE 4: Bank Verification Report Clause – Delete
  // ==========================================
  if (
    upper.includes('BANK VERIFICATION REPORT') ||
    upper.includes('VERIFICATION REPORT') && upper.includes('BANK') ||
    upper.includes('AUTHENTICATED REPORT')
  ) {
    const snippet = extractSnippet(normalizedText, /VERIFICATION REPORT[^\n.]{0,100}/i);
    issues.push({
      id: 'issue_bank_verification_report',
      correctionId: 'bank_verification_report_deletion',
      title: 'Bank Verification Report Clause – Delete',
      clauseLocation: resolveClauseLocation('Field 47A', snippet),
      severity: 'warning',
      reason: 'Clauses mandating an inspection or verification report signed by applicant bank officials introduce serious document negotiation delays.',
      detectedText: snippet
    });
  }

  // ==========================================
  // RULE 5: Applicant Inspection Certificate / Certificate Removal
  // ==========================================
  if (
    upper.includes("APPLICANT'S INSPECTION CERTIFICATE") ||
    upper.includes("APPLICANTS INSPECTION CERTIFICATE") ||
    upper.includes("BUYER'S INSPECTION CERTIFICATE") ||
    upper.includes("CERTIFICATE SIGNED BY APPLICANT") ||
    upper.includes("CERTIFICATE SIGNED BY BUYER") ||
    upper.includes("APPLICANT'S CERTIFICATE") ||
    upper.includes("APPLICANTS CERTIFICATE") ||
    upper.includes("BUYER'S CERTIFICATE") ||
    (upper.includes("COUNTER-SIGNED BY") && (upper.includes("APPLICANT") || upper.includes("BUYER") || upper.includes("MANAGING DIRECTOR")))
  ) {
    const snippet = extractSnippet(normalizedText, /(?:APPLICANT|BUYER)['S ]*(?:INSPECTION\s+)?CERTIFICATE[^\n.]{0,100}/i) ||
                    extractSnippet(normalizedText, /COUNTER-SIGNED\s+BY[^\n.]{0,100}/i);
    issues.push({
      id: 'issue_applicant_certificate',
      correctionId: 'physical_verification_clause',
      title: 'Applicant Certificate / Inspection Removal',
      clauseLocation: resolveClauseLocation('Field 46A/47A', snippet, normalizedText),
      severity: 'critical',
      reason: 'Requiring an inspection or delivery certificate signed/counter-signed by the buyer/applicant allows the buyer to withhold approval and block payment at will.',
      detectedText: snippet
    });
  }

  // ==========================================
  // RULE 6: Short Presentation Period Check (Field 48 / F48)
  // ==========================================
  const presMatch = normalizedText.match(/(?:(?:48|F48)[^\n:]*[:#]?[\s\S]{0,30}?(?:Days:\s*|Period[^\n]*:\s*)?([0-9]{1,2})\s*DAYS?|Days:\s*([0-9]{1,2}))/i);
  if (presMatch) {
    const days = parseInt(presMatch[1] || presMatch[2], 10);
    if (days < 15) {
      issues.push({
        id: 'issue_presentation_period',
        correctionId: 'other_correction',
        title: `Short Presentation Period (${days} Days)`,
        clauseLocation: 'Field 48',
        severity: 'warning',
        reason: `The presentation period (Field 48) is set to only ${days} days from transport document date. Standard banking and courier clearance requires at least 15 to 21 days.`,
        detectedText: `Period for presentation: ${days} days`,
        suggestedDetails: {
          customCorrectionText: `Please amend Field 48 (Period for presentation) to 21 days instead of ${days} days from the date of the transport document.`
        }
      });
    }
  }

  // ==========================================
  // RULE 7: Gap between Latest Shipment Date & Expiry Date / Shipment Date Already Passed
  // ==========================================
  if (detectedShipmentDate) {
    const parsedShipment = parseFlexibleDate(detectedShipmentDate);
    const parsedIssue = detectedIssueDate ? parseFlexibleDate(detectedIssueDate) : null;
    const today = new Date();

    if (parsedShipment) {
      // Check 1: Shipment Date is already in the past compared to issue date or today
      const isBeforeIssue = parsedIssue && parsedShipment.getTime() < parsedIssue.getTime();
      const isBeforeToday = parsedShipment.getTime() < today.setHours(0, 0, 0, 0);

      if (isBeforeIssue || isBeforeToday) {
        issues.push({
          id: 'issue_shipment_date_passed',
          correctionId: 'shipment_date_extension',
          title: 'Latest Shipment Date is in the Past / Expired',
          clauseLocation: 'Field 44C',
          severity: 'critical',
          reason: `The latest shipment date (${detectedShipmentDate}) has already passed or is earlier than the LC issue date (${detectedIssueDate || 'today'}). Shipment is impossible without an immediate extension.`,
          detectedText: `Latest Date of Shipment: ${detectedShipmentDate}`,
          suggestedDetails: {
            currentShipmentDate: detectedShipmentDate
          }
        });
      }

      // Check 2: Expiry Gap
      if (detectedExpiryDate) {
        const parsedExpiry = parseFlexibleDate(detectedExpiryDate);
        if (parsedExpiry) {
          const diffMs = parsedExpiry.getTime() - parsedShipment.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays < 15 && diffDays >= 0) {
            issues.push({
              id: 'issue_expiry_gap',
              correctionId: 'expiry_date_extension',
              title: `Insufficient Expiry Gap (${diffDays} Days After Shipment)`,
              clauseLocation: 'Field 44C & Field 31D',
              severity: 'critical',
              reason: `LC expires only ${diffDays} days after shipment date (${detectedShipmentDate}). Expiry date should be at least 15-21 days after shipment date.`,
              detectedText: `Shipment: ${detectedShipmentDate}, Expiry: ${detectedExpiryDate}`,
              suggestedDetails: {
                currentShipmentDate: detectedShipmentDate,
                currentExpiryDate: detectedExpiryDate
              }
            });
          }
        }
      }
    }
  }

  // ==========================================
  // RULE 7B: Fund Transfer / Remittance Charges at Payment Time
  // ==========================================
  const upperNo71d = textWithout71D.toUpperCase();
  if (
    upperNo71d.includes('FUND TRANSFER') &&
    (upperNo71d.includes('DEDUCTED') || upperNo71d.includes('BENEFICIARY') || upperNo71d.includes('TIME OF PAYMENT'))
  ) {
    const fundSnippet = extractSnippet(textWithout71D, /DEDUCTED\s*FUND\s*TRANSFER\s*CHARGES[^\n.]{0,100}/i) ||
                         extractSnippet(textWithout71D, /FUND\s*TRANSFER\s*CHARGES[^\n.]{0,100}/i);
    issues.push({
      id: 'issue_fund_transfer_charges',
      correctionId: 'fund_transfer_charges',
      title: 'Fund Transfer Charges Deducted at Payment Time',
      clauseLocation: resolveClauseLocation('Field 47A', fundSnippet, normalizedText),
      severity: 'warning',
      reason: 'The LC mentions deducting fund transfer charges from payment proceeds. Fund transfer / remittance charges must be capped or borne by the applicant.',
      detectedText: fundSnippet || 'Deducted fund transfer charges at the time of payment.'
    });
  }

  // ==========================================
  // RULE 7C: Draft Tenor & Payment Clause Check (Field 42C / F42C)
  // ==========================================
  // Standard Usance Tenors in textile/commercial LCs:
  // - "120 DAYS FROM THE DATE OF ACCEPTANCE"
  // - "90 DAYS FROM THE DATE OF ACCEPTANCE"
  // - "120 DAYS" / "90 DAYS" / "60 DAYS" / "AT SIGHT"
  // These are standard acceptable terms and should NOT be flagged as errors or issues.
  // We ONLY flag if an abnormal/risky calculation trigger is used, such as "FROM THE DATE OF DELIVERY"
  // or "FROM THE DATE OF GOODS ARRIVAL" (which violates UCP 600 negotiation).
  const tenorMatch = normalizedText.match(/(?:F42C:\s*Drafts\s*(?:at)?\s*(?:\.{1,3}|…)?|:42C:)\s*[:#]?\s*([^\n]+)/i);
  if (tenorMatch) {
    const tenorText = tenorMatch[1].replace(/\s+/g, ' ').trim();
    const upperTenor = tenorText.toUpperCase();

    // Flag abnormal tenor condition: e.g. "FROM THE DATE OF DELIVERY"
    if (upperTenor.includes('DATE OF DELIVERY') || upperTenor.includes('DATE OF GOODS RECEIPT') || upperTenor.includes('ARRIVAL')) {
      issues.push({
        id: 'issue_draft_tenor_delivery',
        correctionId: 'draft_tenor_correction',
        title: 'Risky Draft Tenor (Counted From Date of Delivery)',
        clauseLocation: 'Field 42C',
        severity: 'critical',
        reason: `LC draft tenor states: "${tenorText}". Tenor counted from delivery date violates UCP 600 standards. It must be amended to standard "from the date of acceptance" or "from bill of exchange date".`,
        detectedText: `Drafts at: ${tenorText}`,
        suggestedDetails: {
          currentTenor: tenorText,
          requiredTenor: '120 DAYS FROM THE DATE OF ACCEPTANCE'
        }
      });
    }
    // Note: Standard "120 DAYS FROM THE DATE OF ACCEPTANCE", "90 DAYS...", "AT SIGHT" etc. are ACCEPTABLE and NOT flagged.
  }



  // ==========================================
  // RULE 7E: Missing Overdue Interest Clause Check (ONLY for Usance / Deferred LCs)
  // ==========================================
  // AT SIGHT LCs: Payment is due immediately upon compliant documents. Overdue clause is NOT required.
  // Usance / Deferred LCs: Payment is deferred (30/60/90/120/180 days). Overdue interest clause IS required.
  const f42cMatch = normalizedText.match(/(?:F42C:\s*Drafts\s*(?:at)?\s*(?:\.{1,3}|…)?|:42C:)\s*[:#]?\s*([^\n]+)/i);
  const tenorFieldText = f42cMatch ? f42cMatch[1].toUpperCase() : '';

  const isAtSight = tenorFieldText.includes('AT SIGHT') ||
                    (upper.includes('AT SIGHT') && !/\b(?:30|60|90|120|150|180)\s*DAYS\b/i.test(tenorFieldText));

  const isUsanceDeferred = !isAtSight && (
    /\b(?:30|60|90|120|150|180)\s*DAYS\b/i.test(normalizedText) ||
    upper.includes('AFTER ACCEPTANCE') ||
    upper.includes('FROM THE DATE OF ACCEPTANCE') ||
    upper.includes('FROM THE DATE OF DELIVERY') ||
    upper.includes('SIGHT FROM THE DATE')
  );

  // Check if there is an actual Overdue clause in LC conditions (F47A or text)
  // Ignore footer metadata strings like "Delivery overdue warning request"
  const relevantLcBody = normalizedText.replace(/Delivery\s*overdue\s*warning\s*request/gi, '');
  const upperBody = relevantLcBody.toUpperCase();

  const hasOverdueClause =
    /OVER\s*DUE\s*(?:INTEREST|CHARGE|CLAUSE|RATE|COMMISSION)/i.test(relevantLcBody) ||
    /OVER\s*DUE[\s\S]{0,30}?\d+(?:\.\d+)?%/i.test(relevantLcBody) ||
    /OVER\s*DUE[\s\S]{0,50}?(?:MATURITY|PER\s+ANNUM|P\.A\.|ACCEPTANCE)/i.test(relevantLcBody) ||
    /(?:DELAYED\s+PAYMENT|LATE\s+PAYMENT)\s+INTEREST/i.test(relevantLcBody) ||
    /INTEREST\s+(?:FOR|ON)\s+DELAYED\s+PAYMENT/i.test(relevantLcBody) ||
    /INTEREST\s+BEYOND\s+MATURITY/i.test(relevantLcBody) ||
    (upperBody.includes('OVERDUE') && (upperBody.includes('RATE') || upperBody.includes('PAY') || upperBody.includes('MATURITY')));

  // Check for benchmark interest terms like SOFR / LIBOR
  const hasBenchmarkInterest = upperBody.includes('SOFR') ||
                               upperBody.includes('LIBOR') ||
                               upperBody.includes('ATLIBOR') ||
                               upperBody.includes('AT LIBOR');

  if (isUsanceDeferred && !hasOverdueClause) {
    issues.push({
      id: 'issue_missing_overdue_clause',
      correctionId: 'overdue_clause',
      title: 'Missing Overdue Interest Clause (Deferred Usance LC)',
      clauseLocation: 'Field 47A (Missing Overdue Clause)',
      severity: 'warning',
      reason: 'This LC has a deferred usance tenor, but does not contain any overdue interest clause. If the buyer or issuing bank delays payment beyond maturity, no overdue interest penalty can be claimed without this clause.',
      detectedText: 'Deferred tenor detected (No overdue interest clause found in LC conditions)'
    });
  }

  // Information / Review Alert for SOFR/LIBOR benchmark interest clause
  if (isUsanceDeferred && hasBenchmarkInterest) {
    const interestSnippet = extractSnippet(normalizedText, /(?:INTEREST\s+WILL\s+BE\s+PAID[^\n.]*|AT\s*(?:LIBOR|SOFR)[^\n.]*)/i) ||
                            extractSnippet(normalizedText, /(?:LIBOR|SOFR)[^\n.]{0,80}/i);
    issues.push({
      id: 'issue_benchmark_interest_review',
      correctionId: 'payment_clause',
      title: 'Interest Rate Benchmark Alert (SOFR / LIBOR Clause Detected)',
      clauseLocation: resolveClauseLocation('Field 47A', interestSnippet),
      severity: 'info',
      reason: 'The LC specifies interest payment tied to SOFR / LIBOR. Please verify with your agreed Proforma Invoice (PI) whether the interest rate, spread, and payer (Applicant vs Beneficiary) match your agreed commercial terms.',
      detectedText: interestSnippet || 'Interest benchmark (SOFR/LIBOR) detected in LC.'
    });
  }

  // ==========================================
  // RULE 7F: Missing Payment Clause Check (Field 78 / Conditions)
  // ==========================================
  // Checks strictly whether a payment clause / instruction exists in the LC (e.g. remittance at maturity, RTGS, payment against compliant docs).
  // Note: Tenor is completely separate (Field 42C tenor is checked under Rule 7C).

  // 1. Check Field 78 tag presence and content
  const f78BlockMatch = normalizedText.match(/(?::78:|F78:|(?:^|\n|\s+)78\s*:|INSTRUCTION\s+TO\s+(?:THE\s+)?(?:PAYING|ACCEPTING|NEGO))[\s\S]*?(?=(?:\n:[0-9]{2}|\s+:[0-9]{2}:|\nF[0-9]{2}|\n\s*72[A-Z]?\s*:|$))/i);
  const f78HasPayment = f78BlockMatch ? /(?:PAYMENT|PAY\b|REMIT|REIMBURS|RTGS|SETTLE|HONOR)/i.test(f78BlockMatch[0]) : false;

  // 2. Check if LC already contains explicit payment fee / deduction clause
  const hasPaymentFeeClause = hasAnyPaymentFeeMention || detectedPaymentFees.length > 0;

  // 3. Check for payment terms anywhere in the LC
  const hasPaymentPhrases =
    /PAYMENT[\s\S]{0,60}WILL\s+BE\s+MADE/i.test(normalizedText) ||
    /(?:WE\s+)?(?:SHALL|WILL)\s+(?:EFFECT|MAKE)\s+PAYMENT/i.test(normalizedText) ||
    /EFFECT(?:ING)?\s+PAYMENT/i.test(normalizedText) ||
    /PAYMENT\s+(?:AT|ON)\s+MATURITY/i.test(normalizedText) ||
    /PAYMENT[\s\S]{0,40}AT\s+SIGHT/i.test(normalizedText) ||
    /(?:THROUGH|VIA|BY)\s+RTGS/i.test(normalizedText) ||
    /(?:REMIT|REMITTING|REMITTANCE)\s+(?:THE\s+)?(?:PROCEEDS|FUNDS)/i.test(normalizedText) ||
    /REIMBURSEMENT\s+CLAIM/i.test(normalizedText) ||
    /REIMBURSE\s+(?:OURSELVES|YOU)/i.test(normalizedText) ||
    /PAYMENT\s+AGAINST\s+(?:COMPLYING|COMPLIANT|DOCUMENTS)/i.test(normalizedText) ||
    /UPON\s+RECEIPT\s+OF\s+COMPLYING\s+DOCUMENTS/i.test(normalizedText) ||
    /(?:WE\s+)?(?:SHALL|WILL)\s+(?:REMIT|SETTLE|CREDIT)/i.test(normalizedText) ||
    /(?:SETTLEMENT|PAYMENT)\s+OF\s+(?:DOCUMENTS|BILLS|DRAFTS)/i.test(normalizedText) ||
    /AT\s+THE\s+TIME\s+OF\s+PAYMENT/i.test(normalizedText);

  const hasPaymentTerms = f78HasPayment || hasPaymentFeeClause || hasPaymentPhrases;

  if (!hasPaymentTerms) {
    issues.push({
      id: 'issue_missing_payment_clause',
      correctionId: 'payment_clause',
      title: 'Missing Payment Clause in LC',
      clauseLocation: 'Field 78 (Missing Payment Instruction)',
      severity: 'warning',
      reason: 'The LC does not contain a clear payment instruction or settlement clause (e.g. Field 78) specifying how and when payment will be remitted to the negotiating/presenting bank.',
      detectedText: 'No payment instruction or remittance clause found in LC conditions'
    });
  }

  // ==========================================
  // RULE 7G: Partial Payment / Partial Drawing Not Allowed Check
  // ==========================================
  const isPartialPaymentRestricted = /PARTIAL\s+PAYMENT[S]?\s+(?:IS\s+|ARE\s+)?NOT\s+ALLOWED/i.test(normalizedText) ||
                                    /PARTIAL\s+DRAWING[S]?\s+(?:IS\s+|ARE\s+)?NOT\s+ALLOWED/i.test(normalizedText) ||
                                    /PARTIAL\s+DRAWINGS?\s+PROHIBITED/i.test(normalizedText) ||
                                    /NO\s+PARTIAL\s+DRAWING/i.test(normalizedText) ||
                                    /DOCUMENTS\s+TO\s+BE\s+DESPATCHED\s+IN\s+ONE\s+LOT/i.test(normalizedText);

  if (isPartialPaymentRestricted) {
    const partialSnippet = extractSnippet(normalizedText, /PARTIAL\s+(?:PAYMENT|DRAWING)[S]?[^\n.]{0,80}/i) ||
                           extractSnippet(normalizedText, /DOCUMENTS\s+TO\s+BE\s+DESPATCHED\s+IN\s+ONE\s+LOT[^\n.]{0,80}/i);
    issues.push({
      id: 'issue_partial_payment_not_allowed',
      correctionId: 'partial_payment_not_allowed',
      title: 'Partial Payment / Drawing Not Allowed (Restricted)',
      clauseLocation: resolveClauseLocation('Field 47A', partialSnippet),
      severity: 'warning',
      reason: 'The LC restricts partial payments or partial drawings (or mandates documents in one single lot). In commercial export shipments, partial drawings must be allowed against partial deliveries.',
      detectedText: partialSnippet || 'Partial payment or partial drawing is restricted in the LC.',
      suggestedDetails: {
        additionalNote: 'Allow partial payments / partial drawings against each compliant document presentation.'
      }
    });
  }

  // ==========================================
  // RULE 8: Beneficiary Name Check (Field 59)
  // ==========================================
  if (settings?.companyName && settings.companyName.trim() && detectedBeneficiary) {
    const cleanExpected = settings.companyName.trim().toUpperCase().replace(/[.,\-\/]/g, ' ').replace(/\s+/g, ' ');
    const cleanActual = detectedBeneficiary.toUpperCase().replace(/[.,\-\/]/g, ' ').replace(/\s+/g, ' ');

    const expectedWords = cleanExpected
      .split(' ')
      .filter(w => w.length > 1 && !['LTD', 'LIMITED', 'PLC', 'PVT', 'CORP', 'CORPORATION', 'LLC', 'INC'].includes(w));
    
    const isMatch = cleanActual.includes(cleanExpected) ||
                    (expectedWords.length > 0 && expectedWords.every(w => cleanActual.includes(w)));

    if (!isMatch) {
      issues.push({
        id: 'issue_beneficiary_name',
        correctionId: 'beneficiary_name_correction',
        title: 'Beneficiary Legal Name Discrepancy',
        clauseLocation: 'Field 59',
        severity: 'warning',
        reason: `Beneficiary name detected in Field 59 does not seem to match your company profile: "${settings.companyName}".`,
        detectedText: detectedBeneficiary.split(',')[0].trim(),
        suggestedDetails: {
          correctBeneficiaryName: settings.companyName
        }
      });
    }
  }

  return {
    rawText: normalizedText,
    detectedLcNumber,
    detectedIssueDate,
    detectedExpiryDate,
    detectedShipmentDate,
    detectedBeneficiary,
    detectedApplicant,
    detectedCurrency,
    detectedAmount,
    issues
  };
}

// ==========================================
// HELPER PARSERS
// ==========================================

function extractLcNumber(text: string): string | undefined {
  // SWIFT Tag 20 or F20 (with colon or newline)
  const match20 = text.match(/(?::20:|F20:\s*Documentary\s*Credit\s*Number|\bF20:)[^\n:]*[:#]?\s*([A-Za-z0-9\-\/]{4,30})/i);
  if (match20) return match20[1].trim();

  // Label patterns
  const matchLabel = text.match(/(?:DOCUMENTARY\s*CREDIT\s*NUMBER|CREDIT\s*NUMBER|L\/C\s*NO\.?|LC\s*NO\.?)\s*[:#]?\s*([A-Za-z0-9\-\/]{4,30})/i);
  if (matchLabel) return matchLabel[1].trim();

  return undefined;
}

function extractDate(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  if (!match) return undefined;
  
  // Clean raw capture
  const captured = match[1].trim();

  // Pattern: YYMMDD followed by YYYY Month DD (e.g. "261010 2026 Oct 10" or "261206 2026 Dec 06")
  const ymdText = captured.match(/\b(20\d{2})\s+([A-Za-z]{3})\s+(\d{1,2})\b/);
  if (ymdText) {
    const year = ymdText[1];
    const monthStr = ymdText[2];
    const day = ymdText[3].padStart(2, '0');
    return `${day} ${monthStr} ${year}`;
  }

  // Look for 6-digit YYMMDD
  const sixDigit = captured.match(/\b(\d{6})\b/);
  if (sixDigit) {
    const rawDate = sixDigit[1];
    const year = '20' + rawDate.substring(0, 2);
    const month = rawDate.substring(2, 4);
    const day = rawDate.substring(4, 6);
    return `${day}/${month}/${year}`;
  }

  const rawDate = captured.split(/\s+/)[0];
  return rawDate && rawDate.length >= 6 ? rawDate : undefined;
}

function parseFlexibleDate(dateStr: string): Date | null {
  // Try DD/MM/YYYY
  const dmy = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
  }
  // Try YYYY-MM-DD
  const ymd = dateStr.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    return new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
  }
  // Try 6-digit YYMMDD
  const yymmdd = dateStr.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (yymmdd) {
    const year = parseInt('20' + yymmdd[1], 10);
    const month = parseInt(yymmdd[2], 10) - 1;
    const day = parseInt(yymmdd[3], 10);
    return new Date(year, month, day);
  }
  const timestamp = Date.parse(dateStr);
  return isNaN(timestamp) ? null : new Date(timestamp);
}

function extractAmount(text: string): { currency?: string; amount?: string } {
  // Case 1: Look directly around :32B: or F32B:
  // SWIFT MT700 field 32B format: :32B:YYMMDD[CUR][AMOUNT] or :32B: Currency Code, Amount\nUSD20935,
  // or F32B: Currency: USD Amount: 11125,00 #11125,00#
  const tag32bMatch = text.match(/(?::32B:|F32B:[^\n]*Currency[^\n]*)[^\n]*\n?([\s\S]{1,150}?(?=\n:[0-9]{2}|\nF[0-9]{2}|$))/i);
  if (tag32bMatch) {
    const block = tag32bMatch[1];
    
    // Check if currency code exists in block
    const currMatch = block.match(/\b(USD|EUR|GBP|BDT|JPY|CNY|CHF)\b/i);
    if (currMatch) {
      const currency = currMatch[1].toUpperCase();
      // Extract amount following the currency or Amount: keyword
      const afterCurrency = block.substring(currMatch.index! + currMatch[0].length);
      const amtMatch = afterCurrency.match(/\s*(?:Amount:\s*)?#?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})|[0-9]+(?:[.,][0-9]{2})|[0-9]+)/i) ||
                       block.match(/Amount:\s*#?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})|[0-9]+(?:[.,][0-9]{2})|[0-9]+)/i);
      if (amtMatch) {
        let rawAmt = amtMatch[1].trim();
        // Check if comma is used as decimal separator (e.g. 11125,00 or 11.125,00)
        if (/,\d{2}$/.test(rawAmt) && !rawAmt.includes('.')) {
          rawAmt = rawAmt.replace(/\./g, '').replace(',', '.');
        } else {
          rawAmt = rawAmt.replace(/,/g, '');
        }
        return {
          currency,
          amount: rawAmt
        };
      }
    }
  }

  // Fallback 1: Direct SWIFT code inline e.g. :32B:USD20935, or :32B:261028USD20935,
  const inlineMatch = text.match(/:32B:\s*(?:\d{6})?\s*(USD|EUR|GBP|BDT|JPY|CNY|CHF)\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?|[0-9]+)/i);
  if (inlineMatch) {
    return {
      currency: inlineMatch[1].toUpperCase(),
      amount: inlineMatch[2].trim().replace(/,/g, '')
    };
  }

  // Fallback 2: Label match e.g. "LC AMOUNT: USD 20,935.00" or "TOTAL VALUE USD 32,219.00"
  const matchLabel = text.match(/(?:LC\s*AMOUNT|TOTAL\s*VALUE|AMOUNT)\s*[:#]?\s*(USD|EUR|GBP|BDT|JPY|CNY|CHF)\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?|[0-9]+)/i);
  if (matchLabel) {
    return {
      currency: matchLabel[1].toUpperCase(),
      amount: matchLabel[2].trim().replace(/,/g, '')
    };
  }

  return {};
}

function extractParty(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  if (!match) return undefined;
  const raw = match[1];
  const lines = raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (/^Page \d+ of \d+/i.test(line)) return false;
      if (/^Name and Address:?$/i.test(line)) return false;
      if (/^Identifier Code:?$/i.test(line)) return false;
      if (/^:[0-9]{2}[A-Z]?:/i.test(line)) return false;
      if (/^F[0-9]{2}[A-Z]?:/i.test(line)) return false;
      return true;
    });

  return lines.length > 0 ? lines.slice(0, 4).join(', ') : undefined;
}

function extractSnippet(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  if (!match) return undefined;
  const raw = match[0].replace(/\s+/g, ' ').trim();
  return raw.length > 120 ? raw.substring(0, 117) + '...' : raw;
}
