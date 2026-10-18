import React from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal, DollarSign, Calendar, FileText, UserCheck, HelpCircle } from 'lucide-react';
import type { AdditionalDetails } from '../../types';

interface DynamicFieldsProps {
  selectedCorrectionIds: string[];
  details: AdditionalDetails;
  onChange: (field: keyof AdditionalDetails, value: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  defaultCurrency: string;
}

export const DynamicFields: React.FC<DynamicFieldsProps> = ({
  selectedCorrectionIds,
  details,
  onChange,
  isOpen,
  onToggleOpen,
  defaultCurrency
}) => {
  // Determine which field groups are relevant
  const showVat = selectedCorrectionIds.some((id) => ['vat_bin_correction', 'beneficiary_vat_bin_correction'].includes(id));
  const showBuyer = selectedCorrectionIds.includes('pi_buyer_name_correction');
  const showBeneficiary = selectedCorrectionIds.includes('beneficiary_name_correction');
  const showHsCode = selectedCorrectionIds.includes('hs_code_correction');
  const showDualCharges = selectedCorrectionIds.includes('discrepancy_payment_charges_revision');
  const showQuantityPrice = selectedCorrectionIds.includes('quantity_and_unit_price');
  const showCharges = selectedCorrectionIds.some((id) =>
    ['total_bank_charges_limit', 'discrepancy_charges', 'fund_transfer_charges', 'payment_processing_charges', 'clause_71d_bank_charges'].includes(id)
  );
  const showValues = selectedCorrectionIds.includes('lc_value_mismatch');
  const showShipment = selectedCorrectionIds.some((id) =>
    ['shipment_date_extension', 'shipment_and_expiry_extension'].includes(id)
  );
  const showExpiry = selectedCorrectionIds.some((id) =>
    ['expiry_date_extension', 'shipment_and_expiry_extension'].includes(id)
  );
  const showTenor = selectedCorrectionIds.some((id) =>
    ['draft_tenor_correction', 'payment_clause'].includes(id)
  );
  const showPi = selectedCorrectionIds.some((id) =>
    ['revised_pi_update', 'pi_number_correction', 'pi_date_correction', 'pi_description_correction'].includes(id)
  );
  const showBank = selectedCorrectionIds.includes('official_bank_confirmation');
  const showClause = selectedCorrectionIds.some((id) =>
    ['physical_verification_clause', 'bank_verification_report_deletion', 'acceptance_after_receipt_deletion'].includes(id)
  );
  const showCustom = selectedCorrectionIds.includes('other_correction');

  const hasAnyRelevantField =
    showVat || showBuyer || showBeneficiary || showHsCode || showDualCharges || showQuantityPrice ||
    showCharges || showValues || showShipment || showExpiry || showTenor || showPi || showBank || showClause || showCustom;

  // Count how many details fields are populated
  const populatedCount = Object.values(details).filter((v) => typeof v === 'string' && v.trim().length > 0).length;

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden transition-all">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 hover:bg-slate-100/70 transition-colors text-left"
      >
        <div className="flex items-center space-x-2">
          <SlidersHorizontal className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-800">
            Additional Details (Optional)
          </span>
          {populatedCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
              {populatedCount} filled
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Body */}
      {isOpen && (
        <div className="p-4 space-y-4 border-t border-slate-200 bg-white">
          {!hasAnyRelevantField && (
            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
              <HelpCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Tip: Dynamic fields appear automatically when you select corrections (e.g. VAT/BIN, Bank Charges, Dates, Buyer Name). You can also add an optional commercial note below.
              </span>
            </div>
          )}

          {/* Bank Charges limit */}
          {showCharges && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                <span>Bank Charges Limit</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Maximum Charge Amount</label>
                  <input
                    type="text"
                    value={details.maxChargeAmount || ''}
                    onChange={(e) => onChange('maxChargeAmount', e.target.value)}
                    placeholder="e.g. 120"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Currency</label>
                  <input
                    type="text"
                    value={details.currency || defaultCurrency || 'USD'}
                    onChange={(e) => onChange('currency', e.target.value.toUpperCase())}
                    placeholder="USD"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* VAT / BIN */}
          {showVat && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                <span>Beneficiary VAT / BIN Details</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Current (Incorrect) VAT/BIN</label>
                  <input
                    type="text"
                    value={details.oldVatBin || ''}
                    onChange={(e) => onChange('oldVatBin', e.target.value)}
                    placeholder="e.g. 000123456-0101"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Required (Correct) VAT/BIN</label>
                  <input
                    type="text"
                    value={details.newVatBin || ''}
                    onChange={(e) => onChange('newVatBin', e.target.value)}
                    placeholder="e.g. 000987654-0202"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Buyer Name Correction */}
          {showBuyer && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                <span>Buyer / Applicant Name Correction</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Incorrect Buyer Name in LC</label>
                  <input
                    type="text"
                    value={details.currentBuyerName || ''}
                    onChange={(e) => onChange('currentBuyerName', e.target.value)}
                    placeholder="e.g. ABC Apparels Int'l"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Correct Buyer Legal Name</label>
                  <input
                    type="text"
                    value={details.correctBuyerName || ''}
                    onChange={(e) => onChange('correctBuyerName', e.target.value)}
                    placeholder="e.g. ABC Apparels Limited"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LC Value vs PI Value */}
          {showValues && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                <span>LC Value vs. PI Value</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Current LC Value</label>
                  <input
                    type="text"
                    value={details.currentLcValue || ''}
                    onChange={(e) => onChange('currentLcValue', e.target.value)}
                    placeholder="e.g. 45,000.00"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Target PI Value</label>
                  <input
                    type="text"
                    value={details.targetPiValue || ''}
                    onChange={(e) => onChange('targetPiValue', e.target.value)}
                    placeholder="e.g. 52,500.00"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dates: Shipment & Expiry */}
          {(showShipment || showExpiry) && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                <span>Shipment & Expiry Dates</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {showShipment && (
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Required Shipment Date</label>
                    <input
                      type="text"
                      value={details.requiredShipmentDate || ''}
                      onChange={(e) => onChange('requiredShipmentDate', e.target.value)}
                      placeholder="e.g. 15-Nov-2026"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>
                )}
                {showExpiry && (
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Required Expiry Date</label>
                    <input
                      type="text"
                      value={details.requiredExpiryDate || ''}
                      onChange={(e) => onChange('requiredExpiryDate', e.target.value)}
                      placeholder="e.g. 30-Nov-2026"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tenor / Payment Terms */}
          {showTenor && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                <span>Draft Tenor / Payment Terms</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Current Tenor in LC</label>
                  <input
                    type="text"
                    value={details.currentTenor || ''}
                    onChange={(e) => onChange('currentTenor', e.target.value)}
                    placeholder="e.g. 120 days from BL"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Agreed Tenor as per PI</label>
                  <input
                    type="text"
                    value={details.requiredTenor || ''}
                    onChange={(e) => onChange('requiredTenor', e.target.value)}
                    placeholder="e.g. At Sight"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PI References */}
          {showPi && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                <span>Proforma Invoice (PI) Reference</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Revised PI Number</label>
                  <input
                    type="text"
                    value={details.revisedPiNumber || ''}
                    onChange={(e) => onChange('revisedPiNumber', e.target.value)}
                    placeholder="e.g. NZT/2026/PI-842"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">PI Date</label>
                  <input
                    type="text"
                    value={details.piDate || ''}
                    onChange={(e) => onChange('piDate', e.target.value)}
                    placeholder="e.g. 10-Oct-2026"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Goods Description</label>
                  <input
                    type="text"
                    value={details.piDescription || ''}
                    onChange={(e) => onChange('piDescription', e.target.value)}
                    placeholder="e.g. 100% Cotton Dyed Twill"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bank Name */}
          {showBank && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <label className="text-[11px] text-slate-500 block mb-1">Bank Name for Confirmation</label>
              <input
                type="text"
                value={details.bankName || ''}
                onChange={(e) => onChange('bankName', e.target.value)}
                placeholder="e.g. Standard Chartered Bank / HSBC"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          )}

          {/* Physical Verification Clause */}
          {showClause && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <label className="text-[11px] text-slate-500 block mb-1">Physical Verification Clause Number</label>
              <input
                type="text"
                value={details.clauseNumber || ''}
                onChange={(e) => onChange('clauseNumber', e.target.value)}
                placeholder="Clause 13 (default)"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          )}

          {/* HS Code Details */}
          {showHsCode && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                <span>HS Code Verification / Correction</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">HS Code stated in LC</label>
                  <input
                    type="text"
                    value={details.hsCodeInLc || ''}
                    onChange={(e) => onChange('hsCodeInLc', e.target.value)}
                    placeholder="e.g. 6217.10.00"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Correct HS Code as per PI</label>
                  <input
                    type="text"
                    value={details.correctHsCode || ''}
                    onChange={(e) => onChange('correctHsCode', e.target.value)}
                    placeholder="e.g. 5208.11.00"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dual Discrepancy & Payment Charges Revision */}
          {showDualCharges && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                <span>Discrepancy & Payment Charges Revision</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">LC Discrepancy Fee</label>
                  <input
                    type="text"
                    value={details.discrepancyChargeInLc || ''}
                    onChange={(e) => onChange('discrepancyChargeInLc', e.target.value)}
                    placeholder="75.00"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">LC Payment Fee</label>
                  <input
                    type="text"
                    value={details.paymentChargeInLc || ''}
                    onChange={(e) => onChange('paymentChargeInLc', e.target.value)}
                    placeholder="50.00"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Acceptable Discrepancy</label>
                  <input
                    type="text"
                    value={details.acceptableDiscrepancyCharge || ''}
                    onChange={(e) => onChange('acceptableDiscrepancyCharge', e.target.value)}
                    placeholder="25.00"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Acceptable Payment</label>
                  <input
                    type="text"
                    value={details.acceptablePaymentCharge || ''}
                    onChange={(e) => onChange('acceptablePaymentCharge', e.target.value)}
                    placeholder="25.00"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Beneficiary Legal Name in Field 59 */}
          {showBeneficiary && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <label className="text-[11px] text-slate-500 block mb-1">Correct Beneficiary Legal Name (Field 59)</label>
              <input
                type="text"
                value={details.correctBeneficiaryName || ''}
                onChange={(e) => onChange('correctBeneficiaryName', e.target.value)}
                placeholder="e.g. NZ Textile Ltd."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white font-medium"
              />
            </div>
          )}

          {/* Quantity & Unit Price */}
          {showQuantityPrice && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                <span>Quantity & Unit Price Correction</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Order Quantity</label>
                  <input
                    type="text"
                    value={details.orderQuantity || ''}
                    onChange={(e) => onChange('orderQuantity', e.target.value)}
                    placeholder="e.g. 50,000 YDS or 12,500 PCS"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Unit Price</label>
                  <input
                    type="text"
                    value={details.unitPrice || ''}
                    onChange={(e) => onChange('unitPrice', e.target.value)}
                    placeholder="e.g. USD 2.45 / YD"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Other / Custom text */}
          {showCustom && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <label className="text-[11px] text-slate-500 block mb-1">Custom Correction Wording</label>
              <textarea
                rows={2}
                value={details.customCorrectionText || ''}
                onChange={(e) => onChange('customCorrectionText', e.target.value)}
                placeholder="Enter the specific amendment clause wording required..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          )}

          {/* Additional General Note */}
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">
              Commercial Executive Note / Specific Remarks (Optional)
            </label>
            <input
              type="text"
              value={details.additionalNote || ''}
              onChange={(e) => onChange('additionalNote', e.target.value)}
              placeholder="e.g. Urgent for pending fabric dispatch / Agreed via buyer email"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};
