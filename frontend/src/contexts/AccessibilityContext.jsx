
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAuth } from './AuthContext';
import { makeTheme, TEXT_SIZE_SCALES } from '../theme';

const AccessibilityContext = createContext(null);

const DEFAULTS = {
  textSize: 'medium',
  highContrast: false,
  reducedMotion: false,
  underlineLinks: false,
  dyslexiaFont: false,
  focusRingBoost: false,
};

export function AccessibilityProvider({ children }) {
  const { user } = useAuth();

  // `preview` lets Settings show live changes before the save-to-server round trip.
  // When null, we fall back to the user's saved prefs.
  const [preview, setPreview] = useState(null);

  const current = useMemo(() => {
    const fromUser = user
      ? {
          textSize: user.text_size || DEFAULTS.textSize,
          highContrast: !!user.high_contrast,
          reducedMotion: !!user.reduced_motion,
          underlineLinks: !!user.underline_links,
          dyslexiaFont: !!user.dyslexia_font,
          focusRingBoost: !!user.focus_ring_boost,
        }
      : DEFAULTS;
    return { ...fromUser, ...(preview || {}) };
  }, [user, preview]);

  // Apply body classes in a DOM effect so any page can style from them.
  useEffect(() => {
    const body = document.body;
    body.classList.toggle('ss-high-contrast', current.highContrast);
    body.classList.toggle('ss-reduced-motion', current.reducedMotion);
    body.classList.toggle('ss-underline-links', current.underlineLinks);
    body.classList.toggle('ss-dyslexia-font', current.dyslexiaFont);
    body.classList.toggle('ss-focus-boost', current.focusRingBoost);
  }, [current]);

  // Build the scaled MUI theme.
  const theme = useMemo(
    () => makeTheme({ textSize: current.textSize, highContrast: current.highContrast }),
    [current.textSize, current.highContrast],
  );

  const value = useMemo(
    () => ({
      ...current,
      scale: TEXT_SIZE_SCALES[current.textSize] ?? 1,
      setPreview,       // full replace — pass null to clear
      applyPreview: (patch) => setPreview((prev) => ({ ...(prev || {}), ...patch })),
      clearPreview: () => setPreview(null),
    }),
    [current],
  );

  return (
    <AccessibilityContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    // Before the provider mounts (shouldn't happen in practice) return safe defaults.
    return { ...DEFAULTS, scale: 1, setPreview: () => {}, applyPreview: () => {}, clearPreview: () => {} };
  }
  return ctx;
}
