import React, { useState, useMemo } from 'react';
import {
  Mail,
  MessageSquare,
  Search,
  X,
  ArrowRight,
  Plus,
  Files,
  FileText,
  AlertCircle
} from 'lucide-react';
import type { AdditionalDetails, LcAuditResult, LcEntry, LcMode, OutputType, UserSettings } from '../../types';
import { CORRECTION_TEMPLATES, CATEGORY_LABELS } from '../../data/correctionTemplates';
import { CorrectionCard } from './CorrectionCard';
import { QuickPresetsBar } from './QuickPresetsBar';
import { DynamicFields } from './DynamicFields';
import { LcAutoScanner } from './LcAutoScanner';
import type { QuickPreset } from '../../data/defaultPresets';
import { getSalutation } from '../../services/draftGenerator';

interface InputPanelProps {
  lcMode: LcMode;
  onLcModeChange: (mode: LcMode) => void;
  // Single LC
  lcNumber: string;
  onLcNumberChange: (value: string) => void;
  // Multiple LCs - Common (Scenario A)
  lcNumbers: string[];
  onLcNumbersChange: (lcs: string[]) => void;
  // Multiple LCs - Specific (Scenario B)
  lcEntries: LcEntry[];
  onLcEntriesChange: (entries: LcEntry[]) => void;
  // Shared state
  outputType: OutputType;
  onOutputTypeChange: (type: OutputType) => void;
  selectedCorrectionIds: string[];
  onToggleCorrection: (id: string) => void;
  onSelectAllCorrections: () => void;
  onClearCorrections: () => void;
  onSelectPreset: (preset: QuickPreset) => void;
  details: AdditionalDetails;
  onDetailsChange: (field: keyof AdditionalDetails, value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  settings: UserSettings;
  onApplyAudit: (
    auditResult: LcAuditResult,
    selectedIssueIds: string[],
    suggestedDetails: Partial<AdditionalDetails>
  ) => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  lcMode,
  onLcModeChange,
  lcNumber,
  onLcNumberChange,
  lcNumbers,
  onLcNumbersChange,
  lcEntries,
  onLcEntriesChange,
  outputType,
  onOutputTypeChange,
  selectedCorrectionIds,
  onToggleCorrection,
  onSelectAllCorrections,
  onClearCorrections,
  onSelectPreset,
  details,
  onDetailsChange,
  onGenerate,
  isGenerating,
  settings,
  onApplyAudit
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDynamicOpen, setIsDynamicOpen] = useState(true);

  // Quick text input for multiple LCs (comma / space / enter paste)
  const [newLcInput, setNewLcInput] = useState('');

  // Active tab index for Scenario B
  const [activeEntryIndex, setActiveEntryIndex] = useState(0);

  // Filter corrections by search query and category
  const filteredTemplates = useMemo(() => {
    return CORRECTION_TEMPLATES.filter((tpl) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || tpl.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Helpers for Scenario A: Adding / Removing LCs
  const handleAddMultipleLcsFromInput = () => {
    if (!newLcInput.trim()) return;
    const splitLcs = newLcInput
      .split(/[,;\n\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    const merged = Array.from(new Set([...lcNumbers, ...splitLcs]));
    onLcNumbersChange(merged);
    setNewLcInput('');
  };

  const handleRemoveLcNumber = (indexToRemove: number) => {
    const updated = lcNumbers.filter((_, idx) => idx !== indexToRemove);
    onLcNumbersChange(updated);
  };

  // Helpers for Scenario B: Specific Breakdown
  const currentActiveEntry = lcEntries[activeEntryIndex] || lcEntries[0];

  const handleAddScenarioBEntry = () => {
    const newEntry: LcEntry = {
      id: 'entry_' + Date.now(),
      lcNumber: '',
      correctionIds: [],
      details: {}
    };
    onLcEntriesChange([...lcEntries, newEntry]);
    setActiveEntryIndex(lcEntries.length);
  };

  const handleRemoveScenarioBEntry = (indexToRemove: number) => {
    if (lcEntries.length <= 1) return;
    const updated = lcEntries.filter((_, idx) => idx !== indexToRemove);
    onLcEntriesChange(updated);
    if (activeEntryIndex >= updated.length) {
      setActiveEntryIndex(updated.length - 1);
    }
  };

  const handleUpdateEntryLcNumber = (index: number, newNumber: string) => {
    const updated = [...lcEntries];
    updated[index] = { ...updated[index], lcNumber: newNumber.toUpperCase() };
    onLcEntriesChange(updated);
  };

  const handleToggleEntryCorrection = (templateId: string) => {
    if (!currentActiveEntry) return;
    const currentList = currentActiveEntry.correctionIds;
    const newList = currentList.includes(templateId)
      ? currentList.filter((id) => id !== templateId)
      : [...currentList, templateId];

    const updated = [...lcEntries];
    updated[activeEntryIndex] = { ...currentActiveEntry, correctionIds: newList };
    onLcEntriesChange(updated);
  };

  const handleEntryDetailsChange = (field: keyof AdditionalDetails, value: string) => {
    if (!currentActiveEntry) return;
    const updated = [...lcEntries];
    updated[activeEntryIndex] = {
      ...currentActiveEntry,
      details: { ...currentActiveEntry.details, [field]: value }
    };
    onLcEntriesChange(updated);
  };

  // Determine active corrections list depending on mode
  const activeSelectedIds =
    lcMode === 'multiple_specific'
      ? currentActiveEntry?.correctionIds || []
      : selectedCorrectionIds;

  const activeToggleHandler =
    lcMode === 'multiple_specific'
      ? handleToggleEntryCorrection
      : onToggleCorrection;

  const activeDetails =
    lcMode === 'multiple_specific'
      ? currentActiveEntry?.details || {}
      : details;

  const activeDetailsChangeHandler =
    lcMode === 'multiple_specific'
      ? handleEntryDetailsChange
      : onDetailsChange;

  const handleSelectAllActive = () => {
    if (lcMode === 'multiple_specific') {
      if (!currentActiveEntry) return;
      const updated = [...lcEntries];
      updated[activeEntryIndex] = {
        ...currentActiveEntry,
        correctionIds: CORRECTION_TEMPLATES.map((t) => t.id)
      };
      onLcEntriesChange(updated);
    } else {
      onSelectAllCorrections();
    }
  };

  const handleClearActive = () => {
    if (lcMode === 'multiple_specific') {
      if (!currentActiveEntry) return;
      const updated = [...lcEntries];
      updated[activeEntryIndex] = {
        ...currentActiveEntry,
        correctionIds: []
      };
      onLcEntriesChange(updated);
    } else {
      onClearCorrections();
    }
  };

  const handleSelectPresetActive = (preset: QuickPreset) => {
    if (lcMode === 'multiple_specific') {
      if (!currentActiveEntry) return;
      const updated = [...lcEntries];
      updated[activeEntryIndex] = {
        ...currentActiveEntry,
        correctionIds: preset.correctionIds
      };
      onLcEntriesChange(updated);
    } else {
      onSelectPreset(preset);
    }
  };

  const previewSalutation = useMemo(() => {
    return getSalutation(activeDetails, settings, outputType).replace(/\n/g, ' ');
  }, [activeDetails, settings, outputType]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-6">
      {/* Smart LC Auto-Scanner — PDF Upload & SWIFT Text Parse */}
      <LcAutoScanner
        settings={settings}
        onApplyAudit={onApplyAudit}
      />

      {/* Panel Header & Mode Switch */}
      <div className="border-b border-slate-100 pb-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span>LC Correction Details</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select single or multiple LC workflow & configure required amendments
            </p>
          </div>

          {/* Mode Pill Toggle: Single LC vs Multiple LC */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
            <button
              type="button"
              onClick={() => onLcModeChange('single')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                lcMode === 'single'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>Single LC</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (lcMode === 'single') {
                  onLcModeChange('multiple_common');
                }
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                lcMode !== 'single'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Files className="h-3.5 w-3.5 shrink-0" />
              <span>Multiple LC</span>
            </button>
          </div>
        </div>

        {/* Sub-toggle if Multiple LCs is active: Scenario A (Common) vs Scenario B (Breakdown) */}
        {lcMode !== 'single' && (
          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fadeIn">
            <div className="text-xs">
              <span className="font-bold text-blue-950 block">Multiple LC Mode:</span>
              <span className="text-blue-700 text-[11px]">
                {lcMode === 'multiple_common'
                  ? 'Scenario A (Recommended): Selected amendments apply to all listed LCs together.'
                  : 'Scenario B: Configure different amendments individually for each LC.'}
              </span>
            </div>

            <div className="flex items-center bg-white p-0.5 rounded-lg border border-blue-200 shrink-0">
              <button
                type="button"
                onClick={() => onLcModeChange('multiple_common')}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all ${
                  lcMode === 'multiple_common'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Scenario A: Common (All LCs)
              </button>
              <button
                type="button"
                onClick={() => onLcModeChange('multiple_specific')}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all ${
                  lcMode === 'multiple_specific'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Scenario B: LC Breakdown
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Row 1: LC Numbers Input & Output Type Selector */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* LC Number Input Area (Single vs Multiple) */}
        <div className="md:col-span-8 space-y-2">
          {lcMode === 'single' ? (
            /* Single LC Mode */
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span>LC Number <span className="text-rose-500">*</span></span>
                <span className="text-[11px] font-normal text-slate-400">e.g. DPCBD1193B15</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={lcNumber}
                  onChange={(e) => onLcNumberChange(e.target.value.toUpperCase())}
                  placeholder="Enter LC Number (e.g. DPCBD1193B15)"
                  className="w-full px-3 py-2 text-sm font-semibold tracking-wider text-slate-800 placeholder:text-slate-400 placeholder:font-normal rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all uppercase bg-slate-50/50"
                />
                {lcNumber && (
                  <button
                    type="button"
                    onClick={() => onLcNumberChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : lcMode === 'multiple_common' ? (
            /* Scenario A: Multiple LCs - Common Amendments */
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block flex items-center justify-between">
                <span>Enter Multiple LC Numbers (Scenario A) <span className="text-rose-500">*</span></span>
                <span className="text-[11px] font-normal text-slate-400">Comma, space, or enter to add</span>
              </label>

              {/* Tag input box */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newLcInput}
                  onChange={(e) => setNewLcInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddMultipleLcsFromInput();
                    }
                  }}
                  placeholder="Type or paste LC numbers (e.g. DPCBD1193B15, DPCBD1194B16)..."
                  className="flex-1 px-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={handleAddMultipleLcsFromInput}
                  disabled={!newLcInput.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add LC</span>
                </button>
              </div>

              {/* LC Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {lcNumbers.map((lc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs"
                  >
                    <span>LC {idx + 1}: {lc}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLcNumber(idx)}
                      className="text-blue-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                      title="Remove LC"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {lcNumbers.length === 0 && (
                  <span className="text-xs text-rose-500 flex items-center space-x-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Please add at least 2 LC numbers above.</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Scenario B: Multiple LCs - Specific Breakdown */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">
                  Configuring LCs (Scenario B: LC-Wise Breakdown)
                </label>
                <button
                  type="button"
                  onClick={handleAddScenarioBEntry}
                  className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Another LC</span>
                </button>
              </div>

              {/* LC Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {lcEntries.map((entry, idx) => {
                  const isActive = activeEntryIndex === idx;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => setActiveEntryIndex(idx)}
                      className={`cursor-pointer shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>LC {idx + 1}: {entry.lcNumber || 'UNNAMED'}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] ${isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'}`}>
                        {entry.correctionIds.length}
                      </span>
                      {lcEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveScenarioBEntry(idx);
                          }}
                          className={`p-0.5 rounded transition-colors ${isActive ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-rose-600'}`}
                          title="Remove this LC"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Active Tab LC Number Edit Box */}
              {currentActiveEntry && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-700 shrink-0">
                    Editing LC {activeEntryIndex + 1} Number:
                  </span>
                  <input
                    type="text"
                    value={currentActiveEntry.lcNumber}
                    onChange={(e) => handleUpdateEntryLcNumber(activeEntryIndex, e.target.value)}
                    placeholder="Enter LC Number..."
                    className="flex-1 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <span className="text-[11px] text-slate-400">
                    Select corrections below for this LC
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Output Type Segmented Buttons */}
        <div className="md:col-span-4">
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            Output Type
          </label>
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => onOutputTypeChange('email')}
              className={`flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                outputType === 'email'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Email</span>
            </button>
            <button
              type="button"
              onClick={() => onOutputTypeChange('message')}
              className={`flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                outputType === 'message'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Salutation / Greeting Selector */}
      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
            <span>Greeting / Salutation:</span>
          </label>
          <span className="text-[11px] text-slate-500 font-medium truncate max-w-xs">
            Preview: <span className="text-blue-700 font-semibold font-mono">"{previewSalutation}"</span>
          </span>
        </div>

        {/* Quick Salutation Pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => activeDetailsChangeHandler('salutationType', 'dear_sir_madam')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-all ${
              (activeDetails.salutationType || 'dear_sir_madam') === 'dear_sir_madam'
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Dear Sir/Madam,
          </button>

          <button
            type="button"
            onClick={() => activeDetailsChangeHandler('salutationType', 'assalamu_alaikum')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-all ${
              activeDetails.salutationType === 'assalamu_alaikum'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Assalamu Alaikum,
          </button>

          <button
            type="button"
            onClick={() => activeDetailsChangeHandler('salutationType', 'dear_recipient')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-all ${
              activeDetails.salutationType === 'dear_recipient'
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Dear Mr. XYZ,
          </button>

          <button
            type="button"
            onClick={() => activeDetailsChangeHandler('salutationType', 'assalamu_alaikum_dear_sir')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-all ${
              activeDetails.salutationType === 'assalamu_alaikum_dear_sir'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Assalamu Alaikum & Dear Sir/Madam,
          </button>

          <button
            type="button"
            onClick={() => activeDetailsChangeHandler('salutationType', 'custom')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-all ${
              activeDetails.salutationType === 'custom'
                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Custom...
          </button>
        </div>

        {/* Dynamic Name or Custom text input */}
        {(activeDetails.salutationType === 'dear_recipient' ||
          activeDetails.salutationType === 'assalamu_alaikum' ||
          activeDetails.salutationType === 'assalamu_alaikum_dear_sir') && (
          <div className="flex items-center space-x-2 pt-1 animate-fadeIn">
            <span className="text-[11px] font-semibold text-slate-600 shrink-0">
              Recipient Name:
            </span>
            <input
              type="text"
              value={activeDetails.recipientName || ''}
              onChange={(e) => activeDetailsChangeHandler('recipientName', e.target.value)}
              placeholder="e.g. XYZ or Mr. Rahman or John (Optional)"
              className="flex-1 px-2.5 py-1 text-xs bg-white rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>
        )}

        {activeDetails.salutationType === 'custom' && (
          <div className="flex items-center space-x-2 pt-1 animate-fadeIn">
            <span className="text-[11px] font-semibold text-slate-600 shrink-0">
              Custom Greeting:
            </span>
            <input
              type="text"
              value={activeDetails.customSalutation || ''}
              onChange={(e) => activeDetailsChangeHandler('customSalutation', e.target.value)}
              placeholder="e.g. Respected Commercial Team, or Dear All,"
              className="flex-1 px-2.5 py-1 text-xs bg-white rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-purple-500 font-medium"
            />
          </div>
        )}
      </div>

      {/* Quick Presets Bar (Available for Single, Scenario A, and Scenario B active LC) */}
      <QuickPresetsBar
        selectedCorrectionIds={activeSelectedIds}
        onSelectPreset={handleSelectPresetActive}
      />

      {/* Search & Categories Filter */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search correction type (e.g. payment, PI, charges, date)..."
              className="w-full pl-8.5 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Quick select/clear links */}
          <div className="flex items-center space-x-2 shrink-0 text-xs">
            <button
              type="button"
              onClick={handleSelectAllActive}
              className="text-slate-500 hover:text-blue-600 transition-colors"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleClearActive}
              className="text-slate-500 hover:text-rose-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
            const isCatActive = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setSelectedCategory(catKey)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  isCatActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {catLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selectable Correction Cards Grid */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>
            {lcMode === 'multiple_specific'
              ? `Select Corrections for LC ${activeEntryIndex + 1} (${currentActiveEntry?.lcNumber || ''})`
              : 'Correction Types (Select Multiple)'}
          </span>
          <span className="text-[11px] font-normal text-slate-400">
            {activeSelectedIds.length} selected for current view
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
          {filteredTemplates.map((template) => {
            const isSelected = activeSelectedIds.includes(template.id);
            return (
              <CorrectionCard
                key={template.id}
                template={template}
                isSelected={isSelected}
                onToggle={activeToggleHandler}
              />
            );
          })}

          {filteredTemplates.length === 0 && (
            <div className="col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Search className="h-6 w-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600">No corrections found matching "{searchQuery}"</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Clear search filter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Smart Fields */}
      <DynamicFields
        selectedCorrectionIds={activeSelectedIds}
        details={activeDetails}
        onChange={activeDetailsChangeHandler}
        isOpen={isDynamicOpen}
        onToggleOpen={() => setIsDynamicOpen(!isDynamicOpen)}
        defaultCurrency={settings.defaultCurrency}
      />

      {/* Large Primary Generate Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold tracking-wide shadow-md flex items-center justify-center space-x-2 transition-all bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white shadow-blue-600/25 hover:shadow-blue-600/35"
        >
          {isGenerating ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Generating Draft...</span>
            </>
          ) : (
            <>
              <span>
                {lcMode === 'single'
                  ? 'Generate Draft'
                  : lcMode === 'multiple_common'
                  ? `Generate Draft for All ${lcNumbers.length} LCs (Scenario A)`
                  : `Generate Breakdown Draft for ${lcEntries.length} LCs (Scenario B)`}
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-blue-700/60 rounded font-mono text-blue-100">
                Ctrl + Enter
              </span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
