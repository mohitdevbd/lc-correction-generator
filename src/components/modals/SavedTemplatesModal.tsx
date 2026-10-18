import React, { useState } from 'react';
import { X, Bookmark, Plus, Trash2, ArrowRight } from 'lucide-react';
import type { SavedTemplate } from '../../types';
import { CORRECTION_TEMPLATES } from '../../data/correctionTemplates';

interface SavedTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: SavedTemplate[];
  activeCorrectionIds: string[];
  onApplyTemplate: (template: SavedTemplate) => void;
  onSaveTemplate: (name: string, description: string, correctionIds: string[]) => void;
  onDeleteTemplate: (id: string) => void;
}

export const SavedTemplatesModal: React.FC<SavedTemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  activeCorrectionIds,
  onApplyTemplate,
  onSaveTemplate,
  onDeleteTemplate
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;
    onSaveTemplate(templateName.trim(), templateDesc.trim(), activeCorrectionIds);
    setTemplateName('');
    setTemplateDesc('');
    setIsCreating(false);
  };

  const getTitle = (id: string) => {
    return CORRECTION_TEMPLATES.find((t) => t.id === id)?.title || id;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Bookmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Saved Favorites & Combinations</h3>
              <p className="text-xs text-slate-500">
                Quickly load your frequently used LC correction combinations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Create new template button / form */}
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          {!isCreating ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">
                Current selection has <strong className="text-slate-900">{activeCorrectionIds.length}</strong> correction{activeCorrectionIds.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                disabled={activeCorrectionIds.length === 0}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCorrectionIds.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Save Current as Favorite</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3 bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">New Saved Preset</span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Cancel
                </button>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Preset Name *</label>
                <input
                  type="text"
                  required
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Fabric Export Standard Corrections"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  placeholder="e.g. Overdue, payment clarity, charges cap"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Save Preset
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {templates.length > 0 ? (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{tpl.name}</h4>
                      {tpl.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{tpl.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => onDeleteTemplate(tpl.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Delete preset"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* List of included corrections */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {tpl.correctionIds.map((cid) => (
                      <span
                        key={cid}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {getTitle(cid)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {tpl.correctionIds.length} clauses included
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyTemplate(tpl);
                      onClose();
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors border border-blue-200"
                  >
                    <span>Load Preset</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10">
              <Bookmark className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Saved Presets Yet</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Select your frequent LC corrections and click "Save Current as Favorite"
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
