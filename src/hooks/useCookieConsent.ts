import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'abrahub_cookie_consent';
const CONSENT_VERSION = 1;

export interface CookiePreferences {
  essential: true; // Always true, cannot be disabled
  functional: boolean;
  analytics: boolean;
}

interface StoredConsent {
  version: number;
  timestamp: string;
  preferences: CookiePreferences;
}

interface CookieConsentState {
  hasResponded: boolean;
  preferences: CookiePreferences;
  isLoading: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  updatePreferences: (prefs: Partial<Omit<CookiePreferences, 'essential'>>) => void;
  resetConsent: () => void;
}

const defaultPreferences: CookiePreferences = {
  essential: true,
  functional: false,
  analytics: false,
};

const allAcceptedPreferences: CookiePreferences = {
  essential: true,
  functional: true,
  analytics: true,
};

export function useCookieConsent(): CookieConsentState {
  const [hasResponded, setHasResponded] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);

  // Load consent from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredConsent = JSON.parse(stored);
        // Check version compatibility
        if (parsed.version === CONSENT_VERSION && parsed.preferences) {
          setPreferences({
            ...parsed.preferences,
            essential: true, // Always enforce essential
          });
          setHasResponded(true);
        }
      }
    } catch (error) {
      console.error('Error loading cookie consent:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveConsent = useCallback((newPreferences: CookiePreferences) => {
    const consent: StoredConsent = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      preferences: newPreferences,
    };
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
      // Also set a simple cookie for server-side detection if needed
      document.cookie = `cookie_consent=1; max-age=${365 * 24 * 60 * 60}; path=/; SameSite=Lax`;
    } catch (error) {
      console.error('Error saving cookie consent:', error);
    }
    
    setPreferences(newPreferences);
    setHasResponded(true);
  }, []);

  const acceptAll = useCallback(() => {
    saveConsent(allAcceptedPreferences);
  }, [saveConsent]);

  const rejectNonEssential = useCallback(() => {
    saveConsent(defaultPreferences);
  }, [saveConsent]);

  const updatePreferences = useCallback((prefs: Partial<Omit<CookiePreferences, 'essential'>>) => {
    const newPreferences: CookiePreferences = {
      ...preferences,
      ...prefs,
      essential: true, // Always true
    };
    saveConsent(newPreferences);
  }, [preferences, saveConsent]);

  const resetConsent = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      document.cookie = 'cookie_consent=; max-age=0; path=/';
    } catch (error) {
      console.error('Error resetting cookie consent:', error);
    }
    setPreferences(defaultPreferences);
    setHasResponded(false);
  }, []);

  return {
    hasResponded,
    preferences,
    isLoading,
    acceptAll,
    rejectNonEssential,
    updatePreferences,
    resetConsent,
  };
}
