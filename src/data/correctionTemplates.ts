import type { CorrectionTemplate } from '../types';

export const CORRECTION_TEMPLATES: CorrectionTemplate[] = [
  {
    id: 'overdue_clause',
    title: 'Overdue Clause',
    category: 'clauses',
    shortDescription: 'Add overdue interest/charge clause as per agreed terms/PI',
    icon: 'ClockAlert',
    relevantFields: ['additionalNote'],
    emailTemplate: (details) => {
      if (details.additionalNote?.trim()) {
        return `Please add an overdue clause in the LC as follows: "${details.additionalNote.trim()}".`;
      }
      return 'Please add an overdue clause in the LC as per the agreed terms/PI.';
    },
    messageTemplate: (details) => {
      if (details.additionalNote?.trim()) {
        return `Add overdue clause (${details.additionalNote.trim()}).`;
      }
      return 'Add overdue clause as per agreed terms.';
    }
  },
  {
    id: 'payment_clause',
    title: 'Payment Clause',
    category: 'clauses',
    shortDescription: 'Specify payment terms, period, and conditions clearly in LC',
    icon: 'CreditCard',
    relevantFields: ['currentTenor', 'requiredTenor'],
    emailTemplate: (details) => {
      if (details.requiredTenor?.trim()) {
        return `Please add a payment clause in the LC as per the agreed terms/PI: "${details.requiredTenor.trim()}".`;
      }
      return 'Please add a payment clause in the LC as per the agreed terms/PI.';
    },
    messageTemplate: (details) => {
      if (details.requiredTenor?.trim()) {
        return `Add payment clause as per agreed terms/PI: ${details.requiredTenor.trim()}.`;
      }
      return 'Add payment clause in the LC as per the agreed terms/PI.';
    }
  },
  {
    id: 'fund_transfer_charges',
    title: 'Fund Transfer Charges',
    category: 'charges',
    shortDescription: 'Clarify fund transfer & remittance charges deduction',
    icon: 'ArrowRightLeft',
    relevantFields: ['maxChargeAmount', 'currency'],
    emailTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.maxChargeAmount?.trim()) {
        return `Please clearly specify in the LC the applicable fund transfer charges. The deduction should not exceed ${curr} ${details.maxChargeAmount.trim()}.`;
      }
      return 'Please clearly specify in the LC the applicable fund transfer charges to be deducted.';
    },
    messageTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.maxChargeAmount?.trim()) {
        return `Fund transfer charges must not exceed ${curr} ${details.maxChargeAmount.trim()}.`;
      }
      return 'Clearly specify applicable fund transfer charges in LC.';
    }
  },
  {
    id: 'discrepancy_charges',
    title: 'Discrepancy Charges',
    category: 'charges',
    shortDescription: 'Limit discrepancy fee and reject excessive deductions',
    icon: 'ShieldAlert',
    relevantFields: ['maxChargeAmount', 'currency'],
    emailTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.maxChargeAmount?.trim()) {
        return `The discrepancy handling charge should not exceed ${curr} ${details.maxChargeAmount.trim()}. Charges exceeding this agreed limit will not be acceptable.`;
      }
      return 'Please specify the discrepancy handling charges in the LC. Charges exceeding the agreed limit will not be acceptable.';
    },
    messageTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.maxChargeAmount?.trim()) {
        return `Discrepancy charge must not exceed ${curr} ${details.maxChargeAmount.trim()}.`;
      }
      return 'Limit discrepancy handling charges as per agreed rate.';
    }
  },
  {
    id: 'payment_processing_charges',
    title: 'Payment Processing Charges',
    category: 'charges',
    shortDescription: 'Cap payment handling & reimbursement commissions',
    icon: 'Receipt',
    relevantFields: ['maxChargeAmount', 'currency'],
    emailTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.maxChargeAmount?.trim()) {
        return `The payment processing charge should not exceed ${curr} ${details.maxChargeAmount.trim()}.`;
      }
      return 'Please specify that payment processing charges should be for the account of the applicant or strictly limited as agreed.';
    },
    messageTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.maxChargeAmount?.trim()) {
        return `Payment processing fee limit: ${curr} ${details.maxChargeAmount.trim()}.`;
      }
      return 'Specify payment processing charge limit.';
    }
  },
  {
    id: 'total_bank_charges_limit',
    title: 'Total Bank Charges Limit',
    category: 'charges',
    shortDescription: 'Cap all cumulative bank deductions and handling fees',
    icon: 'Coins',
    relevantFields: ['maxChargeAmount', 'currency'],
    emailTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.maxChargeAmount?.trim()) {
        return `The total amount of all applicable bank charges, including discrepancy handling, reimbursement commission, payment charges, and any other bill deductions, should not exceed ${curr} ${details.maxChargeAmount.trim()} in total.`;
      }
      return 'The total amount of all applicable bank charges, including discrepancy handling, reimbursement commission, payment charges, and any other bill deductions, should not exceed the agreed ceiling amount in total.';
    },
    messageTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.maxChargeAmount?.trim()) {
        return `Cap total bank charges (discrepancy, reimbursement, payment) at max ${curr} ${details.maxChargeAmount.trim()}.`;
      }
      return 'Add overall ceiling clause for total bank charges.';
    }
  },
  {
    id: 'clause_71d_bank_charges',
    title: 'Clause 71D – Bank Charges',
    category: 'charges',
    shortDescription: 'Outside Bangladesh bank charges on applicant account',
    icon: 'Building2',
    relevantFields: ['maxChargeAmount'],
    emailTemplate: () => {
      return `Please amend Field 71D to read as: "All banking charges outside Bangladesh are for applicant's account." Beneficiary will bear only standard discrepancy and payment charges. All other bank charges are on applicant's account.`;
    },
    messageTemplate: () => {
      return `Amend Field 71D: all charges outside Bangladesh on applicant's account.`;
    }
  },
  {
    id: 'discrepancy_payment_charges_revision',
    title: 'Discrepancy & Payment Charges Revision',
    category: 'charges',
    shortDescription: 'Revise excessive discrepancy & payment charges (e.g. USD 25 & 25)',
    icon: 'Receipt',
    relevantFields: ['discrepancyChargeInLc', 'paymentChargeInLc', 'acceptableDiscrepancyCharge', 'acceptablePaymentCharge'],
    emailTemplate: (details) => {
      const discInLc = details.discrepancyChargeInLc?.trim();
      const payInLc = details.paymentChargeInLc?.trim();
      const accDisc = details.acceptableDiscrepancyCharge?.trim() || '25.00';
      const accPay = details.acceptablePaymentCharge?.trim() || '25.00';

      // Case 1: Open-ended / Uncapped charges in Field 71D (no specific amount mentioned in LC)
      if (discInLc === 'Unspecified' || payInLc === 'Unspecified') {
        return `Please specify and cap the discrepancy and payment charges in Field 71D. Currently, these charges are placed on beneficiary account without any defined limits. The acceptable limits must not exceed USD ${accDisc} for discrepancy handling and USD ${accPay} for payment processing.`;
      }

      // Case 2: Specific amounts in LC
      if (discInLc && payInLc) {
        return `We request that you revise the discrepancy and payment charge clauses. Your discrepancy charge of USD ${discInLc} and Payment charge of USD ${payInLc} are higher than what we can accept. Our acceptable charges are USD ${accDisc} for discrepancies and USD ${accPay} for payment.`;
      }

      if (discInLc) {
        return `We request that you revise the discrepancy charge clause. Your discrepancy charge of USD ${discInLc} is higher than what we can accept. Our acceptable charge is USD ${accDisc} for discrepancies.`;
      }

      if (payInLc) {
        return `We request that you revise the payment charge clause. Your payment charge of USD ${payInLc} is higher than what we can accept. Our acceptable charge is USD ${accPay} for payment processing.`;
      }

      return `Please clearly cap the discrepancy and payment charges in the LC to not exceed USD ${accDisc} for discrepancies and USD ${accPay} for payment charges.`;
    },
    messageTemplate: (details) => {
      const accDisc = details.acceptableDiscrepancyCharge?.trim() || '25.00';
      const accPay = details.acceptablePaymentCharge?.trim() || '25.00';
      return `Revise charges to acceptable limits: max USD ${accDisc} for discrepancy and USD ${accPay} for payment.`;
    }
  },
  {
    id: 'official_bank_confirmation',
    title: 'Official Bank Confirmation',
    category: 'compliance',
    shortDescription: 'Demand official banking swift advice/charge breakdown',
    icon: 'Building2',
    relevantFields: ['bankName'],
    emailTemplate: (details) => {
      const bank = details.bankName?.trim() ? ` from ${details.bankName.trim()}` : ' from the bank';
      return `Please provide official confirmation/copy${bank} confirming the applicable charges. Email or verbal confirmation will not be sufficient.`;
    },
    messageTemplate: (details) => {
      const bank = details.bankName?.trim() ? ` from ${details.bankName.trim()}` : '';
      return `Provide official bank confirmation copy${bank} regarding applicable charges.`;
    }
  },
  {
    id: 'lc_value_mismatch',
    title: 'PI vs LC Value Mismatch',
    category: 'pi_details',
    shortDescription: 'Correct LC amount to correspond with approved PI value',
    icon: 'BadgeDollarSign',
    relevantFields: ['currentLcValue', 'targetPiValue', 'currency'],
    emailTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.currentLcValue?.trim() && details.targetPiValue?.trim()) {
        return `The LC value currently indicates ${curr} ${details.currentLcValue.trim()}, whereas the PI value is ${curr} ${details.targetPiValue.trim()}. Please amend the LC value to ${curr} ${details.targetPiValue.trim()} as per the applicable PI.`;
      }
      return 'The LC value does not match the PI. Please amend the LC value as per the PI.';
    },
    messageTemplate: (details, settings) => {
      const curr = details.currency || settings.defaultCurrency || 'USD';
      if (details.currentLcValue?.trim() && details.targetPiValue?.trim()) {
        return `Correct LC value from ${curr} ${details.currentLcValue.trim()} to ${curr} ${details.targetPiValue.trim()}.`;
      }
      return 'Amend LC value to match approved PI value.';
    }
  },
  {
    id: 'revised_pi_update',
    title: 'Revised PI Update',
    category: 'pi_details',
    shortDescription: 'Update LC terms and reference to latest revised PI',
    icon: 'FileText',
    relevantFields: ['revisedPiNumber', 'piDate'],
    emailTemplate: (details) => {
      if (details.revisedPiNumber?.trim()) {
        const dateStr = details.piDate?.trim() ? ` dated ${details.piDate.trim()}` : '';
        return `The LC was opened based on the previous PI. Please amend/update the LC according to revised PI No. ${details.revisedPiNumber.trim()}${dateStr}.`;
      }
      return 'The LC was opened based on the previous PI. Please amend/update the LC according to the revised PI.';
    },
    messageTemplate: (details) => {
      if (details.revisedPiNumber?.trim()) {
        return `Update LC as per revised PI No. ${details.revisedPiNumber.trim()}.`;
      }
      return 'Update LC terms and reference to match revised PI.';
    }
  },
  {
    id: 'hs_code_correction',
    title: 'HS Code Correction / Clarification',
    category: 'pi_details',
    shortDescription: 'Correct or verify product HS Code in Field 45A against PI',
    icon: 'Hash',
    relevantFields: ['hsCodeInLc', 'correctHsCode'],
    emailTemplate: (details) => {
      if (details.hsCodeInLc?.trim() && details.correctHsCode?.trim()) {
        return `The HS code (${details.hsCodeInLc.trim()}) stated in the LC is incorrect. Please amend the HS code to read: ${details.correctHsCode.trim()} as per our approved Proforma Invoice.`;
      }
      if (details.correctHsCode?.trim()) {
        return `Please correct/amend the HS code in the LC to read: ${details.correctHsCode.trim()} as per our approved Proforma Invoice.`;
      }
      if (details.hsCodeInLc?.trim()) {
        return `The HS code (${details.hsCodeInLc.trim()}) stated in the LC does not match our approved Proforma Invoice. Please verify and amend it accordingly.`;
      }
      return 'The HS code stated in the LC is incorrect. Please amend the HS code to reflect our approved Proforma Invoice.';
    },
    messageTemplate: (details) => {
      if (details.correctHsCode?.trim()) {
        return `Correct HS code in LC to: ${details.correctHsCode.trim()}.`;
      }
      return 'Correct HS code in LC as per PI.';
    }
  },
  {
    id: 'beneficiary_vat_bin_correction',
    title: 'Beneficiary VAT/BIN Correction',
    category: 'compliance',
    shortDescription: 'Fix incorrect beneficiary tax ID / VAT / BIN number',
    icon: 'FileCheck',
    relevantFields: ['oldVatBin', 'newVatBin'],
    emailTemplate: (details) => {
      if (details.oldVatBin?.trim() || details.newVatBin?.trim()) {
        const oldVal = details.oldVatBin?.trim() || '[OLD VAT/BIN]';
        const newVal = details.newVatBin?.trim() || '[NEW VAT/BIN]';
        return `Please correct the beneficiary VAT/BIN number in the LC as follows:\n      - Incorrect: ${oldVal}\n      - Correct: ${newVal}`;
      }
      return 'Please correct the beneficiary VAT/BIN number in the LC.';
    },
    messageTemplate: (details) => {
      if (details.newVatBin?.trim()) {
        return `Correct Beneficiary VAT/BIN to: ${details.newVatBin.trim()}.`;
      }
      return 'Correct beneficiary VAT/BIN number in LC.';
    }
  },
  {
    id: 'beneficiary_name_correction',
    title: 'Beneficiary Name Correction',
    category: 'compliance',
    shortDescription: 'Correct beneficiary registered company name in Field 59',
    icon: 'UserCheck',
    relevantFields: ['correctBeneficiaryName'],
    emailTemplate: (details) => {
      if (details.correctBeneficiaryName?.trim()) {
        return `Please correct the beneficiary legal name in Field 59 of the LC to read strictly as: "${details.correctBeneficiaryName.trim()}".`;
      }
      return 'Please correct the beneficiary legal name and address in Field 59 of the LC to strictly match our company registration documents.';
    },
    messageTemplate: (details) => {
      if (details.correctBeneficiaryName?.trim()) {
        return `Correct beneficiary legal name in Field 59 to: ${details.correctBeneficiaryName.trim()}.`;
      }
      return 'Correct beneficiary legal name in Field 59.';
    }
  },
  {
    id: 'shipment_date_extension',
    title: 'Shipment Date Extension',
    category: 'dates',
    shortDescription: 'Extend latest date of shipment (Field 44C)',
    icon: 'CalendarDays',
    relevantFields: ['currentShipmentDate', 'requiredShipmentDate'],
    emailTemplate: (details) => {
      if (details.requiredShipmentDate?.trim()) {
        return `Please extend the latest shipment date to ${details.requiredShipmentDate.trim()}.`;
      }
      return 'Please extend the latest shipment date in the LC.';
    },
    messageTemplate: (details) => {
      if (details.requiredShipmentDate?.trim()) {
        return `Extend latest shipment date to ${details.requiredShipmentDate.trim()}.`;
      }
      return 'Extend shipment date in LC.';
    }
  },
  {
    id: 'expiry_date_extension',
    title: 'Expiry Date Extension',
    category: 'dates',
    shortDescription: 'Extend LC expiry date & place of expiry (Field 31D)',
    icon: 'CalendarClock',
    relevantFields: ['currentExpiryDate', 'requiredExpiryDate'],
    emailTemplate: (details) => {
      if (details.requiredExpiryDate?.trim()) {
        return `Please extend the LC expiry date to ${details.requiredExpiryDate.trim()}.`;
      }
      return 'Please extend the LC expiry date in the LC.';
    },
    messageTemplate: (details) => {
      if (details.requiredExpiryDate?.trim()) {
        return `Extend LC expiry date to ${details.requiredExpiryDate.trim()}.`;
      }
      return 'Extend LC expiry date in LC.';
    }
  },
  {
    id: 'shipment_and_expiry_extension',
    title: 'Shipment & Expiry Date Extension',
    category: 'dates',
    shortDescription: 'Simultaneously extend both shipment date and expiry date',
    icon: 'CalendarRange',
    relevantFields: ['requiredShipmentDate', 'requiredExpiryDate'],
    emailTemplate: (details) => {
      if (details.requiredShipmentDate?.trim() && details.requiredExpiryDate?.trim()) {
        return `Please extend the latest shipment date to ${details.requiredShipmentDate.trim()} and the LC expiry date to ${details.requiredExpiryDate.trim()}.`;
      }
      if (details.requiredShipmentDate?.trim()) {
        return `Please extend the shipment date to ${details.requiredShipmentDate.trim()} and amend the expiry date accordingly.`;
      }
      return 'Please extend the shipment date and expiry date in the LC.';
    },
    messageTemplate: (details) => {
      if (details.requiredShipmentDate?.trim() && details.requiredExpiryDate?.trim()) {
        return `Extend shipment date to ${details.requiredShipmentDate.trim()} and LC expiry to ${details.requiredExpiryDate.trim()}.`;
      }
      return 'Extend shipment and expiry dates in LC.';
    }
  },
  {
    id: 'physical_verification_clause',
    title: 'Physical Verification Clause – Delete',
    category: 'clauses',
    shortDescription: 'Delete Clause 13 / physical goods verification conditions',
    icon: 'ShieldOff',
    relevantFields: ['clauseNumber', 'additionalNote'],
    emailTemplate: (details, _, allSelectedIds) => {
      const clauseNo = details.clauseNumber?.trim() || 'Clause 13';
      const hasAcceptance = allSelectedIds?.includes('acceptance_clause') || allSelectedIds?.includes('acceptance_after_receipt_deletion');
      if (hasAcceptance) {
        return `Please delete ${clauseNo} regarding physical verification. Acceptance should not be subject to physical receipt of goods or verification by the applicant's bank officials.`;
      }
      return `Please delete ${clauseNo} regarding physical verification. Payment/acceptance must be strictly against compliant documents as per UCP 600.`;
    },
    messageTemplate: (details) => {
      const clauseNo = details.clauseNumber?.trim() || 'Clause 13';
      return `Delete ${clauseNo} (physical verification condition).`;
    }
  },
  {
    id: 'bank_verification_report_deletion',
    title: 'Bank Verification Report Clause – Delete',
    category: 'clauses',
    shortDescription: 'Remove applicant bank officials verification requirement',
    icon: 'ShieldOff',
    relevantFields: ['additionalNote'],
    emailTemplate: () => {
      return `Please delete the clause requiring an inspection or verification report from the applicant's bank officials. Payment and acceptance must be strictly against compliant shipping documents as per UCP 600.`;
    },
    messageTemplate: () => {
      return `Delete applicant bank verification report clause.`;
    }
  },
  {
    id: 'acceptance_clause',
    title: 'Acceptance Clause Correction',
    category: 'clauses',
    shortDescription: 'Ensure acceptance is issued unconditionally upon compliant documents',
    icon: 'CheckCheck',
    relevantFields: ['additionalNote'],
    emailTemplate: () => {
      return 'Please amend the acceptance clause to confirm that acceptance and maturity acknowledgement shall be issued unconditionally upon receipt of compliant shipping documents, without being conditional upon customs clearance or physical goods inspection.';
    },
    messageTemplate: () => {
      return 'Amend acceptance condition to standard UCP 600 compliant document basis.';
    }
  },
  {
    id: 'acceptance_after_receipt_deletion',
    title: 'Acceptance After Physical Receipt – Delete',
    category: 'clauses',
    shortDescription: 'Remove condition requiring physical receipt prior to acceptance',
    icon: 'ShieldOff',
    relevantFields: ['additionalNote'],
    emailTemplate: () => {
      return 'Please remove the condition requiring physical receipt of goods prior to bill acceptance. In accordance with UCP 600, bill acceptance and maturity acknowledgement must be issued solely upon presentation of compliant documents.';
    },
    messageTemplate: () => {
      return 'Remove requirement of physical receipt of goods prior to acceptance.';
    }
  },
  {
    id: 'draft_tenor_correction',
    title: 'Tenor Correction',
    category: 'clauses',
    shortDescription: 'Align sight or deferred usance tenor with agreed PI',
    icon: 'Timer',
    relevantFields: ['currentTenor', 'requiredTenor'],
    emailTemplate: (details) => {
      if (details.currentTenor?.trim() && details.requiredTenor?.trim()) {
        return `The PI specifies payment at ${details.requiredTenor.trim()}, whereas the LC mentions a ${details.currentTenor.trim()} tenor. Please amend the LC draft tenor to reflect ${details.requiredTenor.trim()} as agreed.`;
      }
      if (details.requiredTenor?.trim()) {
        return `Please correct the tenor in the LC to read: ${details.requiredTenor.trim()} as per the agreed PI/payment terms.`;
      }
      return 'Please correct the tenor in the LC as per the agreed PI/payment terms.';
    },
    messageTemplate: (details) => {
      if (details.requiredTenor?.trim()) {
        return `Amend draft tenor to: ${details.requiredTenor.trim()}.`;
      }
      return 'Correct tenor to match agreed PI.';
    }
  },
  {
    id: 'quantity_and_unit_price',
    title: 'Quantity & Unit Price Correction',
    category: 'pi_details',
    shortDescription: 'Amend order quantity and unit price as per revised PI',
    icon: 'BadgeDollarSign',
    relevantFields: ['orderQuantity', 'unitPrice'],
    emailTemplate: (details) => {
      if (details.orderQuantity?.trim() && details.unitPrice?.trim()) {
        return `Please amend the order quantity to ${details.orderQuantity.trim()} and the unit price to ${details.unitPrice.trim()} as per the agreed Proforma Invoice.`;
      }
      if (details.orderQuantity?.trim()) {
        return `Please amend the order quantity in the LC to read: ${details.orderQuantity.trim()} as per the agreed Proforma Invoice.`;
      }
      if (details.unitPrice?.trim()) {
        return `Please amend the unit price in the LC to read: ${details.unitPrice.trim()} as per the agreed Proforma Invoice.`;
      }
      return 'Please correct the order quantity and unit price in the LC to strictly conform with the approved Proforma Invoice.';
    },
    messageTemplate: (details) => {
      if (details.orderQuantity?.trim()) {
        return `Amend order quantity to: ${details.orderQuantity.trim()}.`;
      }
      return 'Amend quantity and unit price as per PI.';
    }
  },
  {
    id: 'pi_number_correction',
    title: 'PI Number Correction',
    category: 'pi_details',
    shortDescription: 'Rectify typographic error in referenced PI Number',
    icon: 'Hash',
    relevantFields: ['piNumber', 'revisedPiNumber'],
    emailTemplate: (details) => {
      const correctPi = details.revisedPiNumber?.trim() || details.piNumber?.trim();
      if (correctPi) {
        return `Please correct the Proforma Invoice number in the LC to read: PI No. ${correctPi}.`;
      }
      return 'Please correct the Proforma Invoice number in the LC.';
    },
    messageTemplate: (details) => {
      const correctPi = details.revisedPiNumber?.trim() || details.piNumber?.trim();
      if (correctPi) {
        return `Correct PI number in LC to: ${correctPi}.`;
      }
      return 'Correct Proforma Invoice number in LC.';
    }
  },
  {
    id: 'pi_date_correction',
    title: 'PI Date Correction',
    category: 'pi_details',
    shortDescription: 'Fix incorrect or missing PI issuance date',
    icon: 'Calendar',
    relevantFields: ['piDate'],
    emailTemplate: (details) => {
      if (details.piDate?.trim()) {
        return `Please correct the PI date in the LC to read: ${details.piDate.trim()}.`;
      }
      return 'Please correct the Proforma Invoice (PI) issuance date referenced in the LC.';
    },
    messageTemplate: (details) => {
      if (details.piDate?.trim()) {
        return `Correct referenced PI date to: ${details.piDate.trim()}.`;
      }
      return 'Correct referenced PI date in LC.';
    }
  },
  {
    id: 'pi_description_correction',
    title: 'Product Description Correction',
    category: 'pi_details',
    shortDescription: 'Align fabric / goods description with Proforma Invoice',
    icon: 'FileSpreadsheet',
    relevantFields: ['piDescription'],
    emailTemplate: (details) => {
      if (details.piDescription?.trim()) {
        return `Please correct the description of goods in the LC to match the PI: "${details.piDescription.trim()}".`;
      }
      return 'Please correct the goods description in the LC to strictly conform with the details stated in the Proforma Invoice.';
    },
    messageTemplate: (details) => {
      if (details.piDescription?.trim()) {
        return `Correct goods description to: "${details.piDescription.trim()}".`;
      }
      return 'Correct goods description to match PI.';
    }
  },
  {
    id: 'pi_buyer_name_correction',
    title: 'Buyer/Applicant Name Correction',
    category: 'pi_details',
    shortDescription: 'Rectify applicant / buyer legal entity name spelling',
    icon: 'UserCheck',
    relevantFields: ['currentBuyerName', 'correctBuyerName'],
    emailTemplate: (details) => {
      if (details.currentBuyerName?.trim() || details.correctBuyerName?.trim()) {
        const oldName = details.currentBuyerName?.trim() || '[Incorrect Name]';
        const newName = details.correctBuyerName?.trim() || '[Correct Name]';
        return `Please correct the buyer/applicant name in the LC as follows:\n      - Incorrect: ${oldName}\n      - Correct: ${newName}`;
      }
      return 'Please correct the applicant/buyer legal name and address in the LC as per the Proforma Invoice.';
    },
    messageTemplate: (details) => {
      if (details.correctBuyerName?.trim()) {
        return `Correct applicant/buyer name to: ${details.correctBuyerName.trim()}.`;
      }
      return 'Correct buyer/applicant name in LC.';
    }
  },
  {
    id: 'duplicate_amendment_copy',
    title: 'Duplicate Amendment Copy',
    category: 'compliance',
    shortDescription: 'Request duplicate copy of previous LC amendment',
    icon: 'CopyCheck',
    relevantFields: ['additionalNote'],
    emailTemplate: () => {
      return 'Please furnish us with the official swift copy (MT707) / duplicate amendment copy of the previous amendment for our commercial and banking records.';
    },
    messageTemplate: () => {
      return 'Share duplicate/swift copy (MT707) of previous amendment.';
    }
  },
  {
    id: 'lc_amendment_acknowledgement_copy',
    title: 'LC Amendment Copy Required',
    category: 'compliance',
    shortDescription: 'Request acknowledged/correct updated copy of the LC',
    icon: 'CopyCheck',
    relevantFields: ['additionalNote'],
    emailTemplate: () => {
      return 'Please provide us with the fully acknowledged and confirmed SWIFT copy (MT707) of the latest amendment for our commercial and banking records.';
    },
    messageTemplate: () => {
      return 'Share confirmed SWIFT MT707 copy of latest amendment.';
    }
  },
  {
    id: 'partial_payment_not_allowed',
    title: 'Partial Payment / Drawing Not Allowed',
    category: 'clauses',
    shortDescription: 'Allow partial payments/drawings as per commercial shipment needs',
    icon: 'Split',
    relevantFields: ['additionalNote'],
    emailTemplate: (details) => {
      if (details.additionalNote?.trim()) {
        return `Please amend the LC to allow partial payment/drawings: "${details.additionalNote.trim()}". Currently, partial payment or drawing is restricted in the LC.`;
      }
      return 'Please amend the LC to clearly allow partial payments / partial drawings against partial shipments/documents. Partial drawings must not be restricted.';
    },
    messageTemplate: (details) => {
      if (details.additionalNote?.trim()) {
        return `Allow partial payment/drawing: ${details.additionalNote.trim()}.`;
      }
      return 'Amend LC to allow partial payment / partial drawing.';
    }
  },
  {
    id: 'other_correction',
    title: 'Other Correction',
    category: 'clauses',
    shortDescription: 'Custom tailored commercial or documentary amendment',
    icon: 'Edit3',
    relevantFields: ['customCorrectionText'],
    emailTemplate: (details) => {
      if (details.customCorrectionText?.trim()) {
        return details.customCorrectionText.trim();
      }
      return 'Please incorporate the agreed amendment in the LC as per our prior commercial discussion.';
    },
    messageTemplate: (details) => {
      if (details.customCorrectionText?.trim()) {
        return details.customCorrectionText.trim();
      }
      return 'Incorporate agreed correction in LC as discussed.';
    }
  }
];

export const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Corrections',
  charges: 'Bank Charges & Limits',
  dates: 'Shipment & Expiry Dates',
  clauses: 'LC Clauses & Tenor',
  pi_details: 'PI Details & Values',
  compliance: 'Compliance & Verification'
};
