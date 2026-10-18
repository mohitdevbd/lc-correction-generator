import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSearch,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  ClipboardPaste,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import type { LcAuditResult, UserSettings, AdditionalDetails } from '../../types';
import { extractTextFromPdf, auditLcText } from '../../services/lcParserService';

interface LcAutoScannerProps {
  settings: UserSettings;
  onApplyAudit: (
    auditResult: LcAuditResult,
    selectedIssueIds: string[],
    suggestedDetails: Partial<AdditionalDetails>
  ) => void;
}

export const LcAutoScanner: React.FC<LcAutoScannerProps> = ({
  settings,
  onApplyAudit
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  // Scan Results
  const [auditResult, setAuditResult] = useState<LcAuditResult | null>(null);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessText = (text: string, sourceName: string) => {
    if (!text.trim()) {
      setErrorMsg('No text content found in document.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setErrorMsg(null);
      setFileName(sourceName);

      // Perform commercial rule-based audit
      const result = auditLcText(text, settings);
      setAuditResult(result);

      // By default, select all detected issues
      setSelectedIssueIds(result.issues.map((i) => i.id));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error occurred while scanning LC.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setIsAnalyzing(true);
    setFileName(file.name);

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const extractedText = await extractTextFromPdf(file);
        handleProcessText(extractedText, file.name);
      } else {
        // Text / raw swift format
        const text = await file.text();
        handleProcessText(text, file.name);
      }
    } catch (err: any) {
      setErrorMsg('Could not read PDF. Make sure it is not password protected.');
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleToggleIssue = (issueId: string) => {
    setSelectedIssueIds((prev) =>
      prev.includes(issueId)
        ? prev.filter((id) => id !== issueId)
        : [...prev, issueId]
    );
  };

  const handleApply = () => {
    if (!auditResult) return;

    // Combine suggested details from all selected issues
    const combinedDetails: Partial<AdditionalDetails> = {};
    auditResult.issues.forEach((issue) => {
      if (selectedIssueIds.includes(issue.id) && issue.suggestedDetails) {
        Object.assign(combinedDetails, issue.suggestedDetails);
      }
    });

    onApplyAudit(auditResult, selectedIssueIds, combinedDetails);
    setIsOpen(false);
    setAuditResult(null);
    setFileName(null);
    setPastedText('');
  };

  const handleReset = () => {
    setAuditResult(null);
    setErrorMsg(null);
    setFileName(null);
    setPastedText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-slate-50 p-3.5 transition-all shadow-xs">
      {/* Banner / Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-900">
                Smart LC Auto-Scan & Audit
              </span>
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                PDF & SWIFT
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Upload LC PDF or paste MT700 text to auto-detect discrepancies and fill clauses instantly
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center space-x-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer"
        >
          <FileSearch className="h-3.5 w-3.5" />
          <span>{isOpen ? 'Close Scanner' : 'Open Auto-Scanner'}</span>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
          )}
        </button>
      </div>

      {/* Expanded Scanner Panel */}
      {isOpen && (
        <div className="mt-4 pt-3.5 border-t border-indigo-100/80 space-y-4">
          {!auditResult ? (
            <>
              {/* Tab Selector */}
              <div className="flex items-center space-x-2 border-b border-indigo-100 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'upload'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-indigo-50/50'
                  }`}
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Upload LC PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'paste'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-indigo-50/50'
                  }`}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span>Paste SWIFT / MT700 Text</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              {activeTab === 'upload' && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/70'
                      : 'border-indigo-200 bg-white/80 hover:border-indigo-400 hover:bg-white'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {isAnalyzing ? (
                    <div className="flex flex-col items-center space-y-2">
                      <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                      <span className="text-xs font-medium text-slate-700">
                        Analyzing LC clauses against UCP 600 & export standards...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 rounded-full bg-indigo-50 p-2.5 text-indigo-600">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-semibold text-slate-800">
                        Click to browse or drag and drop your LC PDF here
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Supports PDF (SWIFT MT700 or scanned doc) & Text files • 100% processed locally
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Paste Text Area */}
              {activeTab === 'paste' && (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste full MT700 Swift text or LC copy here (e.g. :20:LC12345 :31D:261130 :71D:...)"
                    className="w-full rounded-xl border border-indigo-200 bg-white p-3 text-xs font-mono text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!pastedText.trim() || isAnalyzing}
                      onClick={() => handleProcessText(pastedText, 'Pasted SWIFT Text')}
                      className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Scanning...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Analyze Text</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="flex items-center space-x-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                  <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </>
          ) : (
            /* Audit Results View */
            <div className="space-y-4">
              {/* Result Meta Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-white p-3 border border-indigo-200/90 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      {fileName || 'LC Document'}
                    </span>
                    {auditResult.detectedLcNumber && (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-mono font-bold text-blue-700 border border-blue-200">
                        LC #{auditResult.detectedLcNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    {auditResult.detectedExpiryDate && (
                      <span>Expiry: <strong className="text-slate-700">{auditResult.detectedExpiryDate}</strong></span>
                    )}
                    {auditResult.detectedShipmentDate && (
                      <span>Shipment: <strong className="text-slate-700">{auditResult.detectedShipmentDate}</strong></span>
                    )}
                    {auditResult.detectedAmount && (
                      <span>Amount: <strong className="text-slate-700">{auditResult.detectedCurrency || 'USD'} {auditResult.detectedAmount}</strong></span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 self-end sm:self-center"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Scan Another File</span>
                </button>
              </div>

              {/* Detected Issues List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Detected Discrepancies & Amendment Suggestions ({auditResult.issues.length})
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIssueIds(auditResult.issues.map((i) => i.id))}
                      className="text-[11px] text-indigo-600 hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedIssueIds([])}
                      className="text-[11px] text-slate-500 hover:underline font-medium"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {auditResult.issues.length === 0 ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-emerald-900">
                      No High-Risk Commercial Clauses Detected!
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      The scanned text does not contain any obvious discrepancies or outside charges on beneficiary.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {auditResult.issues.map((issue) => {
                      const isSelected = selectedIssueIds.includes(issue.id);
                      return (
                        <div
                          key={issue.id}
                          onClick={() => handleToggleIssue(issue.id)}
                          className={`flex items-start space-x-3 rounded-xl border p-3 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-indigo-300 bg-white shadow-xs'
                              : 'border-slate-200 bg-slate-50/70 opacity-60 hover:opacity-90'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by container onClick
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center space-x-2">
                              {issue.severity === 'critical' && (
                                <span className="inline-flex items-center rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" /> High Risk
                                </span>
                              )}
                              {issue.severity === 'warning' && (
                                <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" /> Warning
                                </span>
                              )}
                              {issue.severity === 'info' && (
                                <span className="inline-flex items-center rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                  Advisory
                                </span>
                              )}
                              <h4 className="text-xs font-bold text-slate-900">
                                {issue.title}
                              </h4>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed">
                              {issue.reason}
                            </p>

                            {issue.detectedText && (
                              <div className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-700 border border-slate-200/60 mt-1">
                                <span className="font-semibold text-slate-500">LC Snippet: </span>
                                "{issue.detectedText}"
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-indigo-100">
                <span className="text-xs text-slate-500">
                  {selectedIssueIds.length} clause{selectedIssueIds.length === 1 ? '' : 's'} selected to apply
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedIssueIds.length === 0 && !auditResult.detectedLcNumber}
                    onClick={handleApply}
                    className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Apply to Generator & Edit</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
