import * as pdfjsLib from 'pdfjs-dist';
import type { LcAuditResult, LcAuditIssue, UserSettings } from '../types';

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

  // Extract Beneficiary and Applicant
  const detectedBeneficiary = extractParty(normalizedText, /(?::59:|F59:[^\n]*Beneficiary|BENEFICIARY)[^\n:]*[:#]?\s*\n?([^\n]+(?:\n[^\n]+){1,3})/i);
  const detectedApplicant = extractParty(normalizedText, /(?::50:|F50:[^\n]*Applicant|APPLICANT)[^\n:]*[:#]?\s*\n?([^\n]+(?:\n[^\n]+){1,3})/i);

  const issues: LcAuditIssue[] = [];

  // ==========================================
  // RULE 1: Field 71D – Genuinely Problematic Charges on Beneficiary
  // ==========================================
  const chargesMatch = normalizedText.match(/(?::71D:|:71B:|F71D:[^\n]*Charges)[^\n:]*[:#]?\s*([\s\S]{1,600}?)(?=(?:\n:\d{2}[A-Z]?:|\n\s*F\d{2}[A-Z]?:|\n\s*[A-Z\s]{4,}:|$))/i);
  const chargesBlock = chargesMatch ? chargesMatch[1].toUpperCase() : '';

  if (chargesBlock) {
    const hasOutsideIssuingQualifier =
      chargesBlock.includes('OUTSIDE ISSUING') ||
      chargesBlock.includes('OUTSIDE THE ISSUING') ||
      chargesBlock.includes('OUTSIDE ISSUING BANK') ||
      chargesBlock.includes("OUTSIDE ISSUING BANK'S") ||
      chargesBlock.includes('OUT SIDE ISSUING BANK') ||
      chargesBlock.includes("OUT SIDE ISSUING BANK'S");

    const hasBeneficiaryCharge =
      chargesBlock.includes('FOR ACCOUNT OF BENEFICIARY') ||
      chargesBlock.includes("FOR BENEFICIARY'S ACCOUNT") ||
      chargesBlock.includes('FOR BENEFICIARY ACCOUNT') ||
      chargesBlock.includes('ON ACCOUNT OF BENEFICIARY') ||
      chargesBlock.includes('BORNE BY BENEFICIARY');

    const hasReimbursementOnBeneficiary =
      (chargesBlock.includes('REIMBURS') && hasBeneficiaryCharge);

    const hasAllChargesOnBeneficiary =
      (chargesBlock.includes('ALL CHARGES') || chargesBlock.includes('ALL BANKING CHARGES')) &&
      hasBeneficiaryCharge &&
      !hasOutsideIssuingQualifier;

    const hasOurChargesOnBeneficiary =
      (chargesBlock.includes('OUR CHARGES') || chargesBlock.includes('ISSUING BANK CHARGES')) &&
      hasBeneficiaryCharge;

    if (hasReimbursementOnBeneficiary || hasAllChargesOnBeneficiary || hasOurChargesOnBeneficiary) {
      const snippet = extractSnippet(normalizedText, /(?:ALL CHARGES|REIMBURS|OUR CHARGES)[\s\S]{0,120}BENEFICIARY/i);
      issues.push({
        id: 'issue_clause_71d',
        correctionId: 'clause_71d_bank_charges',
        title: 'Clause 71D – Reimbursement/Issuing Bank Charges on Beneficiary',
        severity: 'critical',
        reason: hasReimbursementOnBeneficiary
          ? 'Field 71D places Reimbursement Charges ("all charges including reimbursement charge out side issuing bank\'s counter") on the Beneficiary. Reimbursement charges must be for Applicant\'s account.'
          : hasOurChargesOnBeneficiary
          ? 'The issuing bank\'s own charges are being placed on the beneficiary, which violates standard practice.'
          : 'All banking charges are placed on beneficiary without outside issuing counter qualification.',
        detectedText: snippet || 'Reimbursement charges on beneficiary account'
      });
    }
  }

  // ==========================================
  // RULE 2: Discrepancy & Payment Charges Revision
  // ==========================================
  const discFeeMatch = normalizedText.match(/(?:DISCREPA[A-Z]*\s*(?:FEE|CHARGE|CHARGES)?\s*(?:OF|IS|:)?\s*(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)|(?:USD|EUR|GBP)\s*(\d+(?:\.\d{2})?)\s*(?:PER|FOR EACH)?\s*DISCREPA[A-Z]*)/i);
  let discAmt = 0;
  let discStr = '';

  if (discFeeMatch) {
    discStr = discFeeMatch[1] || discFeeMatch[2];
    discAmt = parseFloat(discStr);
  }

  // Also check for payment charges
  const payFeeMatch = normalizedText.match(/(?:PAYMENT|REIMBURSEMENT)\s*(?:CHARGE|COMMISSION|FEE)\s*(?:OF|IS|:)?\s*(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)/i);
  let payStr = '';
  if (payFeeMatch) {
    payStr = payFeeMatch[1];
  }

  if (discAmt > 30 || parseFloat(payStr || '0') > 30) {
    issues.push({
      id: 'issue_discrepancy_revision',
      correctionId: 'discrepancy_payment_charges_revision',
      title: 'Excessive Discrepancy / Payment Charges',
      severity: 'warning',
      reason: `The LC states discrepancy fee of USD ${discStr || '75.00'} (and payment charge USD ${payStr || '50.00'}), which is significantly above the acceptable standard (USD 25.00 / 25.00).`,
      detectedText: extractSnippet(normalizedText, /DISCREPA[^\n.]{0,100}/i) || undefined,
      suggestedDetails: {
        discrepancyChargeInLc: discStr || '75.00',
        paymentChargeInLc: payStr || '50.00',
        acceptableDiscrepancyCharge: '25.00',
        acceptablePaymentCharge: '25.00'
      }
    });
  }

  // ==========================================
  // RULE 3: Acceptance After Physical Receipt – Delete
  // ==========================================
  if (
    upper.includes('PHYSICAL RECEIPT') ||
    upper.includes('RECEIPT OF GOODS') ||
    upper.includes('CUSTOMS CLEARANCE') && upper.includes('ACCEPTANCE')
  ) {
    const snippet = extractSnippet(normalizedText, /(?:PHYSICAL RECEIPT|RECEIPT OF GOODS)[^\n.]{0,100}/i);
    issues.push({
      id: 'issue_physical_receipt',
      correctionId: 'acceptance_after_receipt_deletion',
      title: 'Acceptance After Physical Receipt Clause (Violates UCP 600)',
      severity: 'critical',
      reason: 'Bill acceptance cannot be made conditional upon physical arrival or inspection of goods. Under UCP 600, payment/acceptance must be strictly against compliant documents.',
      detectedText: snippet
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
      severity: 'warning',
      reason: 'Clauses mandating an inspection or verification report signed by applicant bank officials introduce serious document negotiation delays.',
      detectedText: snippet
    });
  }

  // ==========================================
  // RULE 5: Applicant Inspection Certificate Removal
  // ==========================================
  if (
    upper.includes('APPLICANT\'S INSPECTION CERTIFICATE') ||
    upper.includes('APPLICANTS INSPECTION CERTIFICATE') ||
    upper.includes('BUYER\'S INSPECTION CERTIFICATE') ||
    upper.includes('CERTIFICATE SIGNED BY APPLICANT') ||
    upper.includes('CERTIFICATE SIGNED BY BUYER')
  ) {
    const snippet = extractSnippet(normalizedText, /(?:APPLICANT|BUYER)['S ]*INSPECTION CERTIFICATE/i);
    issues.push({
      id: 'issue_applicant_certificate',
      correctionId: 'physical_verification_clause',
      title: 'Applicant Inspection Certificate Removal',
      severity: 'critical',
      reason: 'Requiring an inspection certificate signed by the buyer/applicant allows the buyer to withhold approval and block payment at will.',
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
  if (
    upper.includes('FUND TRANSFER') &&
    (upper.includes('DEDUCTED') || upper.includes('BENEFICIARY') || upper.includes('TIME OF PAYMENT'))
  ) {
    const fundSnippet = extractSnippet(normalizedText, /DEDUCTED\s*FUND\s*TRANSFER\s*CHARGES[^\n.]{0,100}/i) ||
                         extractSnippet(normalizedText, /FUND\s*TRANSFER\s*CHARGES[^\n.]{0,100}/i);
    issues.push({
      id: 'issue_fund_transfer_charges',
      correctionId: 'fund_transfer_charges',
      title: 'Fund Transfer Charges Deducted at Payment Time',
      severity: 'warning',
      reason: 'The LC mentions deducting fund transfer charges from payment proceeds. Fund transfer / remittance charges must be capped or borne by the applicant.',
      detectedText: fundSnippet || 'Deducted fund transfer charges at the time of payment.'
    });
  }

  // ==========================================
  // RULE 7C: Draft Tenor & Payment Clause Check (Field 42C / F42C)
  // ==========================================
  const tenorMatch = normalizedText.match(/(?:F42C:[^\n]*Drafts[^\n]*|:42C:)[^\n:]*[:#]?\s*([^\n]+(?:\n[^\n]+)?)/i);
  if (tenorMatch) {
    const tenorText = tenorMatch[1].replace(/\s+/g, ' ').trim();
    // If deferred tenor (like 120 days from acceptance)
    if (/\b(?:60|90|120|150|180)\s*DAYS\b/i.test(tenorText)) {
      issues.push({
        id: 'issue_draft_tenor',
        correctionId: 'draft_tenor_correction',
        title: `Deferred Payment Tenor Detected (${tenorText})`,
        severity: 'info',
        reason: `LC specifies deferred payment tenor: "${tenorText}". Verify if this matches your agreed Proforma Invoice (PI) terms (e.g. At Sight vs 120 Days).`,
        detectedText: `Drafts at: ${tenorText}`,
        suggestedDetails: {
          currentTenor: tenorText
        }
      });
    }
  }

  // ==========================================
  // RULE 8: Beneficiary Name Check (Field 59)
  // ==========================================
  if (settings?.companyName && detectedBeneficiary) {
    const expected = settings.companyName.trim().toUpperCase();
    const actual = detectedBeneficiary.toUpperCase();
    // If not included and diff is noticeable
    if (!actual.includes(expected.split(' ')[0])) {
      issues.push({
        id: 'issue_beneficiary_name',
        correctionId: 'beneficiary_name_correction',
        title: 'Beneficiary Legal Name Discrepancy',
        severity: 'warning',
        reason: `Beneficiary name detected in Field 59 does not seem to match your company profile: "${settings.companyName}".`,
        detectedText: detectedBeneficiary.split('\n')[0],
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
  // SWIFT Tag 32B or F32B (handling format like: Currency: USD Amount: 54450,00)
  const match32B = text.match(/(?::32B:|F32B:[^\n]*Currency[^\n]*)\s*(?:Currency:)?\s*([A-Z]{3})[\s\S]{0,60}?(?:Amount:\s*)?([0-9,.]+)/i);
  if (match32B) {
    return {
      currency: match32B[1].toUpperCase(),
      amount: match32B[2].trim()
    };
  }

  const matchLabel = text.match(/(?:LC\s*AMOUNT|AMOUNT)\s*[:#]?\s*([A-Z]{3})\s*([0-9,.]+)/i);
  if (matchLabel) {
    return {
      currency: matchLabel[1].toUpperCase(),
      amount: matchLabel[2].trim()
    };
  }

  return {};
}

function extractParty(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  if (!match) return undefined;
  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith(':'))
    .join(', ');
}

function extractSnippet(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  if (!match) return undefined;
  const raw = match[0].replace(/\s+/g, ' ').trim();
  return raw.length > 120 ? raw.substring(0, 117) + '...' : raw;
}
