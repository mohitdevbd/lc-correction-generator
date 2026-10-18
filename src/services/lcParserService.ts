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
    const pageString = textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
    pageTexts.push(pageString);
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
  const detectedIssueDate = extractDate(normalizedText, /(?:31C|ISSUE\s*DATE|DATE\s*OF\s*ISSUE)[^\n:]*[:#]?\s*([0-9A-Za-z\/\-\. ]{6,15})/i);
  const detectedExpiryDate = extractDate(normalizedText, /(?:31D|EXPIRY\s*DATE|DATE\s*OF\s*EXPIRY)[^\n:]*[:#]?\s*([0-9A-Za-z\/\-\. ]{6,15})/i);
  const detectedShipmentDate = extractDate(normalizedText, /(?:44C|LATEST\s*SHIPMENT|SHIPMENT\s*DATE|LATEST\s*DATE\s*OF\s*SHIPMENT)[^\n:]*[:#]?\s*([0-9A-Za-z\/\-\. ]{6,15})/i);
  
  // Extract currency and amount
  const { currency: detectedCurrency, amount: detectedAmount } = extractAmount(normalizedText);

  // Extract Beneficiary and Applicant
  const detectedBeneficiary = extractParty(normalizedText, /(?:59|BENEFICIARY)[^\n:]*[:#]?\s*\n?([^\n]+(?:\n[^\n]+){1,3})/i);
  const detectedApplicant = extractParty(normalizedText, /(?:50|APPLICANT)[^\n:]*[:#]?\s*\n?([^\n]+(?:\n[^\n]+){1,3})/i);

  const issues: LcAuditIssue[] = [];

  // ==========================================
  // RULE 1: Field 71D – Genuinely Problematic Charges on Beneficiary
  // ==========================================
  // STANDARD & ACCEPTABLE (do NOT flag):
  //   "ALL BANKING CHARGES OUTSIDE ISSUING BANK'S COUNTER ARE FOR ACCOUNT OF BENEFICIARY"
  //   This simply means the beneficiary pays their own bank's (advising/negotiating) fees — normal UCP 600 practice.
  //
  // PROBLEMATIC (flag these):
  //   A) No "OUTSIDE ISSUING" qualifier → issuing bank charges also on beneficiary
  //   B) "ALL CHARGES ... BENEFICIARY" without qualification
  //   C) "REIMBURSEMENT BANK CHARGES FOR BENEFICIARY" → third-country charges on beneficiary
  //   D) "OUR CHARGES FOR BENEFICIARY" (issuing bank explicitly charging beneficiary)

  const chargesMatch = normalizedText.match(/(?:71D|71B)[^\n:]*[:#]?\s*([\s\S]{1,500}?)(?=(?:\n:\d{2}[A-Z]?:|\n\s*[A-Z\s]{4,}:|$))/i);
  const chargesBlock = chargesMatch ? chargesMatch[1].toUpperCase() : '';

  if (chargesBlock) {
    const hasOutsideIssuingQualifier =
      chargesBlock.includes('OUTSIDE ISSUING') ||
      chargesBlock.includes('OUTSIDE THE ISSUING') ||
      chargesBlock.includes('OUTSIDE ISSUING BANK') ||
      chargesBlock.includes("OUTSIDE ISSUING BANK'S");

    const hasBeneficiaryCharge =
      chargesBlock.includes('FOR ACCOUNT OF BENEFICIARY') ||
      chargesBlock.includes("FOR BENEFICIARY'S ACCOUNT") ||
      chargesBlock.includes('FOR BENEFICIARY ACCOUNT') ||
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
      const snippet = extractSnippet(normalizedText, /(?:ALL CHARGES|REIMBURS|OUR CHARGES)[^\n.]{0,100}BENEFICIARY/i);
      issues.push({
        id: 'issue_clause_71d',
        correctionId: 'clause_71d_bank_charges',
        title: 'Clause 71D – Issuing/Reimbursement Bank Charges on Beneficiary',
        severity: 'critical',
        reason: hasReimbursementOnBeneficiary
          ? 'Reimbursement bank charges (third-country correspondent) are being placed on the beneficiary. These must be on the applicant\'s account.'
          : hasOurChargesOnBeneficiary
          ? 'The issuing bank\'s own charges are being placed on the beneficiary, which is not standard practice.'
          : 'All banking charges (without "outside issuing bank" qualifier) are on the beneficiary. Please amend Field 71D so charges outside Bangladesh are on the applicant\'s account.',
        detectedText: snippet
      });
    }
    // NOTE: "ALL BANKING CHARGES OUTSIDE ISSUING BANK'S COUNTER FOR ACCOUNT OF BENEFICIARY"
    // is STANDARD UCP 600 practice — beneficiary pays their own advising/negotiating bank fees.
    // This is NOT flagged.
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
  // RULE 6: Short Presentation Period Check
  // ==========================================
  const presMatch = normalizedText.match(/(?:48|PERIOD\s*FOR\s*PRESENTATION)[^\n:]*[:#]?\s*([0-9]{1,2})\s*DAYS/i);
  if (presMatch) {
    const days = parseInt(presMatch[1], 10);
    if (days < 15) {
      issues.push({
        id: 'issue_presentation_period',
        correctionId: 'other_correction',
        title: `Short Presentation Period (${days} Days)`,
        severity: 'warning',
        reason: `The presentation period is set to only ${days} days from shipment date. Due to document handling and courier transit, at least 15 to 21 days are recommended.`,
        detectedText: `Period for presentation: ${days} days`,
        suggestedDetails: {
          customCorrectionText: `Please amend the presentation period in Field 48 to 21 days from the date of the transport document instead of ${days} days.`
        }
      });
    }
  }

  // ==========================================
  // RULE 7: Gap between Latest Shipment Date & Expiry Date
  // ==========================================
  if (detectedShipmentDate && detectedExpiryDate) {
    const parsedShipment = parseFlexibleDate(detectedShipmentDate);
    const parsedExpiry = parseFlexibleDate(detectedExpiryDate);
    if (parsedShipment && parsedExpiry) {
      const diffMs = parsedExpiry.getTime() - parsedShipment.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 15 && diffDays >= 0) {
        issues.push({
          id: 'issue_expiry_gap',
          correctionId: 'expiry_date_extension',
          title: `Insufficient Expiry Gap (${diffDays} Days After Shipment)`,
          severity: 'critical',
          reason: `LC expires only ${diffDays} days after the latest shipment date (${detectedShipmentDate}). Expiry date should be at least 15-21 days after shipment date to allow timely banking presentation.`,
          detectedText: `Shipment: ${detectedShipmentDate}, Expiry: ${detectedExpiryDate}`,
          suggestedDetails: {
            currentShipmentDate: detectedShipmentDate,
            currentExpiryDate: detectedExpiryDate
          }
        });
      }
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
  // SWIFT Tag 20
  const match20 = text.match(/:20:\s*([A-Za-z0-9\-\/]{4,30})/);
  if (match20) return match20[1].trim();

  // Label patterns
  const matchLabel = text.match(/(?:DOCUMENTARY\s*CREDIT\s*NUMBER|CREDIT\s*NUMBER|L\/C\s*NO\.?|LC\s*NO\.?)\s*[:#]?\s*([A-Za-z0-9\-\/]{4,30})/i);
  if (matchLabel) return matchLabel[1].trim();

  return undefined;
}

function extractDate(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  if (!match) return undefined;
  const rawDate = match[1].trim().split(/\s+/)[0];
  
  // Format YYMMDD (e.g. 261015 -> 15/10/2026 or 2026-10-15)
  if (/^\d{6}$/.test(rawDate)) {
    const year = '20' + rawDate.substring(0, 2);
    const month = rawDate.substring(2, 4);
    const day = rawDate.substring(4, 6);
    return `${day}/${month}/${year}`;
  }
  return rawDate;
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
  const timestamp = Date.parse(dateStr);
  return isNaN(timestamp) ? null : new Date(timestamp);
}

function extractAmount(text: string): { currency?: string; amount?: string } {
  // SWIFT Tag 32B (e.g. :32B:USD125000,00 or :32B: USD 125,000.00)
  const match32B = text.match(/:32B:\s*([A-Z]{3})\s*([0-9,.]+)/i);
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
