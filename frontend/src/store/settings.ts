import { create } from 'zustand';
import { api } from '../api/client';

const CACHE_KEY = 'oj_site_settings';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface CachedSettings {
  data: Record<string, string>;
  timestamp: number;
}

function loadFromCache(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSettings = JSON.parse(raw);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function saveToCache(data: Record<string, string>) {
  try {
    const cached: CachedSettings = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch { /* ignore */ }
}

interface SettingsState {
  settings: Record<string, string>;
  loaded: boolean;
  fetchSettings: (force?: boolean) => Promise<void>;
  getImageUploadEnabled: () => boolean;
  getUploadEnabled: () => boolean;
  getRegistrationOpen: () => boolean;
  getEmailRequired: () => boolean;
  getEmailSuffixes: () => string;
  getAnnouncement: () => string;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  loaded: false,

  fetchSettings: async (force = false) => {
    // Try localStorage cache first (unless forced)
    if (!force) {
      const cached = loadFromCache();
      if (cached) {
        set({ settings: cached, loaded: true });
        return;
      }
    }

    try {
      const data = await api.getSettings();
      saveToCache(data);
      set({ settings: data, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  getImageUploadEnabled: () => {
    const { settings } = get();
    return settings.image_upload_enabled !== 'false';
  },

  getUploadEnabled: () => {
    const { settings } = get();
    return settings.upload_enabled !== 'false';
  },

  getRegistrationOpen: () => {
    const { settings } = get();
    return settings.registration_open !== 'false';
  },

  getEmailRequired: () => {
    const { settings } = get();
    return settings.email_required === 'true';
  },

  getEmailSuffixes: () => {
    const { settings } = get();
    return settings.email_suffixes || '';
  },

  getAnnouncement: () => {
    const { settings } = get();
    return settings.announcement || '';
  },
}));
