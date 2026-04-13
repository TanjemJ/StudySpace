import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { light: '#16A34A', main: '#006B3F', dark: '#005A34', contrastText: '#FFFFFF' },
    secondary: { light: '#FCD34D', main: '#FBBF24', dark: '#D97706', contrastText: '#1F2937' },
    error: { light: '#FEE2E2', main: '#DC2626', dark: '#B91C1C' },
    warning: { light: '#FEF3C7', main: '#F59E0B', dark: '#D97706' },
    info: { light: '#DBEAFE', main: '#2563EB', dark: '#1D4ED8' },
    success: { light: '#DCFCE7', main: '#16A34A', dark: '#15803D' },
    background: { default: '#F9FAFB', paper: '#FFFFFF' },
    text: { primary: '#374151', secondary: '#6B7280', disabled: '#9CA3AF' },
    divider: '#E5E7EB',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h1: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '39px', fontWeight: 700, lineHeight: '48px', letterSpacing: '-0.0123em' },
    h2: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '31px', fontWeight: 700, lineHeight: '40px', letterSpacing: '-0.0090em' },
    h3: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '25px', fontWeight: 600, lineHeight: '32px', letterSpacing: '-0.0034em' },
    h4: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 600, lineHeight: '28px', letterSpacing: '-0.0029em' },
    h5: { fontSize: '16px', fontWeight: 600, lineHeight: '24px' },
    h6: { fontSize: '14px', fontWeight: 600, lineHeight: '20px' },
    body1: { fontSize: '16px', lineHeight: '24px' },
    body2: { fontSize: '14px', lineHeight: '20px' },
    caption: { fontSize: '12px', lineHeight: '20px' },
    overline: { fontSize: '11px', fontWeight: 500, letterSpacing: '0.0676em', textTransform: 'uppercase' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 500, transition: 'all 150ms ease-out' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
        },
      },
    },
  },
});

export default theme;
