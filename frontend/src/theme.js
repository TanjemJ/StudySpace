import { createTheme } from '@mui/material/styles';


export const TEXT_SIZE_SCALES = {
  small: 0.9,
  medium: 1.0,
  large: 1.125,
  xl: 1.25,
};


const accessibilityStyles = `
  /* Underline all links */
  body.ss-underline-links a,
  body.ss-underline-links .MuiLink-root {
    text-decoration: underline !important;
  }

  /* Dyslexia-friendly font (OpenDyslexic with fallbacks) */
  body.ss-dyslexia-font,
  body.ss-dyslexia-font * {
    font-family: 'OpenDyslexic', 'Comic Sans MS', 'Arial', sans-serif !important;
    letter-spacing: 0.02em;
  }

  /* Focus ring boost — thicker outline on keyboard-focused elements */
  body.ss-focus-boost :focus-visible {
    outline: 3px solid #FBBF24 !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.25) !important;
  }

  /* Reduced motion — disable animations and transitions site-wide */
  body.ss-reduced-motion *,
  body.ss-reduced-motion *::before,
  body.ss-reduced-motion *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }

  /* High contrast mode — stronger borders, darker text, white bg */
  body.ss-high-contrast {
    background-color: #FFFFFF !important;
  }
  body.ss-high-contrast .MuiPaper-root,
  body.ss-high-contrast .MuiCard-root {
    border: 1.5px solid #000000 !important;
    box-shadow: none !important;
  }
  body.ss-high-contrast .MuiButton-outlined {
    border-width: 2px !important;
  }
  body.ss-high-contrast .MuiTypography-root {
    color: #111111 !important;
  }
  body.ss-high-contrast .MuiTypography-caption,
  body.ss-high-contrast .MuiTypography-body2[color="text.secondary"] {
    color: #333333 !important;
  }
`;

/**
 * Factory: returns a fresh MUI theme based on accessibility prefs.
 *
 *   { textSize: 'small'|'medium'|'large'|'xl', highContrast: boolean }
 */
export function makeTheme({ textSize = 'medium', highContrast = false } = {}) {
  const scale = TEXT_SIZE_SCALES[textSize] ?? 1;
  const px = (n) => `${Math.round(n * scale)}px`;

  return createTheme({
    palette: {
      primary: { light: '#16A34A', main: '#006B3F', dark: '#005A34', contrastText: '#FFFFFF' },
      secondary: { light: '#FCD34D', main: '#FBBF24', dark: '#D97706', contrastText: '#1F2937' },
      error: { light: '#FEE2E2', main: '#DC2626', dark: '#B91C1C' },
      warning: { light: '#FEF3C7', main: '#F59E0B', dark: '#D97706' },
      info: { light: '#DBEAFE', main: '#2563EB', dark: '#1D4ED8' },
      success: { light: '#DCFCE7', main: '#16A34A', dark: '#15803D' },
      background: {
        default: highContrast ? '#FFFFFF' : '#F9FAFB',
        paper: '#FFFFFF',
      },
      text: {
        primary: highContrast ? '#111111' : '#374151',
        secondary: highContrast ? '#333333' : '#6B7280',
        disabled: '#9CA3AF',
      },
      divider: highContrast ? '#000000' : '#E5E7EB',
    },
    typography: {
      fontFamily: "'Inter', sans-serif",
      h1: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: px(39), fontWeight: 700, lineHeight: px(48), letterSpacing: '-0.0123em' },
      h2: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: px(31), fontWeight: 700, lineHeight: px(40), letterSpacing: '-0.0090em' },
      h3: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: px(25), fontWeight: 600, lineHeight: px(32), letterSpacing: '-0.0034em' },
      h4: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: px(20), fontWeight: 600, lineHeight: px(28), letterSpacing: '-0.0029em' },
      h5: { fontSize: px(16), fontWeight: 600, lineHeight: px(24) },
      h6: { fontSize: px(14), fontWeight: 600, lineHeight: px(20) },
      body1: { fontSize: px(16), lineHeight: px(24) },
      body2: { fontSize: px(14), lineHeight: px(20) },
      caption: { fontSize: px(12), lineHeight: px(20) },
      overline: { fontSize: px(11), fontWeight: 500, letterSpacing: '0.0676em', textTransform: 'uppercase' },
      button: { fontSize: px(14), fontWeight: 500 },
    },
    shape: { borderRadius: 8 },
    components: {
      // Inject the accessibility stylesheet globally.
      MuiCssBaseline: {
        styleOverrides: accessibilityStyles,
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
            transition: 'all 150ms ease-out',
            // Bigger tap targets at larger text sizes
            minHeight: Math.round(36 * scale),
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: highContrast ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: highContrast ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.1)',
            },
          },
        },
      },
    },
  });
}

// Keep a default export so existing imports like
//   `import theme from '../theme'`
// still work (resolves to the 'medium' / no-high-contrast theme).
const theme = makeTheme();
export default theme;
