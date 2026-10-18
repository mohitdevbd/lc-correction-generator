import React from 'react';
import { Check } from 'lucide-react';
import type { CorrectionTemplate } from '../../types';
import { IconRenderer } from '../common/IconRenderer';

interface CorrectionCardProps {
  template: CorrectionTemplate;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export const CorrectionCard: React.FC<CorrectionCardProps> = ({
  template,
  isSelected,
  onToggle
}) => {
  return (
    <div
      onClick={() => onToggle(template.id)}
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle(template.id);
        }
      }}
      className={`group relative flex items-start p-3 rounded-xl border text-left cursor-pointer select-none transition-all duration-150 ${
        isSelected
          ? 'bg-blue-50/60 border-blue-500 shadow-xs ring-1 ring-blue-500/20'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
      }`}
    >
      {/* Icon */}
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mr-3 transition-colors ${
          isSelected
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-800'
        }`}
      >
        <IconRenderer name={template.icon} className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center space-x-1.5">
          <span className={`text-xs font-semibold leading-tight truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
            {template.title}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
          {template.shortDescription}
        </p>
      </div>

      {/* Checkbox indicator */}
      <div
        className={`absolute top-3 right-3 h-4 w-4 rounded flex items-center justify-center border transition-all ${
          isSelected
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'border-slate-300 bg-white group-hover:border-slate-400'
        }`}
      >
        {isSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
      </div>
    </div>
  );
};
