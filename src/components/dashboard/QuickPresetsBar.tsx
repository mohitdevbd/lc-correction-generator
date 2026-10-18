import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import { QUICK_PRESETS, type QuickPreset } from '../../data/defaultPresets';
import { IconRenderer } from '../common/IconRenderer';

interface QuickPresetsBarProps {
  selectedCorrectionIds: string[];
  onSelectPreset: (preset: QuickPreset) => void;
}

export const QuickPresetsBar: React.FC<QuickPresetsBarProps> = ({
  selectedCorrectionIds,
  onSelectPreset
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5 uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Quick Corrections</span>
        </label>
        <span className="text-[11px] text-slate-400">1-click presets</span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
        {QUICK_PRESETS.map((preset) => {
          // Check if this preset's IDs are currently all active
          const isActive = preset.correctionIds.every((id) => selectedCorrectionIds.includes(id));

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              title={preset.description}
              className={`shrink-0 inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs font-semibold ring-1 ring-blue-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <IconRenderer name={preset.icon} className={`h-3.5 w-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>{preset.name}</span>
              {isActive && <Check className="h-3 w-3 text-blue-600 ml-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
