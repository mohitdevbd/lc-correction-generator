export type OutputType = 'email' | 'message';

export type LcMode = 'single' | 'multiple_common' | 'multiple_specific';

export type CorrectionCategory = 
  | 'charges'
  | 'dates'
  | 'clauses'
  | 'pi_details'
  | 'compliance';

export type DynamicFieldKey =
  | 'piNumber'
  | 'piValue'
  | 'revisedPiNumber'
  | 'currentLcValue'
  | 'targetPiValue'
  | 'currentBuyerName'
  | 'correctBuyerName'
  | 'oldVatBin'
  | 'newVatBin'
  | 'currentShipmentDate'
  | 'requiredShipmentDate'
  | 'currentExpiryDate'
  | 'requiredExpiryDate'
  | 'currentTenor'
  | 'requiredTenor'
  | 'maxChargeAmount'
  | 'currency'
  | 'bankName'
  | 'applicantName'
  | 'beneficiaryName'
  | 'additionalNote'
  | 'customCorrectionText'
  | 'clauseNumber'
  | 'piDate'
  | 'piDescription'
  | 'hsCodeInLc'
  | 'correctHsCode'
  | 'discrepancyChargeInLc'
  | 'paymentChargeInLc'
  | 'acceptableDiscrepancyCharge'
  | 'acceptablePaymentCharge'
  | 'correctBeneficiaryName'
  | 'orderQuantity'
  | 'unitPrice';

export interface AdditionalDetails {
  piNumber?: string;
  piValue?: string;
  revisedPiNumber?: string;
  currentLcValue?: string;
  targetPiValue?: string;
  currentBuyerName?: string;
  correctBuyerName?: string;
  oldVatBin?: string;
  newVatBin?: string;
  currentShipmentDate?: string;
  requiredShipmentDate?: string;
  currentExpiryDate?: string;
  requiredExpiryDate?: string;
  currentTenor?: string;
  requiredTenor?: string;
  maxChargeAmount?: string;
  currency?: string;
  bankName?: string;
  applicantName?: string;
  beneficiaryName?: string;
  additionalNote?: string;
  customCorrectionText?: string;
  clauseNumber?: string;
  piDate?: string;
  piDescription?: string;
  salutationType?: SalutationType;
  recipientName?: string;
  customSalutation?: string;
  hsCodeInLc?: string;
  correctHsCode?: string;
  discrepancyChargeInLc?: string;
  paymentChargeInLc?: string;
  acceptableDiscrepancyCharge?: string;
  acceptablePaymentCharge?: string;
  correctBeneficiaryName?: string;
  orderQuantity?: string;
  unitPrice?: string;
}

export type SalutationType =
  | 'dear_sir_madam'
  | 'assalamu_alaikum'
  | 'dear_recipient'
  | 'assalamu_alaikum_dear_sir'
  | 'custom';

export interface UserSettings {
  userName: string;
  companyName: string;
  department: string;
  emailSignature?: string;
  defaultCurrency: string;
  defaultChargeLimit: string;
  defaultOutputType: OutputType;
  defaultSalutationType?: SalutationType;
}

export interface CorrectionTemplate {
  id: string;
  title: string;
  category: CorrectionCategory;
  shortDescription: string;
  icon: string;
  relevantFields: DynamicFieldKey[];
  emailTemplate: (details: AdditionalDetails, settings: UserSettings, allSelectedIds?: string[]) => string;
  messageTemplate: (details: AdditionalDetails, settings: UserSettings, allSelectedIds?: string[]) => string;
}

export interface LcEntry {
  id: string;
  lcNumber: string;
  correctionIds: string[];
  details: AdditionalDetails;
}

export interface DraftResult {
  subject: string;
  body: string;
  fullText: string;
  outputType: OutputType;
  lcMode: LcMode;
  lcNumber: string;
  lcNumbers: string[];
  correctionIds: string[];
  timestamp: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  lcMode?: LcMode;
  lcNumber: string;
  lcNumbers?: string[];
  outputType: OutputType;
  correctionIds: string[];
  correctionTitles: string[];
  subject?: string;
  body: string;
  fullText: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  description?: string;
  correctionIds: string[];
  defaultDetails?: Partial<AdditionalDetails>;
  createdAt: number;
}

export type AuditSeverity = 'critical' | 'warning' | 'info';

export interface LcAuditIssue {
  id: string;
  correctionId: string;
  title: string;
  severity: AuditSeverity;
  reason: string;
  detectedText?: string;
  suggestedDetails?: Partial<AdditionalDetails>;
}

export interface LcAuditResult {
  rawText: string;
  detectedLcNumber?: string;
  detectedIssueDate?: string;
  detectedExpiryDate?: string;
  detectedShipmentDate?: string;
  detectedBeneficiary?: string;
  detectedApplicant?: string;
  detectedCurrency?: string;
  detectedAmount?: string;
  issues: LcAuditIssue[];
}

