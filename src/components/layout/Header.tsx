import React from 'react';
import { History, Bookmark, Settings, FileCheck2 } from 'lucide-react';
import type { UserSettings } from '../../types';

interface HeaderProps {
  settings: UserSettings;
  historyCount: number;
  onOpenHistory: () => void;
  onOpenSaved: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  historyCount,
  onOpenHistory,
  onOpenSaved,
  onOpenSettings,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* App Branding */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-500/20">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  LC Correction Generator
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Commercial Dept
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Generate professional LC amendment emails & messages in seconds.
              </p>
            </div>
          </div>

          {/* User context & Action buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Quick user badge */}
            <div className="hidden md:flex flex-col text-right text-xs pr-2 border-r border-slate-200">
              <span className="font-semibold text-slate-700">{settings.userName}</span>
              <span className="text-slate-400">{settings.companyName}</span>
            </div>

            {/* Saved Templates Button */}
            <button
              onClick={onOpenSaved}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors"
              title="Saved Templates & Favorites"
            >
              <Bookmark className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">Saved</span>
            </button>

            {/* History Button */}
            <button
              onClick={onOpenHistory}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors relative"
              title="Generation History"
            >
              <History className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">History</span>
              {historyCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold text-white bg-blue-600 rounded-full">
                  {historyCount}
                </span>
              )}
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors"
              title="Office & Signature Settings"
            >
              <Settings className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
