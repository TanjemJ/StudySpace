import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Typography, Grid, Link, Stack } from '@mui/material';
import PrivacyPolicyDialog from '../legal/PrivacyPolicyDialog';
import TermsDialog from '../legal/TermsDialog';

/**
 * Site-wide footer.
 *
 * Why MUI <Link> with component={RouterLink} rather than Typography + onClick:
 * the accessibility "underline_links" toggle (theme.js → body.ss-underline-links)
 * targets `a` tags and `.MuiLink-root`. Real Link components automatically pick
 * up that rule. Typography elements with onClick handlers do not.
 */
export default function Footer() {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const linkSx = {
    color: 'rgba(255,255,255,0.75)',
    display: 'block',
    mt: 0.5,
    fontSize: '0.875rem',
    '&:hover': { color: 'white' },
    cursor: 'pointer',
  };

  const headingSx = {
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    mb: 1.5,
    display: 'block',
  };

  return (
    <Box component="footer" sx={{ bgcolor: '#003D24', color: 'white', py: { xs: 5, md: 6 }, mt: 'auto' }}>
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 4, md: 6 }}>
          <Grid item xs={12} md={4}>
            <Typography variant="h5" sx={{ color: 'white', mb: 1.5, fontWeight: 700 }}>
              StudySpace
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', maxWidth: 320, lineHeight: 1.65 }}>
              Verified tutors, university communities, and a guided AI study assistant —
              built for UK university students.
            </Typography>
          </Grid>

          <Grid item xs={6} md={2}>
            <Typography component="span" sx={headingSx}>Platform</Typography>
            <Stack>
              <Link component={RouterLink} to="/tutors" underline="none" sx={linkSx}>
                Find a Tutor
              </Link>
              <Link component={RouterLink} to="/forum" underline="none" sx={linkSx}>
                Community
              </Link>
              <Link component={RouterLink} to="/ai-assistant" underline="none" sx={linkSx}>
                AI Assistant
              </Link>
            </Stack>
          </Grid>

          <Grid item xs={6} md={2}>
            <Typography component="span" sx={headingSx}>Company</Typography>
            <Stack>
              <Link component={RouterLink} to="/about" underline="none" sx={linkSx}>
                About
              </Link>
              <Link component={RouterLink} to="/contact" underline="none" sx={linkSx}>
                Contact
              </Link>
            </Stack>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography component="span" sx={headingSx}>Legal</Typography>
            <Stack>
              <Link
                component="button"
                type="button"
                underline="none"
                onClick={() => setPrivacyOpen(true)}
                sx={{ ...linkSx, textAlign: 'left', background: 'none', border: 0, p: 0 }}
              >
                Privacy Policy
              </Link>
              <Link
                component="button"
                type="button"
                underline="none"
                onClick={() => setTermsOpen(true)}
                sx={{ ...linkSx, textAlign: 'left', background: 'none', border: 0, p: 0 }}
              >
                Terms &amp; Conditions
              </Link>
            </Stack>
          </Grid>
        </Grid>

        <Box
          sx={{
            mt: { xs: 4, md: 5 },
            pt: 3,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            © {new Date().getFullYear()} StudySpace. All rights reserved.
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Built for UK universities · Made with care
          </Typography>
        </Box>
      </Container>

      <PrivacyPolicyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <TermsDialog open={termsOpen} onClose={() => setTermsOpen(false)} />
    </Box>
  );
}
