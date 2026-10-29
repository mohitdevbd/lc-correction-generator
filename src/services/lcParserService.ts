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
  // RULE 2: Discrepancy Fee & Payment/Settlement/Reimbursement/RTGS Charges Audit
  // ==========================================
  // 1. DISCREPANCY FEE AUDIT:
  //    - Maximum acceptable limit is USD 25.00.
  //    - If slab exists (e.g. Bank Asia: <15k vs >=15k), checks applicable fee based on LC amount.
  //    - If fee > 25, flag it.
  //    - If no discrepancy fee clause is found in LC, flag to request a discrepancy cap clause.
  const numericLcAmount = detectedAmount ? parseFloat(detectedAmount.replace(/,/g, '')) : 0;
  let discAmt = 0;
  let discStr = '';

  const discIndex = normalizedText.search(/DISCREPA/i);
  if (discIndex !== -1) {
    const clauseSnippet = normalizedText.substring(discIndex, discIndex + 300);

    // Check for tiered discrepancy clause with slab threshold (e.g. 15,000 / 20,000)
    const tieredMatch = clauseSnippet.match(/USD\s*(\d+(?:\.\d{2})?)[^\n.]*?LESS\s+THAN[^\n.]*?(\d{1,3}(?:,\d{3})*|\d+)[^\n.]*?AND\s+(?:USD)?\s*(\d+(?:\.\d{2})?)/i);
    if (tieredMatch) {
      const lowerFee = parseFloat(tieredMatch[1]);
      const threshold = parseFloat(tieredMatch[2].replace(/,/g, ''));
      const higherFee = parseFloat(tieredMatch[3]);
      if (numericLcAmount >= threshold && numericLcAmount > 0) {
        discAmt = higherFee;
        discStr = higherFee.toFixed(2);
      } else {
        discAmt = lowerFee;
        discStr = lowerFee.toFixed(2);
      }
    } else {
      // Find candidate discrepancy fee numbers like USD 30.00, USD 50.00, USD 100.00 (excluding threshold figures)
      const feeMatches = [...clauseSnippet.matchAll(/(?:USD|EUR|GBP)?\s*(\d{2,3}(?:\.\d{2})?)\b(?!\s*,\s*000|\s*000)/gi)];
      const candidateFees = feeMatches
        .map(m => parseFloat(m[1]))
        .filter(f => f >= 10 && f <= 350);

      if (candidateFees.length > 0) {
        discAmt = Math.max(...candidateFees);
        discStr = discAmt.toFixed(2);
      }
    }

    // Flag if discrepancy charge > 25.00
    if (discAmt > 25) {
      issues.push({
        id: 'issue_excessive_discrepancy_fee',
        correctionId: 'discrepancy_charges',
        title: `Excessive Discrepancy Fee (USD ${discStr})`,
        severity: 'warning',
        reason: `The discrepancy fee in the LC is USD ${discStr}, which exceeds the standard acceptable limit of USD 25.00.`,
        detectedText: extractSnippet(normalizedText, /DISCREPANCY\s+(?:FEE|CHARGE)[^\n.]{0,100}/i) || `Discrepancy fee: USD ${discStr}`,
        suggestedDetails: {
          discrepancyChargeInLc: discStr,
          acceptableDiscrepancyCharge: '25.00',
          maxChargeAmount: '25.00'
        }
      });
    }
  } else {
    // No discrepancy fee clause found at all in LC -> Request standard discrepancy clause capped at USD 25.00
    issues.push({
      id: 'issue_missing_discrepancy_clause',
      correctionId: 'discrepancy_charges',
      title: 'Missing Discrepancy Fee Clause (Uncapped Risk)',
      severity: 'info',
      reason: 'No discrepancy handling fee clause is defined in the LC. It is recommended to specify that discrepancy charges, if any, shall not exceed USD 25.00.',
      suggestedDetails: {
        maxChargeAmount: '25.00',
        acceptableDiscrepancyCharge: '25.00'
      }
    });
  }

  // 2. PAYMENT / REIMBURSEMENT / SETTLEMENT / FUND TRANSFER / RTGS CHARGES AUDIT:
  //    - These fees can be in Field 47A, 71D, 78, etc.
  //    - Total of these charges cannot exceed USD 25.00.
  //    - If fee > USD 25.00 but paid by APPLICANT/BUYER, do NOT flag.
  //    - If slab exists (e.g. Eastern Bank: <=20k is $25, >20k is $50), evaluate based on LC amount.
  //    - If NONE of these charges exist in LC, flag to request clear limit so bank cannot arbitrarily deduct.
  const paymentFeeRegex = /(?:PAYMENT|REIMBURSEMENT|SETTLEMENT|FUND\s*TRANSFER|RTGS)\s*(?:CHARGE|COMMISSION|FEE)[S]?/i;
  const hasAnyPaymentFeeMention = paymentFeeRegex.test(normalizedText) ||
                                  /DEDUCT\s+(?:PAYMENT|SETTLEMENT|REIMBURSEMENT)\s+CHARGE/i.test(normalizedText);

  if (hasAnyPaymentFeeMention) {
    // Extract candidate snippets around payment/settlement charges
    const paymentSnippets: string[] = [];
    const paymentRegexGlobal = /(?:(?:WE\s+WILL\s+DEDUCT\s+)?(?:PAYMENT|REIMBURSEMENT|SETTLEMENT|FUND\s*TRANSFER|RTGS)\s*(?:PROCESSING\s*)?(?:CHARGE|COMMISSION|FEE)[S]?[^\n.]*)/gi;
    let pMatch;
    while ((pMatch = paymentRegexGlobal.exec(normalizedText)) !== null) {
      paymentSnippets.push(pMatch[0].trim());
    }

    let totalPaymentFeeBeneficiary = 0;
    const detectedPaymentFees: Array<{ type: string; amount: number; text: string }> = [];
    let isBorneByApplicant = false;

    for (const snippet of paymentSnippets) {
      const upperSnippet = snippet.toUpperCase();
      // Check if this specific charge is explicitly for applicant's account
      if (
        upperSnippet.includes("APPLICANT'S ACCOUNT") ||
        upperSnippet.includes("FOR APPLICANT ACCOUNT") ||
        upperSnippet.includes("FOR ACCOUNT OF APPLICANT") ||
        upperSnippet.includes("BORNE BY APPLICANT") ||
        upperSnippet.includes("BUYER'S ACCOUNT")
      ) {
        isBorneByApplicant = true;
        continue;
      }

      // Check tiered slab in payment snippet (e.g. EBL: USD 25 for <= 20,000 and USD 50 for > 20,000)
      const tieredPaymentMatch = snippet.match(/USD\s*(\d+(?:\.\d{2})?)[^\n.]*?UP\s+TO[^\n.]*?(\d{1,3}(?:,\d{3})*|\d+)[^\n.]*?AND\s+(?:USD)?\s*(\d+(?:\.\d{2})?)/i);
      if (tieredPaymentMatch) {
        const lowerFee = parseFloat(tieredPaymentMatch[1]);
        const threshold = parseFloat(tieredPaymentMatch[2].replace(/,/g, ''));
        const higherFee = parseFloat(tieredPaymentMatch[3]);
        const applicableFee = (numericLcAmount > threshold && numericLcAmount > 0) ? higherFee : lowerFee;
        totalPaymentFeeBeneficiary += applicableFee;
        detectedPaymentFees.push({ type: 'Tiered Payment Charge', amount: applicableFee, text: snippet });
      } else {
        // Individual fee amount
        const amountMatch = snippet.match(/(?:USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)/i);
        if (amountMatch) {
          const fee = parseFloat(amountMatch[1]);
          if (fee > 0 && fee <= 300) {
            totalPaymentFeeBeneficiary += fee;
            detectedPaymentFees.push({ type: 'Charge', amount: fee, text: snippet });
          }
        }
      }
    }

    // Also check Field 78 direct payment deduction statement e.g. Bank Asia: USD 30
    const f78DeductMatch = normalizedText.match(/DEDUCT\s+PAYMENT\s+CHARGE\s+(?:USD)?\s*(\d+(?:\.\d{2})?)/i);
    if (f78DeductMatch && !detectedPaymentFees.some(f => f.amount === parseFloat(f78DeductMatch[1]))) {
      const f78Amt = parseFloat(f78DeductMatch[1]);
      totalPaymentFeeBeneficiary += f78Amt;
      detectedPaymentFees.push({ type: 'Field 78 Payment Deduction', amount: f78Amt, text: f78DeductMatch[0] });
    }

    // If total fees on beneficiary exceed USD 25.00 (and not borne by applicant)
    if (totalPaymentFeeBeneficiary > 25 && !isBorneByApplicant) {
      const feesBreakdown = detectedPaymentFees.map(f => `USD ${f.amount.toFixed(2)}`).join(' + ');
      issues.push({
        id: 'issue_payment_charges_limit_exceeded',
        correctionId: 'payment_processing_charges',
        title: `Payment / Settlement Charges Exceed USD 25.00 (Total: USD ${totalPaymentFeeBeneficiary.toFixed(2)})`,
        severity: 'warning',
        reason: `Payment/settlement/reimbursement charges in the LC total USD ${totalPaymentFeeBeneficiary.toFixed(2)} (${feesBreakdown}), which exceeds the allowable limit of USD 25.00. These charges must be capped at USD 25.00 in total or borne by the applicant.`,
        detectedText: detectedPaymentFees[0]?.text || `Total charges: USD ${totalPaymentFeeBeneficiary.toFixed(2)}`,
        suggestedDetails: {
          paymentChargeInLc: totalPaymentFeeBeneficiary.toFixed(2),
          acceptablePaymentCharge: '25.00',
          maxChargeAmount: '25.00'
        }
      });
    }
  } else {
    // If no Payment / Fund Transfer / Settlement charge clause exists at all, request a ceiling clause
    issues.push({
      id: 'issue_missing_payment_charge_clause',
      correctionId: 'total_bank_charges_limit',
      title: 'Missing Payment / Bank Charge Ceiling Clause',
      severity: 'info',
      reason: 'The LC does not define specific caps for payment, settlement, or fund transfer charges. To prevent unexpected banking deductions at maturity, specify an overall charge ceiling of USD 25.00.',
      suggestedDetails: {
        maxChargeAmount: '25.00'
      }
    });
  }

  // ==========================================
  // RULE 3: Acceptance After Physical Receipt – Delete
  // ==========================================

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
  // RULE 7D: Unspecified / Open-Ended Discrepancy & Payment Charges (Field 71D)
  // ==========================================
  // In many LCs (like UCB, Jamuna, etc.), Field 71D says:
  // "ALL CHARGES OUTSIDE OUR COUNTER INCLUDING PAYMENT CHARGE AND DISCREPANCY CHARGE ARE ON BENEFICIARY'S ACCOUNT"
  // without specifying the exact dollar limit (e.g., USD 25.00). This allows the bank to deduct arbitrary or high fees.
  if (
    chargesBlock &&
    (chargesBlock.includes('DISCREPANCY') || chargesBlock.includes('PAYMENT CHARGE')) &&
    !discStr && !hasAnyPaymentFeeMention
  ) {
    const unspecSnippet = extractSnippet(normalizedText, /(?:INCLUDING|AND)[\s\S]{0,80}(?:PAYMENT|DISCREPANCY)[\s\S]{0,80}BENEFICIARY/i) ||
                          extractSnippet(normalizedText, /:71D:[\s\S]{0,120}/i);
    issues.push({
      id: 'issue_unspecified_charges',
      correctionId: 'discrepancy_payment_charges_revision',
      title: 'Uncapped Discrepancy & Payment Charges in Field 71D',
      severity: 'warning',
      reason: 'Field 71D places Payment & Discrepancy charges on the Beneficiary without defining acceptable limits. They must be capped at standard rates (e.g., USD 25.00 for discrepancy & USD 25.00 for payment).',
      detectedText: unspecSnippet || 'Payment charge and discrepancy charge are on beneficiary account without fixed amount.',
      suggestedDetails: {
        discrepancyChargeInLc: 'Unspecified',
        paymentChargeInLc: 'Unspecified',
        acceptableDiscrepancyCharge: '25.00',
        acceptablePaymentCharge: '25.00'
      }
    });
  }

  // ==========================================
  // RULE 7E: Missing Overdue Interest Clause & Usance Interest (SOFR/LIBOR) Alert
  // ==========================================
  // For Usance/Deferred LCs (e.g. 120 Days from acceptance, 120 Days Sight, etc.):
  // 1) If NO overdue clause exists -> Request Overdue Clause.
  // 2) If interest clause exists with SOFR/LIBOR rate -> Show Information / Review Alert (per user requirement).
  const isUsanceDeferred = /\b(?:30|60|90|120|150|180)\s*DAYS\b/i.test(normalizedText) ||
                           upper.includes('FROM THE DATE OF ACCEPTANCE') ||
                           upper.includes('AFTER ACCEPTANCE') ||
                           upper.includes('FROM THE DATE OF DELIVERY') ||
                           upper.includes('SIGHT FROM THE DATE');

  // Check if there is an actual Overdue clause in LC conditions (F47A or text)
  // Ignore footer metadata strings like "Delivery overdue warning request"
  const relevantLcBody = normalizedText.replace(/Delivery\s*overdue\s*warning\s*request/gi, '');
  const upperBody = relevantLcBody.toUpperCase();

  const hasOverdueClause = upperBody.includes('OVERDUE INTEREST') ||
                           upperBody.includes('OVERDUE CHARGE') ||
                           upperBody.includes('OVERDUE CLAUSE') ||
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
      severity: 'info',
      reason: 'The LC specifies interest payment tied to SOFR / LIBOR. Please verify with your agreed Proforma Invoice (PI) whether the interest rate, spread, and payer (Applicant vs Beneficiary) match your agreed commercial terms.',
      detectedText: interestSnippet || 'Interest benchmark (SOFR/LIBOR) detected in LC.'
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
