import type { HistoryItem, SavedTemplate, UserSettings } from '../types';

const SETTINGS_KEY = 'lc_gen_user_settings_v1';
const HISTORY_KEY = 'lc_gen_history_v1';
const SAVED_TEMPLATES_KEY = 'lc_gen_saved_templates_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  userName: 'Mohit',
  companyName: 'NZ Textile Ltd.',
  department: 'Commercial Department',
  emailSignature: `Best regards,
Mohit
Commercial Department
NZ Textile Ltd.`,
  defaultCurrency: 'USD',
  defaultChargeLimit: '120',
  defaultOutputType: 'email',
  defaultSalutationType: 'dear_sir_madam'
};

export const storageService = {
  getSettings(): UserSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (!data) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: UserSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  },

  getHistory(): HistoryItem[] {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addHistory(item: Omit<HistoryItem, 'id' | 'timestamp'>): HistoryItem {
    const newItem: HistoryItem = {
      ...item,
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now()
    };
    try {
      const existing = this.getHistory();
      // Keep most recent 50
      const updated = [newItem, ...existing.filter(h => h.lcNumber !== item.lcNumber || h.outputType !== item.outputType || h.body !== item.body)].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to append to history', e);
    }
    return newItem;
  },

  deleteHistoryItem(id: string): void {
    try {
      const existing = this.getHistory();
      const updated = existing.filter(item => item.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete history item', e);
    }
  },

  clearHistory(): void {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.error('Failed to clear history', e);
    }
  },

  getSavedTemplates(): SavedTemplate[] {
    try {
      const data = localStorage.getItem(SAVED_TEMPLATES_KEY);
      if (!data) {
        // Return initial sample template
        return [
          {
            id: 'tpl_common_shipment_extension',
            name: 'Common Shipment & Expiry Extension',
            description: 'Extension of latest shipment date and LC expiry',
            correctionIds: ['shipment_and_expiry_extension', 'total_bank_charges_limit'],
            defaultDetails: { maxChargeAmount: '120' },
            createdAt: Date.now() - 86400000
          },
          {
            id: 'tpl_standard_scrutiny',
            name: 'Standard LC Scrutiny Adjustments',
            description: 'Overdue clause, payment clarification and Clause 13 removal',
            correctionIds: ['overdue_clause', 'payment_clause', 'physical_verification_clause'],
            createdAt: Date.now() - 43200000
          }
        ];
      }
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveTemplate(template: Omit<SavedTemplate, 'id' | 'createdAt'>): SavedTemplate {
    const newTemplate: SavedTemplate = {
      ...template,
      id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: Date.now()
    };
    try {
      const existing = this.getSavedTemplates();
      const updated = [newTemplate, ...existing];
      localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save template', e);
    }
    return newTemplate;
  },

  deleteSavedTemplate(id: string): void {
    try {
      const existing = this.getSavedTemplates();
      const updated = existing.filter(tpl => tpl.id !== id);
      localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete template', e);
    }
  }
};
