import { useState, useCallback } from 'react';
import { Header } from './components/layout/Header';
import { InputPanel } from './components/dashboard/InputPanel';
import { DraftPanel } from './components/draft/DraftPanel';
import { HistoryModal } from './components/modals/HistoryModal';
import { SavedTemplatesModal } from './components/modals/SavedTemplatesModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ToastContainer, type ToastMessage } from './components/common/Toast';
import type { AdditionalDetails, DraftResult, HistoryItem, LcAuditResult, LcEntry, LcMode, OutputType, SavedTemplate, UserSettings } from './types';
import { storageService } from './services/storageService';
import { draftGenerator } from './services/draftGenerator';
import { CORRECTION_TEMPLATES } from './data/correctionTemplates';
import type { QuickPreset } from './data/defaultPresets';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export function App() {
  // Settings & Storage State
  const [settings, setSettings] = useState<UserSettings>(() => storageService.getSettings());
  const [history, setHistory] = useState<HistoryItem[]>(() => storageService.getHistory());
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>(() => storageService.getSavedTemplates());

  // LC Mode state ('single' | 'multiple_common' | 'multiple_specific')
  const [lcMode, setLcMode] = useState<LcMode>('single');

  // Single LC State
  const [lcNumber, setLcNumber] = useState('');

  // Multiple LCs State (Scenario A: Common)
  const [lcNumbers, setLcNumbers] = useState<string[]>([]);

  // Multiple LCs State (Scenario B: Specific Breakdown)
  const [lcEntries, setLcEntries] = useState<LcEntry[]>([
    {
      id: 'entry_1',
      lcNumber: '',
      correctionIds: [],
      details: {}
    }
  ]);

  // Shared Form State
  const [outputType, setOutputType] = useState<OutputType>('email');
  const [selectedCorrectionIds, setSelectedCorrectionIds] = useState<string[]>([]);
  const [details, setDetails] = useState<AdditionalDetails>({
    currency: 'USD'
  });

  // Generated Draft State
  const [currentDraft, setCurrentDraft] = useState<DraftResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const newToast: ToastMessage = {
      id: 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type,
      message
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Handle Auto-Scan Audit Results from LcAutoScanner
  const handleApplyAudit = useCallback((
    auditResult: LcAuditResult,
    selectedIssueIds: string[],
    suggestedDetails: Partial<AdditionalDetails>
  ) => {
    // Map issue IDs → correction IDs
    const correctionIds = auditResult.issues
      .filter((issue) => selectedIssueIds.includes(issue.id))
      .map((issue) => issue.correctionId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx); // unique

    if (correctionIds.length > 0) {
      setSelectedCorrectionIds(correctionIds);
    }

    // Auto-fill LC number if detected
    if (auditResult.detectedLcNumber) {
      setLcNumber(auditResult.detectedLcNumber);
    }

    // Merge suggested details into form
    if (Object.keys(suggestedDetails).length > 0) {
      setDetails((prev) => ({ ...prev, ...suggestedDetails }));
    }

    // Auto-fill dates if detected
    setDetails((prev) => ({
      ...prev,
      ...(auditResult.detectedExpiryDate ? { currentExpiryDate: auditResult.detectedExpiryDate } : {}),
      ...(auditResult.detectedShipmentDate ? { currentShipmentDate: auditResult.detectedShipmentDate } : {}),
    }));

    const count = correctionIds.length;
    addToast(
      'success',
      `✅ ${count} clause${count !== 1 ? 's' : ''} auto-selected from LC scan! Review and generate.`
    );
  }, [addToast]);

  // Generate Draft Action (handles Single LC, Scenario A, and Scenario B)
  const handleGenerate = useCallback(() => {
    if (lcMode === 'single') {
      if (!lcNumber.trim()) {
        addToast('error', 'Please enter an LC Number.');
        return;
      }
      if (selectedCorrectionIds.length === 0) {
        addToast('error', 'Please select at least one LC correction type.');
        return;
      }
    } else if (lcMode === 'multiple_common') {
      const cleanList = lcNumbers.map((s) => s.trim()).filter(Boolean);
      if (cleanList.length === 0) {
        addToast('error', 'Please add at least one LC Number.');
        return;
      }
      if (selectedCorrectionIds.length === 0) {
        addToast('error', 'Please select at least one LC correction type.');
        return;
      }
    } else if (lcMode === 'multiple_specific') {
      const hasValid = lcEntries.some((e) => e.lcNumber.trim().length > 0 && e.correctionIds.length > 0);
      if (!hasValid) {
        addToast('error', 'Please configure at least one LC with its respective corrections.');
        return;
      }
    }

    setIsGenerating(true);

    setTimeout(() => {
      try {
        const result = draftGenerator.generateDraft({
          lcMode,
          lcNumber: lcNumber.trim(),
          lcNumbers,
          lcEntries,
          outputType,
          selectedCorrectionIds,
          details,
          settings
        });

        setCurrentDraft(result);
        setIsGenerating(false);

        // Titles for history summary
        const titles = result.correctionIds
          .map((id) => CORRECTION_TEMPLATES.find((t) => t.id === id)?.title)
          .filter((t): t is string => Boolean(t));

        storageService.addHistory({
          lcNumber: result.lcNumber,
          lcNumbers: result.lcNumbers,
          lcMode: result.lcMode,
          outputType: result.outputType,
          correctionIds: result.correctionIds,
          correctionTitles: titles,
          subject: result.subject,
          body: result.body,
          fullText: result.fullText
        });
        setHistory(storageService.getHistory());

        const modeLabel =
          lcMode === 'single'
            ? 'Single LC'
            : lcMode === 'multiple_common'
            ? 'Multiple LCs (Scenario A)'
            : 'Multiple LCs (Scenario B)';

        addToast('success', `${outputType === 'email' ? 'Email' : 'WhatsApp'} draft generated for ${modeLabel}!`);
      } catch (err: any) {
        setIsGenerating(false);
        addToast('error', err.message || 'Failed to generate draft.');
      }
    }, 180);
  }, [lcMode, lcNumber, lcNumbers, lcEntries, outputType, selectedCorrectionIds, details, settings, addToast]);

  // Follow-Up Action
  const handleFollowUp = useCallback(() => {
    try {
      const result = draftGenerator.generateFollowUp({
        lcMode,
        lcNumber: lcMode === 'single' ? lcNumber.trim() || undefined : undefined,
        lcNumbers: lcMode !== 'single' ? lcNumbers : undefined,
        outputType,
        settings
      });

      setCurrentDraft(result);

      storageService.addHistory({
        lcNumber: result.lcNumber || 'GENERAL_FOLLOW_UP',
        lcNumbers: result.lcNumbers,
        lcMode: result.lcMode,
        outputType: result.outputType,
        correctionIds: ['follow_up'],
        correctionTitles: ['Follow-Up Reminder'],
        subject: result.subject,
        body: result.body,
        fullText: result.fullText
      });
      setHistory(storageService.getHistory());

      addToast('info', 'Follow-up draft generated.');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to generate follow-up.');
    }
  }, [lcMode, lcNumber, lcNumbers, outputType, settings, addToast]);

  // Copy Draft Action
  const handleCopyDraft = useCallback((text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => {
        addToast('success', 'Copied to clipboard');
      },
      () => {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          addToast('success', 'Copied to clipboard');
        } catch {
          addToast('error', 'Unable to copy text to clipboard.');
        }
      }
    );
  }, [addToast]);

  // Clear current selections
  const handleClear = useCallback(() => {
    if (lcMode === 'multiple_specific') {
      setLcEntries((prev) => prev.map((entry) => ({ ...entry, correctionIds: [] })));
    } else {
      setSelectedCorrectionIds([]);
    }
    addToast('info', 'Selections cleared.');
  }, [lcMode, addToast]);

  // Wire Keyboard Shortcuts (Ctrl+Enter, Ctrl+Shift+C, Esc)
  useKeyboardShortcuts({
    onGenerate: handleGenerate,
    onCopy: () => {
      if (currentDraft) {
        handleCopyDraft(currentDraft.fullText);
      }
    },
    onClear: handleClear
  });

  // Toggle single correction
  const handleToggleCorrection = (id: string) => {
    setSelectedCorrectionIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  // Select all corrections
  const handleSelectAllCorrections = () => {
    setSelectedCorrectionIds(CORRECTION_TEMPLATES.map((t) => t.id));
    addToast('info', 'Selected all 22 corrections.');
  };

  // Preset Selection
  const handleSelectPreset = (preset: QuickPreset) => {
    setSelectedCorrectionIds(preset.correctionIds);
    if (preset.correctionIds.includes('total_bank_charges_limit') && !details.maxChargeAmount) {
      setDetails((prev) => ({
        ...prev,
        maxChargeAmount: settings.defaultChargeLimit || '120'
      }));
    }
    addToast('info', `Preset applied: ${preset.name}`);
  };

  // Dynamic details field updater
  const handleDetailsChange = (field: keyof AdditionalDetails, value: string) => {
    setDetails((prev) => ({ ...prev, [field]: value }));
  };

  // Save changes from inline editor
  const handleUpdateDraftContent = (newSubject: string, newBody: string) => {
    if (!currentDraft) return;
    setCurrentDraft({
      ...currentDraft,
      subject: newSubject,
      body: newBody,
      fullText: currentDraft.outputType === 'email' ? `Subject: ${newSubject}\n\n${newBody}` : newBody
    });
    addToast('success', 'Draft edits saved.');
  };

  // Reuse history item
  const handleReuseHistory = (item: HistoryItem) => {
    if (item.lcMode) {
      setLcMode(item.lcMode);
    }
    if (item.lcNumbers && item.lcNumbers.length > 0) {
      setLcNumbers(item.lcNumbers);
    }
    setLcNumber(item.lcNumber === 'GENERAL_FOLLOW_UP' ? '' : item.lcNumber);
    setOutputType(item.outputType);
    setSelectedCorrectionIds(item.correctionIds.filter((id) => id !== 'follow_up'));
    setCurrentDraft({
      subject: item.subject || '',
      body: item.body,
      fullText: item.fullText,
      outputType: item.outputType,
      lcMode: item.lcMode || 'single',
      lcNumber: item.lcNumber,
      lcNumbers: item.lcNumbers || [item.lcNumber],
      correctionIds: item.correctionIds,
      timestamp: Date.now()
    });
    addToast('info', `Loaded LC ${item.lcNumber} from history.`);
  };

  // Apply saved template
  const handleApplyTemplate = (tpl: SavedTemplate) => {
    setSelectedCorrectionIds(tpl.correctionIds);
    if (tpl.defaultDetails) {
      setDetails((prev) => ({ ...prev, ...tpl.defaultDetails }));
    }
    addToast('success', `Applied template: ${tpl.name}`);
  };

  // Save new template
  const handleSaveNewTemplate = (name: string, description: string, correctionIds: string[]) => {
    storageService.saveTemplate({
      name,
      description,
      correctionIds,
      defaultDetails: details
    });
    setSavedTemplates(storageService.getSavedTemplates());
    addToast('success', `Saved preset: ${name}`);
  };

  // Delete saved template
  const handleDeleteTemplate = (id: string) => {
    storageService.deleteSavedTemplate(id);
    setSavedTemplates(storageService.getSavedTemplates());
    addToast('info', 'Template removed.');
  };

  // Delete history item
  const handleDeleteHistory = (id: string) => {
    storageService.deleteHistoryItem(id);
    setHistory(storageService.getHistory());
  };

  // Clear all history
  const handleClearAllHistory = () => {
    storageService.clearHistory();
    setHistory([]);
    addToast('info', 'History cleared.');
  };

  // Save User Settings
  const handleSaveSettings = (newSettings: UserSettings) => {
    storageService.saveSettings(newSettings);
    setSettings(newSettings);
    addToast('success', 'Settings updated.');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Header */}
      <Header
        settings={settings}
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSaved={() => setIsSavedOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main 2-Column Dashboard Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Input Panel (7 cols on desktop) */}
          <div className="lg:col-span-7 xl:col-span-7">
            <InputPanel
              lcMode={lcMode}
              onLcModeChange={setLcMode}
              lcNumber={lcNumber}
              onLcNumberChange={setLcNumber}
              lcNumbers={lcNumbers}
              onLcNumbersChange={setLcNumbers}
              lcEntries={lcEntries}
              onLcEntriesChange={setLcEntries}
              outputType={outputType}
              onOutputTypeChange={setOutputType}
              selectedCorrectionIds={selectedCorrectionIds}
              onToggleCorrection={handleToggleCorrection}
              onSelectAllCorrections={handleSelectAllCorrections}
              onClearCorrections={handleClear}
              onSelectPreset={handleSelectPreset}
              details={details}
              onDetailsChange={handleDetailsChange}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              settings={settings}
              onApplyAudit={handleApplyAudit}
            />
          </div>

          {/* RIGHT: Generated Draft Panel (5 cols on desktop, sticky) */}
          <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-20">
            <DraftPanel
              draft={currentDraft}
              outputType={outputType}
              onCopyDraft={handleCopyDraft}
              onRegenerate={handleGenerate}
              onFollowUp={handleFollowUp}
              onClearDraft={() => setCurrentDraft(null)}
              onUpdateDraftContent={handleUpdateDraftContent}
            />
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-200/80 bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">LC Correction Generator</span>
            <span>•</span>
            <span>Textile Commercial & Export Department Tool</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-700 font-medium">✓ Scenario A & B Multiple LC Enabled</span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-blue-600 hover:underline"
            >
              Configure Office Defaults
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onReuse={handleReuseHistory}
        onDelete={handleDeleteHistory}
        onClearAll={handleClearAllHistory}
        onCopy={handleCopyDraft}
      />

      <SavedTemplatesModal
        isOpen={isSavedOpen}
        onClose={() => setIsSavedOpen(false)}
        templates={savedTemplates}
        activeCorrectionIds={selectedCorrectionIds}
        onApplyTemplate={handleApplyTemplate}
        onSaveTemplate={handleSaveNewTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Floating Toast Notification System */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
