import React, { useState } from 'react';
import { X, Settings, RotateCcw, Check } from 'lucide-react';
import type { OutputType, UserSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave
}) => {
  const [formData, setFormData] = useState<UserSettings>(settings);

  if (!isOpen) return null;

  const handleChange = (field: keyof UserSettings, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-update email signature if user name, department, or company changes and signature hasn't been custom modified
      if (['userName', 'department', 'companyName'].includes(field)) {
        updated.emailSignature = `Best regards,\n${updated.userName}\n${updated.department}\n${updated.companyName}`;
      }
      return updated;
    });
  };

  const handleResetDefaults = () => {
    setFormData(DEFAULT_SETTINGS);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Commercial Office Settings</h3>
              <p className="text-xs text-slate-500">
                Configure your signature, company identity, and default values
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Executive User Name
              </label>
              <input
                type="text"
                required
                value={formData.userName}
                onChange={(e) => handleChange('userName', e.target.value)}
                placeholder="e.g. Mohit"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Department
              </label>
              <input
                type="text"
                required
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="e.g. Commercial Department"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Company Name
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              placeholder="e.g. NZ Textile Ltd."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Default Currency
              </label>
              <input
                type="text"
                required
                value={formData.defaultCurrency}
                onChange={(e) => handleChange('defaultCurrency', e.target.value.toUpperCase())}
                placeholder="USD"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Default Charge Limit
              </label>
              <input
                type="text"
                required
                value={formData.defaultChargeLimit}
                onChange={(e) => handleChange('defaultChargeLimit', e.target.value)}
                placeholder="120"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Default Output
              </label>
              <select
                value={formData.defaultOutputType}
                onChange={(e) => handleChange('defaultOutputType', e.target.value as OutputType)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="email">Email</option>
                <option value="message">WhatsApp / Msg</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Default Greeting
              </label>
              <select
                value={formData.defaultSalutationType || 'dear_sir_madam'}
                onChange={(e) => handleChange('defaultSalutationType', e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="dear_sir_madam">Dear Sir/Madam,</option>
                <option value="assalamu_alaikum">Assalamu Alaikum,</option>
                <option value="dear_recipient">Dear Mr. XYZ,</option>
                <option value="assalamu_alaikum_dear_sir">Assalamu Alaikum & Dear Sir,</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Email Closing Signature
            </label>
            <textarea
              rows={4}
              value={formData.emailSignature || ''}
              onChange={(e) => handleChange('emailSignature', e.target.value)}
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
              placeholder="Signature..."
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Automatically appended at the end of generated email drafts.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
