import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Edit3,
  RotateCcw,
  Trash2,
  Mail,
  MessageSquare,
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';
import type { DraftResult, OutputType } from '../../types';

interface DraftPanelProps {
  draft: DraftResult | null;
  outputType: OutputType;
  onCopyDraft: (text: string) => void;
  onRegenerate: () => void;
  onFollowUp: () => void;
  onClearDraft: () => void;
  onUpdateDraftContent: (newSubject: string, newBody: string) => void;
}

export const DraftPanel: React.FC<DraftPanelProps> = ({
  draft,
  onCopyDraft,
  onRegenerate,
  onFollowUp,
  onClearDraft,
  onUpdateDraftContent
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  const [showRegenerateWarning, setShowRegenerateWarning] = useState(false);
  const [copiedSection, setCopiedSection] = useState<'all' | 'subject' | 'body' | null>(null);

  // Sync state when draft updates externally
  useEffect(() => {
    if (draft) {
      setEditedSubject(draft.subject);
      setEditedBody(draft.body);
      setIsManuallyEdited(false);
      setIsEditing(false);
      setShowRegenerateWarning(false);
    }
  }, [draft]);

  const handleCopyAll = () => {
    if (!draft) return;
    const textToCopy = draft.outputType === 'email'
      ? `Subject: ${editedSubject}\n\n${editedBody}`
      : editedBody;
    onCopyDraft(textToCopy);
    setCopiedSection('all');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopySubject = () => {
    if (!editedSubject) return;
    onCopyDraft(editedSubject);
    setCopiedSection('subject');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyBody = () => {
    if (!editedBody) return;
    onCopyDraft(editedBody);
    setCopiedSection('body');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleSaveChanges = () => {
    onUpdateDraftContent(editedSubject, editedBody);
    setIsEditing(false);
    setIsManuallyEdited(true);
  };

  const handleRegenerateClick = () => {
    if (isManuallyEdited) {
      setShowRegenerateWarning(true);
      return;
    }
    onRegenerate();
  };

  const confirmRegenerate = () => {
    setShowRegenerateWarning(false);
    setIsManuallyEdited(false);
    onRegenerate();
  };

  const wordCount = editedBody.trim().split(/\s+/).filter(Boolean).length;
  const charCount = editedBody.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-4 flex flex-col h-full min-h-[580px]">
      {/* Draft Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Generated Draft
            </h2>
            {draft && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                  draft.outputType === 'email'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {draft.outputType === 'email' ? 'Email' : 'WhatsApp'}
              </span>
            )}
            {isManuallyEdited && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Edited
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {draft ? `Ready to send for LC: ${draft.lcNumber || 'N/A'}` : 'Generate or pick a preset to view output'}
          </p>
        </div>

        {/* Top Action Toolbar */}
        {draft && (
          <div className="flex items-center flex-wrap gap-1.5">
            {/* Follow Up Button */}
            <button
              type="button"
              onClick={onFollowUp}
              title="Generate a follow-up reminder email/message"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Follow Up</span>
            </button>

            {/* Edit / Save Button */}
            {isEditing ? (
              <button
                type="button"
                onClick={handleSaveChanges}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                <span>Edit</span>
              </button>
            )}

            {/* Regenerate Button */}
            <button
              type="button"
              onClick={handleRegenerateClick}
              title="Regenerate from current selections"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Regenerate</span>
            </button>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs"
            >
              {copiedSection === 'all' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-white" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>{draft.outputType === 'email' ? 'Copy Email' : 'Copy Message'}</span>
                </>
              )}
            </button>

            {/* Clear Button */}
            <button
              type="button"
              onClick={onClearDraft}
              title="Clear draft"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Regenerate Confirmation Modal Warning */}
      {showRegenerateWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between space-x-3 text-xs text-amber-900 animate-fadeIn">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Regenerating will replace your current manual edits.</p>
              <p className="text-[11px] text-amber-700 mt-0.5">Are you sure you want to discard your custom edits and regenerate?</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowRegenerateWarning(false)}
              className="px-2 py-1 bg-white text-slate-700 border border-slate-200 rounded text-[11px] hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRegenerate}
              className="px-2 py-1 bg-amber-600 text-white rounded text-[11px] hover:bg-amber-700 font-semibold"
            >
              Yes, Replace
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {draft ? (
        <div className="flex-1 flex flex-col space-y-3">
          {/* Subject Field (Only for Email output) */}
          {draft.outputType === 'email' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Subject Line
                </span>
                <button
                  type="button"
                  onClick={handleCopySubject}
                  className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  {copiedSection === 'subject' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSection === 'subject' ? 'Copied' : 'Copy Subject'}</span>
                </button>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => {
                    setEditedSubject(e.target.value);
                    setIsManuallyEdited(true);
                  }}
                  className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <p className="text-xs font-semibold text-slate-800 select-all font-mono">
                  {editedSubject}
                </p>
              )}
            </div>
          )}

          {/* Draft Body Content */}
          <div className="flex-1 flex flex-col relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            {/* Header info bar */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50/80 border-b border-slate-200 text-xs text-slate-500">
              <span className="font-medium flex items-center space-x-1.5">
                {draft.outputType === 'email' ? (
                  <>
                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                    <span>Email Body</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                    <span>WhatsApp / Message Body</span>
                  </>
                )}
              </span>

              <div className="flex items-center space-x-3 text-[11px]">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} characters</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleCopyBody}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {copiedSection === 'body' ? 'Copied Body' : 'Copy Body'}
                </button>
              </div>
            </div>

            {/* Editable or Formatted Body */}
            {isEditing ? (
              <textarea
                value={editedBody}
                onChange={(e) => {
                  setEditedBody(e.target.value);
                  setIsManuallyEdited(true);
                }}
                rows={16}
                className="w-full flex-1 p-4 text-xs font-mono text-slate-800 leading-relaxed resize-none focus:outline-hidden bg-slate-50/30"
                placeholder="Draft content..."
              />
            ) : (
              <div
                className={`flex-1 p-4 overflow-y-auto ${
                  draft.outputType === 'message'
                    ? 'bg-emerald-50/20 font-sans text-xs'
                    : 'font-sans text-xs text-slate-800'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed select-text">
                  {editedBody}
                </pre>
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs text-slate-500">
            <span className="text-[11px] text-slate-400">
              Shortcut: <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px]">Ctrl+Shift+C</kbd> to copy draft
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopyAll}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-xs transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copiedSection === 'all' ? 'Copied to Clipboard!' : 'Copy Complete Draft'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-2xs">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No Draft Generated Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Enter an LC number on the left, pick the required correction types or quick presets, and click <strong>Generate Draft</strong>.
          </p>
          <div className="mt-4 flex items-center space-x-2 text-xs text-slate-400 font-mono">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-2xs text-slate-700">Ctrl + Enter</kbd>
            <span>anytime to generate</span>
          </div>
        </div>
      )}
    </div>
  );
};
