import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Grid, Card, CardContent, Stack } from '@mui/material';
import { Search, Forum, SmartToy, VerifiedUser, Groups, School, Payments } from '@mui/icons-material';

const features = [
  { icon: <VerifiedUser sx={{ fontSize: 40 }} />, title: 'Verified Tutors', desc: 'Every tutor is verified with ID, qualifications, and DBS checks for your safety.' },
  { icon: <Groups sx={{ fontSize: 40 }} />, title: 'University Forums', desc: 'Join your university community. Ask questions, share tips, and connect with peers.' },
  { icon: <SmartToy sx={{ fontSize: 40 }} />, title: 'AI Academic Assistant', desc: 'Get guided academic support that helps you think — not just copy answers.' },
  { icon: <Payments sx={{ fontSize: 40 }} />, title: 'Fair & Affordable', desc: 'Transparent pricing, low commissions, and free access to community features.' },
];

const steps = [
  { num: '1', icon: <Search />, title: 'Find a Verified Tutor', desc: 'Browse by subject, price, rating, and availability.' },
  { num: '2', icon: <Forum />, title: 'Join Your University Forum', desc: 'Connect with students at your university.' },
  { num: '3', icon: <SmartToy />, title: 'Get Guided AI Help', desc: 'Our AI helps you think through problems step by step.' },
];

export default function Landing() {
  const navigate = useNavigate();
  return (
    <Box>
      {/* Hero */}
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography variant="h1" sx={{ color: 'white', fontSize: { xs: '32px', md: '48px' }, mb: 2 }}>
                One Place for Tutoring, Community & AI Support
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 4, maxWidth: 520 }}>
                StudySpace brings together verified tutors, university forums, and guided AI support
                so you can learn smarter — all in one platform.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button variant="contained" size="large" onClick={() => navigate('/signup')}
                  sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', '&:hover': { bgcolor: 'secondary.dark' } }}>
                  Get Started — Free
                </Button>
                <Button variant="outlined" size="large" onClick={() => navigate('/signup')}
                  sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                  I'm a Tutor
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <School sx={{ fontSize: 120, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* How it works */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h2" textAlign="center" sx={{ mb: 6 }}>How It Works</Typography>
        <Grid container spacing={4}>
          {steps.map((s) => (
            <Grid item xs={12} md={4} key={s.num}>
              <Card sx={{ textAlign: 'center', py: 4, height: '100%' }}>
                <CardContent>
                  <Box sx={{ bgcolor: 'primary.light', color: 'white', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                    {s.icon}
                  </Box>
                  <Typography variant="h4" sx={{ mb: 1 }}>{s.title}</Typography>
                  <Typography color="text.secondary">{s.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Features */}
      <Box sx={{ bgcolor: '#F0FDF4', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h2" textAlign="center" sx={{ mb: 6 }}>Why StudySpace?</Typography>
          <Grid container spacing={3}>
            {features.map((f) => (
              <Grid item xs={12} sm={6} md={3} key={f.title}>
                <Card sx={{ textAlign: 'center', py: 3, height: '100%' }}>
                  <CardContent>
                    <Box sx={{ color: 'primary.main', mb: 2 }}>{f.icon}</Box>
                    <Typography variant="h5" sx={{ mb: 1 }}>{f.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{f.desc}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA */}
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ mb: 2 }}>Ready to learn smarter?</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Join thousands of university students already using StudySpace.</Typography>
        <Button variant="contained" size="large" onClick={() => navigate('/signup')}>Create Free Account</Button>
      </Container>

      {/* Footer */}
      <Box sx={{ bgcolor: '#004D2C', color: 'white', py: 4 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Typography variant="h5" sx={{ color: 'white', mb: 1 }}>StudySpace</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Tutoring, community, and AI support — all in one place.
              </Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>PLATFORM</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1 }}>Find a Tutor</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Community</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>AI Assistant</Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>COMPANY</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1 }}>About</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Contact</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>LEGAL</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1 }}>Privacy Policy</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Terms & Conditions</Typography>
            </Grid>
          </Grid>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 4, textAlign: 'center' }}>
            © 2026 StudySpace. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
