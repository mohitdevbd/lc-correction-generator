import type { AdditionalDetails, DraftResult, LcEntry, LcMode, OutputType, UserSettings } from '../types';
import { CORRECTION_TEMPLATES } from '../data/correctionTemplates';

export interface GenerateDraftOptions {
  lcMode?: LcMode;
  lcNumber?: string;
  lcNumbers?: string[];
  lcEntries?: LcEntry[];
  outputType: OutputType;
  selectedCorrectionIds?: string[];
  details?: AdditionalDetails;
  settings: UserSettings;
}

export interface GenerateFollowUpOptions {
  lcMode?: LcMode;
  lcNumber?: string;
  lcNumbers?: string[];
  outputType: OutputType;
  settings: UserSettings;
  details?: AdditionalDetails;
}

export function formatLcList(lcNumbers: string[]): { label: string; subjectLabel: string } {
  const cleanList = lcNumbers.map((s) => s.trim()).filter(Boolean);
  if (cleanList.length === 0) {
    return { label: 'LC No. [LC NUMBER]', subjectLabel: 'LC No. [LC NUMBER]' };
  }
  if (cleanList.length === 1) {
    return { label: `LC No. ${cleanList[0]}`, subjectLabel: `LC No. ${cleanList[0]}` };
  }
  if (cleanList.length === 2) {
    return {
      label: `LC Nos. ${cleanList[0]} & ${cleanList[1]}`,
      subjectLabel: `LC Nos. ${cleanList[0]} & ${cleanList[1]}`
    };
  }
  const allExceptLast = cleanList.slice(0, -1).join(', ');
  const last = cleanList[cleanList.length - 1];
  return {
    label: `LC Nos. ${allExceptLast} & ${last}`,
    subjectLabel: `LC Nos. ${allExceptLast} & ${last}`
  };
}

export function getSalutation(
  details: AdditionalDetails = {},
  settings: UserSettings,
  outputType: OutputType
): string {
  const salutationType = details.salutationType || settings.defaultSalutationType || 'dear_sir_madam';
  const recipient = details.recipientName?.trim() || '';
  const custom = details.customSalutation?.trim() || '';

  if (salutationType === 'custom' && custom) {
    return custom;
  }

  if (salutationType === 'assalamu_alaikum') {
    if (recipient) {
      const formattedName =
        recipient.startsWith('Mr.') || recipient.startsWith('Ms.') || recipient.startsWith('Dear')
          ? recipient
          : `Mr. ${recipient}`;
      return `Assalamu Alaikum,\nDear ${formattedName},`;
    }
    return 'Assalamu Alaikum,';
  }

  if (salutationType === 'assalamu_alaikum_dear_sir') {
    if (recipient) {
      const formattedName =
        recipient.startsWith('Mr.') || recipient.startsWith('Ms.')
          ? recipient
          : `Mr. ${recipient}`;
      return `Assalamu Alaikum & Dear ${formattedName},`;
    }
    return outputType === 'message' ? 'Assalamu Alaikum & Dear Sir,' : 'Assalamu Alaikum & Dear Sir/Madam,';
  }

  if (salutationType === 'dear_recipient') {
    if (recipient) {
      const formattedName =
        recipient.startsWith('Mr.') || recipient.startsWith('Ms.') || recipient.startsWith('Dear')
          ? recipient
          : `Mr. ${recipient}`;
      return `Dear ${formattedName},`;
    }
    return outputType === 'message' ? 'Dear Sir,' : 'Dear Sir/Madam,';
  }

  // Default: dear_sir_madam
  if (outputType === 'message') {
    if (recipient) {
      const formattedName =
        recipient.startsWith('Mr.') || recipient.startsWith('Ms.')
          ? recipient
          : `Mr. ${recipient}`;
      return `Dear ${formattedName},`;
    }
    return 'Dear Sir,';
  }

  return 'Dear Sir/Madam,';
}

export class DraftGeneratorService {
  /**
   * Generates a commercial LC amendment draft based on selected templates and dynamic parameters.
   * Supports Single LC, Scenario A (Multiple LCs - Common amendments), and Scenario B (Multiple LCs - Specific breakdown).
   */
  public generateDraft(options: GenerateDraftOptions): DraftResult {
    const {
      lcMode = 'single',
      lcNumber = '',
      lcNumbers = [],
      lcEntries = [],
      outputType,
      selectedCorrectionIds = [],
      details = {},
      settings
    } = options;

    if (lcMode === 'multiple_specific') {
      return this.generateSpecificBreakdownDraft(lcEntries, outputType, settings);
    }

    if (lcMode === 'multiple_common') {
      return this.generateMultipleCommonDraft(lcNumbers, outputType, selectedCorrectionIds, details, settings);
    }

    // Default: Single LC mode
    const cleanLc = lcNumber.trim() || '[LC NUMBER]';
    const activeTemplates = selectedCorrectionIds
      .map((id) => CORRECTION_TEMPLATES.find((t) => t.id === id))
      .filter((t): t is typeof CORRECTION_TEMPLATES[number] => Boolean(t));

    if (activeTemplates.length === 0) {
      throw new Error('Please select at least one LC correction type.');
    }

    if (outputType === 'message') {
      return this.generateSingleMessageDraft(cleanLc, activeTemplates, details, settings, selectedCorrectionIds);
    }

    return this.generateSingleEmailDraft(cleanLc, activeTemplates, details, settings, selectedCorrectionIds);
  }

  /**
   * Scenario A: Multiple LCs with Shared / Common Amendments (Most Common)
   */
  private generateMultipleCommonDraft(
    lcNumbers: string[],
    outputType: OutputType,
    selectedCorrectionIds: string[],
    details: AdditionalDetails,
    settings: UserSettings
  ): DraftResult {
    const cleanLcs = lcNumbers.map((s) => s.trim()).filter(Boolean);
    const effectiveLcs = cleanLcs.length > 0 ? cleanLcs : ['[LC 1]', '[LC 2]'];
    const { subjectLabel } = formatLcList(effectiveLcs);

    const activeTemplates = selectedCorrectionIds
      .map((id) => CORRECTION_TEMPLATES.find((t) => t.id === id))
      .filter((t): t is typeof CORRECTION_TEMPLATES[number] => Boolean(t));

    if (activeTemplates.length === 0) {
      throw new Error('Please select at least one LC correction type for the listed LCs.');
    }

    const signature = settings.emailSignature?.trim() || `Best regards,\n${settings.userName}\n${settings.department}\n${settings.companyName}`;
    const salutation = getSalutation(details, settings, outputType);

    if (outputType === 'message') {
      const bulletList = activeTemplates
        .map((tpl) => `• ${tpl.messageTemplate(details, settings, selectedCorrectionIds)}`)
        .join('\n');

      let extraNote = '';
      if (details.additionalNote?.trim() && !selectedCorrectionIds.includes('overdue_clause')) {
        extraNote = `\nNote: ${details.additionalNote.trim()}`;
      }

      const body = `${salutation}
Please arrange the following correction(s) across ${subjectLabel}:

${bulletList}${extraNote}

Please share the amended LC copies once updated.
Thank you.`;

      return {
        subject: `LC Amendments – ${subjectLabel}`,
        body,
        fullText: body,
        outputType: 'message',
        lcMode: 'multiple_common',
        lcNumber: effectiveLcs.join(', '),
        lcNumbers: effectiveLcs,
        correctionIds: selectedCorrectionIds,
        timestamp: Date.now()
      };
    }

    // Email Mode
    const subject = `Request for LC Amendments – ${subjectLabel}`;
    const lcListFormatted = effectiveLcs.map((lc, index) => `${index + 1}. LC No. ${lc}`).join('\n');

    const numberedList = activeTemplates
      .map((tpl, index) => `${index + 1}. ${tpl.emailTemplate(details, settings, selectedCorrectionIds)}`)
      .join('\n\n');

    let additionalRemarkBlock = '';
    if (details.additionalNote?.trim() && !selectedCorrectionIds.includes('overdue_clause') && !selectedCorrectionIds.includes('physical_verification_clause')) {
      additionalRemarkBlock = `\n\nCommercial Note: ${details.additionalNote.trim()}`;
    }

    const body = `${salutation}

Please note that after reviewing the following Letters of Credit:
${lcListFormatted}

We kindly require the following amendment(s) across the above-mentioned LCs:

${numberedList}${additionalRemarkBlock}

Please arrange the necessary amendments and provide us with the updated LC copies at your earliest convenience.

${signature}`;

    const fullText = `Subject: ${subject}\n\n${body}`;

    return {
      subject,
      body,
      fullText,
      outputType: 'email',
      lcMode: 'multiple_common',
      lcNumber: effectiveLcs.join(', '),
      lcNumbers: effectiveLcs,
      correctionIds: selectedCorrectionIds,
      timestamp: Date.now()
    };
  }

  /**
   * Scenario B: Multiple LCs with LC-Specific Breakdown
   */
  private generateSpecificBreakdownDraft(
    lcEntries: LcEntry[],
    outputType: OutputType,
    settings: UserSettings
  ): DraftResult {
    const validEntries = lcEntries.filter((e) => e.lcNumber.trim().length > 0 && e.correctionIds.length > 0);

    if (validEntries.length === 0) {
      throw new Error('Please add at least one LC with its respective correction types in the breakdown.');
    }

    const allLcNumbers = validEntries.map((e) => e.lcNumber.trim());
    const { subjectLabel } = formatLcList(allLcNumbers);
    const allCorrectionIds = Array.from(new Set(validEntries.flatMap((e) => e.correctionIds)));
    const signature = settings.emailSignature?.trim() || `Best regards,\n${settings.userName}\n${settings.department}\n${settings.companyName}`;
    const salutation = getSalutation(validEntries[0]?.details || {}, settings, outputType);

    if (outputType === 'message') {
      const breakdownText = validEntries.map((entry) => {
        const templates = entry.correctionIds
          .map((id) => CORRECTION_TEMPLATES.find((t) => t.id === id))
          .filter((t): t is typeof CORRECTION_TEMPLATES[number] => Boolean(t));

        const bullets = templates
          .map((tpl) => `  • ${tpl.messageTemplate(entry.details, settings, entry.correctionIds)}`)
          .join('\n');

        return `LC No. ${entry.lcNumber.trim()}:\n${bullets}`;
      }).join('\n\n');

      const body = `${salutation}
Please arrange amendments for the following LCs as detailed below:

${breakdownText}

Please share the amended LC copies once updated.
Thank you.`;

      return {
        subject: `LC Amendments – ${subjectLabel}`,
        body,
        fullText: body,
        outputType: 'message',
        lcMode: 'multiple_specific',
        lcNumber: allLcNumbers.join(', '),
        lcNumbers: allLcNumbers,
        correctionIds: allCorrectionIds,
        timestamp: Date.now()
      };
    }

    // Email Mode
    const subject = `Request for LC Amendments – ${subjectLabel}`;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const breakdownBlocks = validEntries.map((entry, idx) => {
      const letter = alphabet[idx % alphabet.length];
      const templates = entry.correctionIds
        .map((id) => CORRECTION_TEMPLATES.find((t) => t.id === id))
        .filter((t): t is typeof CORRECTION_TEMPLATES[number] => Boolean(t));

      const items = templates
        .map((tpl, itemIdx) => `   ${itemIdx + 1}. ${tpl.emailTemplate(entry.details, settings, entry.correctionIds)}`)
        .join('\n\n');

      let entryNote = '';
      if (entry.details.additionalNote?.trim()) {
        entryNote = `\n   Note: ${entry.details.additionalNote.trim()}`;
      }

      return `${letter}. LC No. ${entry.lcNumber.trim()}:\n${items}${entryNote}`;
    }).join('\n\n');

    const body = `${salutation}

Please note that after reviewing our active orders, we require specific amendments for the following Letters of Credit as detailed below:

${breakdownBlocks}

Please arrange the necessary amendments and provide us with the updated LC copies at your earliest convenience.

${signature}`;

    const fullText = `Subject: ${subject}\n\n${body}`;

    return {
      subject,
      body,
      fullText,
      outputType: 'email',
      lcMode: 'multiple_specific',
      lcNumber: allLcNumbers.join(', '),
      lcNumbers: allLcNumbers,
      correctionIds: allCorrectionIds,
      timestamp: Date.now()
    };
  }

  /**
   * Generates an official follow-up email/message reminding recipient about pending amendment.
   */
  public generateFollowUp(options: GenerateFollowUpOptions): DraftResult {
    const { lcMode = 'single', lcNumber, lcNumbers = [], outputType, settings, details = {} } = options;

    let targetLcs: string[] = [];
    if (lcMode === 'single') {
      if (lcNumber && lcNumber.trim()) targetLcs = [lcNumber.trim()];
    } else {
      targetLcs = lcNumbers.map((s) => s.trim()).filter(Boolean);
    }

    const hasLcs = targetLcs.length > 0;
    const { label, subjectLabel } = hasLcs ? formatLcList(targetLcs) : { label: '', subjectLabel: '' };
    const salutation = getSalutation(details, settings, outputType);

    if (outputType === 'message') {
      const body = hasLcs
        ? `${salutation}\nThis is a kind follow-up regarding the amendment(s) requested for ${label}. We have not received the revised copy/copies yet. Please share the updated LC copy at your earliest convenience.\nThank you.`
        : `${salutation}\nThis is a kind follow-up regarding the LC amendment(s) requested earlier. We have not received the revised copy yet. Please share the updated LC copy at your earliest convenience.\nThank you.`;

      return {
        subject: hasLcs ? `Follow-Up: ${subjectLabel}` : 'Follow-Up: LC Amendment',
        body,
        fullText: body,
        outputType: 'message',
        lcMode,
        lcNumber: targetLcs.join(', '),
        lcNumbers: targetLcs,
        correctionIds: ['follow_up'],
        timestamp: Date.now()
      };
    }

    const subject = hasLcs
      ? `Follow-Up on LC Amendments – ${subjectLabel}`
      : 'Follow-Up on LC Amendment Request';

    const referencePhrase = hasLcs ? `for ${label}` : 'requested earlier';

    const signature = settings.emailSignature?.trim() || `Best regards,\n${settings.userName}\n${settings.department}\n${settings.companyName}`;

    const body = `${salutation}

This is a kind follow-up regarding the LC amendment(s) requested earlier ${referencePhrase}.

We have not yet received any update regarding the requested corrections.

Please provide us with the updated LC copies at your earliest convenience.

${signature}`;

    const fullText = `Subject: ${subject}\n\n${body}`;

    return {
      subject,
      body,
      fullText,
      outputType: 'email',
      lcMode,
      lcNumber: targetLcs.join(', '),
      lcNumbers: targetLcs,
      correctionIds: ['follow_up'],
      timestamp: Date.now()
    };
  }

  private generateSingleEmailDraft(
    lcNumber: string,
    templates: typeof CORRECTION_TEMPLATES,
    details: AdditionalDetails,
    settings: UserSettings,
    allSelectedIds: string[]
  ): DraftResult {
    const subject = `Request for LC Amendment – LC No. ${lcNumber}`;
    const signature = settings.emailSignature?.trim() || `Best regards,\n${settings.userName}\n${settings.department}\n${settings.companyName}`;
    const salutation = getSalutation(details, settings, 'email');

    const isPlural = templates.length > 1;
    const leadPhrase = isPlural
      ? `Please note that after reviewing LC No. ${lcNumber}, we require the following amendments:`
      : `Please note that after reviewing LC No. ${lcNumber}, we require the following amendment:`;

    const numberedList = templates
      .map((tpl, index) => {
        const itemText = tpl.emailTemplate(details, settings, allSelectedIds);
        return `${index + 1}. ${itemText}`;
      })
      .join('\n\n');

    let additionalRemarkBlock = '';
    if (details.additionalNote?.trim() && !allSelectedIds.includes('overdue_clause') && !allSelectedIds.includes('physical_verification_clause')) {
      additionalRemarkBlock = `\n\nCommercial Note: ${details.additionalNote.trim()}`;
    }

    const body = `${salutation}

${leadPhrase}

${numberedList}${additionalRemarkBlock}

Please arrange the necessary amendment and provide us with the updated LC copy at your earliest convenience.

${signature}`;

    const fullText = `Subject: ${subject}\n\n${body}`;

    return {
      subject,
      body,
      fullText,
      outputType: 'email',
      lcMode: 'single',
      lcNumber,
      lcNumbers: [lcNumber],
      correctionIds: allSelectedIds,
      timestamp: Date.now()
    };
  }

  private generateSingleMessageDraft(
    lcNumber: string,
    templates: typeof CORRECTION_TEMPLATES,
    details: AdditionalDetails,
    settings: UserSettings,
    allSelectedIds: string[]
  ): DraftResult {
    const bulletList = templates
      .map((tpl) => {
        const itemText = tpl.messageTemplate(details, settings, allSelectedIds);
        return `• ${itemText}`;
      })
      .join('\n');

    let extraNote = '';
    if (details.additionalNote?.trim() && !allSelectedIds.includes('overdue_clause')) {
      extraNote = `\nNote: ${details.additionalNote.trim()}`;
    }

    const salutation = getSalutation(details, settings, 'message');

    const body = `${salutation}
Please arrange the following correction in LC No. ${lcNumber}:

${bulletList}${extraNote}

Please share the amended LC copy once updated.
Thank you.`;

    return {
      subject: `LC Amendment – ${lcNumber}`,
      body,
      fullText: body,
      outputType: 'message',
      lcMode: 'single',
      lcNumber,
      lcNumbers: [lcNumber],
      correctionIds: allSelectedIds,
      timestamp: Date.now()
    };
  }

  public async generateDraftAsync(options: GenerateDraftOptions): Promise<DraftResult> {
    return this.generateDraft(options);
  }
}

export const draftGenerator = new DraftGeneratorService();
