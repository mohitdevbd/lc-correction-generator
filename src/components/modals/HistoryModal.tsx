import React, { useState } from 'react';
import { X, History, Copy, Check, Trash2, ArrowUpRight, Search, Mail, MessageSquare } from 'lucide-react';
import type { HistoryItem } from '../../types';
import { formatDate } from '../../lib/utils';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onReuse: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onCopy: (text: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onReuse,
  onDelete,
  onClearAll,
  onCopy
}) => {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    return (
      item.lcNumber.toLowerCase().includes(search.toLowerCase()) ||
      item.body.toLowerCase().includes(search.toLowerCase()) ||
      item.correctionTitles.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const handleCopy = (id: string, text: string) => {
    onCopy(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Generation History</h3>
              <p className="text-xs text-slate-500">
                View, reuse, or copy previously generated drafts (stored locally)
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

        {/* Search & Actions Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by LC number, wording, or correction type..."
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {history.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs font-medium text-rose-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors flex items-center space-x-1 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* History Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((item) => {
              const isCopied = copiedId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900 font-mono tracking-wide bg-slate-100 px-2 py-0.5 rounded">
                        {item.lcNumber || 'NO LC NUM'}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          item.outputType === 'email'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {item.outputType === 'email' ? (
                          <Mail className="h-3 w-3 mr-1" />
                        ) : (
                          <MessageSquare className="h-3 w-3 mr-1" />
                        )}
                        {item.outputType}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(item.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleCopy(item.id, item.fullText)}
                        className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200"
                        title="Copy draft text"
                      >
                        {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        onClick={() => {
                          onReuse(item);
                          onClose();
                        }}
                        className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200"
                        title="Load this LC number & corrections into main editor"
                      >
                        <ArrowUpRight className="h-3 w-3" />
                        <span>Reuse</span>
                      </button>

                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Corrections tags */}
                  {item.correctionTitles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.correctionTitles.map((title, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded font-medium"
                        >
                          {title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Snippet */}
                  <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-600 font-mono line-clamp-3 leading-relaxed whitespace-pre-wrap">
                    {item.body}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No History Records Found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {search ? 'Try clearing your search query' : 'Generated drafts will automatically appear here'}
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
