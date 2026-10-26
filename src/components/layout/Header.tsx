import React from 'react';
import { History, Bookmark, Settings } from 'lucide-react';
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
          {/* App Branding: LCMailer */}
          <div className="flex items-center space-x-3">
            {/* Custom Modern Gradient Logo: Envelope + Document Fusion */}
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-0.5 shadow-md shadow-indigo-500/25 ring-2 ring-indigo-500/20">
              <div className="h-full w-full rounded-[10px] bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-1.5">
                <svg viewBox="0 0 48 48" fill="none" className="h-full w-full drop-shadow-sm">
                  {/* Paper popping out */}
                  <rect x="13" y="6" width="22" height="20" rx="3" fill="#FFFFFF" />
                  <line x1="17" y1="11" x2="25" y2="11" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="17" y1="16" x2="31" y2="16" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="17" y1="20" x2="28" y2="20" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="28" cy="11" r="3.2" fill="#10B981" />
                  <path d="M26.8 11L27.7 11.9L29.3 10.2" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Envelope Base */}
                  <rect x="6" y="15" width="36" height="25" rx="5" fill="#4F46E5" fillOpacity="0.9" />
                  <path d="M6 38L21 26C22.8 24.6 25.2 24.6 27 26L42 38" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 17L21.8 28.6C23.1 29.5 24.9 29.5 26.2 28.6L42 17" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1">
                  <span>LC</span>
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Mailer
                  </span>
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-2xs">
                  Pro Studio
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block font-medium">
                Automated LC Correction & Email Studio
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
