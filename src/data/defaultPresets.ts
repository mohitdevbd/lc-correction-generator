export interface QuickPreset {
  id: string;
  name: string;
  icon: string;
  tag: string;
  correctionIds: string[];
  description: string;
}

export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: 'preset_overdue',
    name: 'Overdue',
    icon: 'ClockAlert',
    tag: 'Clause',
    correctionIds: ['overdue_clause'],
    description: 'Add overdue clause as per agreed terms'
  },
  {
    id: 'preset_payment',
    name: 'Payment',
    icon: 'CreditCard',
    tag: 'Payment',
    correctionIds: ['payment_clause'],
    description: 'Clarify payment terms & tenor in LC'
  },
  {
    id: 'preset_mismatch',
    name: 'PI/LC Mismatch',
    icon: 'BadgeDollarSign',
    tag: 'Value',
    correctionIds: ['lc_value_mismatch'],
    description: 'Align LC amount with the approved PI'
  },
  {
    id: 'preset_vat',
    name: 'VAT/BIN',
    icon: 'FileCheck',
    tag: 'Tax ID',
    correctionIds: ['vat_bin_correction'],
    description: 'Correct beneficiary registered VAT/BIN'
  },
  {
    id: 'preset_shipment_expiry',
    name: 'Shipment & Expiry',
    icon: 'CalendarRange',
    tag: 'Dates',
    correctionIds: ['shipment_and_expiry_extension'],
    description: 'Extend both latest shipment & LC expiry'
  },
  {
    id: 'preset_physical_verification',
    name: 'Physical Verification',
    icon: 'ShieldOff',
    tag: 'Clause 13',
    correctionIds: ['physical_verification_clause', 'acceptance_clause'],
    description: 'Delete Clause 13 & fix acceptance clause'
  },
  {
    id: 'preset_bank_charges_cap',
    name: 'Bank Charges Cap',
    icon: 'Coins',
    tag: 'Limit',
    correctionIds: ['total_bank_charges_limit', 'discrepancy_charges'],
    description: 'Cap discrepancy & total bank charges'
  }
];
