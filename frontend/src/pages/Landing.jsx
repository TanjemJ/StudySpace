import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Grid, Card, CardContent, Stack,
  Accordion, AccordionSummary, AccordionDetails, Avatar, Paper, Chip,
} from '@mui/material';
import {
  Search, Forum, SmartToy, VerifiedUser, Groups, School, Payments,
  ExpandMore, ArrowForward, AccessibilityNew, ShieldOutlined,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/layout/Footer';

const features = [
  {
    icon: <VerifiedUser sx={{ fontSize: 36 }} />,
    title: 'Verified tutors',
    desc: 'ID, qualification, and DBS checks. Every tutor profile shows what was checked, not just a tick.',
  },
  {
    icon: <Groups sx={{ fontSize: 36 }} />,
    title: 'University forums',
    desc: 'Verify your university email and unlock private spaces just for your campus and cohort.',
  },
  {
    icon: <SmartToy sx={{ fontSize: 36 }} />,
    title: 'AI Academic Assistant',
    desc: 'Guided support that helps you think, without generic answers that bypass real understanding.',
  },
  {
    icon: <Payments sx={{ fontSize: 36 }} />,
    title: 'Fair and affordable',
    desc: 'Transparent pricing, low platform commissions, and free access to community features.',
  },
];

const steps = [
  {
    num: '01',
    icon: <Search sx={{ fontSize: 28 }} />,
    title: 'Find a verified tutor',
    desc: 'Filter by subject, price, rating, location, and availability. Every profile shows verification details.',
  },
  {
    num: '02',
    icon: <Forum sx={{ fontSize: 28 }} />,
    title: 'Join your university forum',
    desc: 'Verify your university email to access private spaces with classmates from your cohort.',
  },
  {
    num: '03',
    icon: <SmartToy sx={{ fontSize: 28 }} />,
    title: 'Get guided AI help',
    desc: 'Ask the AI Academic Assistant. It walks you through problems instead of writing your work.',
  },
];

const stats = [
  { number: '6', label: 'accessibility settings' },
  { number: '24/7', label: 'AI study support' },
  { number: 'GDPR', label: 'compliant by default' },
  { number: 'UK', label: 'university focus' },
];

const scenarios = [
  {
    title: 'A student gets unstuck without copying',
    desc:
      'The AI assistant asks what they have tried, explains the concept, and walks through a similar example so they can solve their own work.',
    context: 'Guided AI support',
  },
  {
    title: 'A parent checks tutor credentials first',
    desc:
      'Tutor profiles show verification details clearly before booking, including which checks have been reviewed by the StudySpace team.',
    context: 'Verified tutoring',
  },
  {
    title: 'A learner keeps their accessibility settings',
    desc:
      'Text size, contrast, reduced motion, underlined links, dyslexia-friendly font, and stronger focus rings stay consistent across the platform.',
    context: 'Accessible by default',
  },
];

const universities = ['LSBU', 'KCL', 'UCL', 'Imperial', 'QMUL', 'UOW'];

const faqs = [
  {
    q: 'How does the tutor booking system work?',
    a: 'Browse our verified tutors by subject, price, location, and availability. When you find a tutor you like, select an available time slot, choose your session type (video call, in-person, or messaging follow-up), and confirm. Payment is handled securely on the platform and both you and the tutor receive confirmation with full session details.',
  },
  {
    q: 'How are tutors verified?',
    a: 'Every tutor goes through a multi-step verification process: photo ID, proof of qualifications (degree certificates and any teaching credentials), and a DBS check. Every tutor profile shows the specific verification badges that were granted. Our admin team reviews each application before a profile goes live.',
  },
  {
    q: 'What makes the AI Academic Assistant different from a general AI chatbot?',
    a: 'Our AI Assistant is designed to guide you using the Socratic method. It will not write your essays or hand you a worked solution. It explains concepts, asks targeted follow-up questions, and shows the method on a parallel example so you can apply it yourself. The goal is genuine understanding rather than shortcuts you cannot defend in an exam.',
  },
  {
    q: 'Are the community forums moderated?',
    a: 'Yes. StudySpace combines automated keyword detection with manual admin review to keep forums respectful and focused. Inappropriate content is auto-flagged and any user can report posts. Repeat offenders are warned and may be temporarily suspended.',
  },
  {
    q: 'What are university-specific forums?',
    a: 'When you verify your university email you unlock private forum spaces just for students at your university. Great for module-specific discussion, campus life, and connecting with coursemates. Only verified students from your university can read or post in those spaces.',
  },
  {
    q: 'How much does StudySpace cost?',
    a: 'Community forums, the AI Academic Assistant, and browsing tutors are completely free. You only pay when you book a tutoring session, and the price is set transparently by each tutor. There are no hidden fees and no subscription costs. Tutors keep the majority of their earnings, and platform commissions are kept low and disclosed.',
  },
  {
    q: 'Can I post anonymously in the forums?',
    a: 'Yes. Every post and reply has an anonymous-posting option. Your name is hidden from other users when you choose this. You still receive replies and can reply to your own threads. Designed for students who feel intimidated asking visibly.',
  },
  {
    q: 'Is StudySpace accessible?',
    a: 'Yes. Six built-in accessibility settings apply across the entire site, including this homepage: text size, high-contrast mode, reduced motion, underlined links, dyslexia-friendly font, and stronger focus rings. They are saved to your account and persist across devices.',
  },
  {
    q: 'What if I need to cancel a tutoring session?',
    a: 'You can cancel from your dashboard. Cancellations made more than 24 hours before the session receive a full refund. Late cancellations may be subject to the tutor\'s individual cancellation policy, which is shown on their profile before you book.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandedFaq, setExpandedFaq] = useState(false);

  const goPrimary = () => navigate(user ? '/tutors' : '/signup');
  const goSecondary = () => navigate(user ? '/ai-assistant' : '/signup');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Hero */}
      <Box
        sx={{
          position: 'relative',
          background: 'linear-gradient(135deg, #006B3F 0%, #16A34A 60%, #0F8A3F 100%)',
          color: 'white',
          py: { xs: 9, md: 14 },
          overflow: 'hidden',
        }}
      >
        {/* Subtle decorative blobs */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: -120, right: -80,
            width: 320, height: 320, borderRadius: '50%',
            bgcolor: 'rgba(251,191,36,0.18)',
            filter: 'blur(40px)',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            bottom: -160, left: -100,
            width: 360, height: 360, borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.08)',
            filter: 'blur(60px)',
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Chip
                label="Built for UK university students"
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.14)',
                  color: 'white',
                  fontWeight: 600,
                  mb: 3,
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              />
              <Typography
                variant="h1"
                sx={{
                  color: 'white',
                  fontSize: { xs: '36px', md: '56px' },
                  lineHeight: 1.1,
                  mb: 2.5,
                  fontWeight: 700,
                }}
              >
                Tutoring, community,<br />
                and AI study support,<br />
                <Box component="span" sx={{ color: 'secondary.main' }}>all in one place.</Box>
              </Typography>
              <Typography
                variant="body1"
                sx={{ color: 'rgba(255,255,255,0.92)', mb: 4, fontSize: '1.1rem', maxWidth: 560, lineHeight: 1.65 }}
              >
                StudySpace brings verified tutors, university-only forums, and guided AI support into one
                trusted platform, helping UK students understand their work, connect with their campus,
                and study with confidence.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={goPrimary}
                  endIcon={<ArrowForward />}
                  sx={{
                    bgcolor: 'secondary.main',
                    color: 'secondary.contrastText',
                    fontWeight: 700,
                    py: 1.4, px: 3.5,
                    '&:hover': { bgcolor: 'secondary.dark' },
                  }}
                >
                  {user ? 'Find a Tutor' : 'Get Started Free'}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={goSecondary}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.5)',
                    color: 'white',
                    fontWeight: 600,
                    py: 1.4, px: 3.5,
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  {user ? 'Try the AI Assistant' : 'I\'m a Tutor'}
                </Button>
              </Stack>

              {/* Trust microcopy */}
              <Stack direction="row" spacing={3} sx={{ mt: 4, flexWrap: 'wrap', gap: 1.5 }}>
                <Chip
                  icon={<ShieldOutlined sx={{ color: 'white !important', fontSize: 16 }} />}
                  label="GDPR-compliant"
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white', '& .MuiChip-icon': { color: 'white' } }}
                />
                <Chip
                  icon={<VerifiedUser sx={{ color: 'white !important', fontSize: 16 }} />}
                  label="Tutors are ID-verified"
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
                />
                <Chip
                  icon={<AccessibilityNew sx={{ color: 'white !important', fontSize: 16 }} />}
                  label="Accessibility built in"
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
                />
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              {/* Decorative card cluster replaces the plain icon-in-a-box. Stays
                  purely decorative (no real screenshots) so we don't need image assets. */}
              <Box sx={{ position: 'relative', height: { xs: 280, md: 380 } }}>
                <Paper
                  elevation={6}
                  sx={{
                    position: 'absolute',
                    top: 30, left: 20, right: 20,
                    p: 2.5, borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.97)',
                    color: 'text.primary',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                      <SmartToy sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      AI Academic Assistant
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                    Lists are <strong>mutable</strong>; tuples are <strong>immutable</strong>.
                    Want to see when this matters in practice?
                  </Typography>
                </Paper>
                <Paper
                  elevation={4}
                  sx={{
                    position: 'absolute',
                    bottom: 30, left: 0, right: 40,
                    p: 2, borderRadius: 3,
                    bgcolor: 'white',
                    color: 'text.primary',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36, color: 'secondary.contrastText' }}>
                      <School sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                        Dr Jane (LSBU), verified
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Mathematics · £30/hr · 4.9 ★
                      </Typography>
                    </Box>
                    <Chip label="Available" size="small" color="success" sx={{ height: 22, fontSize: '0.7rem' }} />
                  </Stack>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Stats strip */}
      <Box sx={{ bgcolor: 'white', borderBottom: 1, borderColor: 'divider', py: 3 }}>
        <Container maxWidth="lg">
          <Grid container spacing={2}>
            {stats.map((s) => (
              <Grid item xs={6} md={3} key={s.label}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 700, fontSize: { xs: '24px', md: '32px' } }}>
                    {s.number}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    {s.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* How it works */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 10 } }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.5, fontWeight: 600 }}>
            How it works
          </Typography>
          <Typography variant="h2" sx={{ mt: 1.5, mb: 1 }}>
            Three steps from "stuck" to "got it"
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            No subscription, no setup. Sign up free and start with whichever piece you need first.
          </Typography>
        </Box>
        <Grid container spacing={4}>
          {steps.map((s, i) => (
            <Grid item xs={12} md={4} key={s.num}>
              <Card
                sx={{
                  height: '100%',
                  p: 1.5,
                  position: 'relative',
                  transition: 'transform 200ms ease, box-shadow 200ms ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px -8px rgba(0, 107, 63, 0.18)',
                  },
                }}
              >
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Typography
                      variant="h2"
                      sx={{
                        color: 'primary.light',
                        fontWeight: 800,
                        fontSize: '40px',
                        opacity: 0.45,
                        lineHeight: 1,
                      }}
                    >
                      {s.num}
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        width: 48, height: 48, borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {s.icon}
                    </Box>
                  </Stack>
                  <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>{s.title}</Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>{s.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Features */}
      <Box sx={{ bgcolor: '#F0FDF4', py: { xs: 8, md: 10 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.5, fontWeight: 600 }}>
              Why StudySpace
            </Typography>
            <Typography variant="h2" sx={{ mt: 1.5 }}>
              Built differently, and you can tell.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {features.map((f) => (
              <Grid item xs={12} sm={6} md={3} key={f.title}>
                <Card
                  sx={{
                    height: '100%',
                    p: 1,
                    transition: 'transform 200ms ease, box-shadow 200ms ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px -8px rgba(0, 107, 63, 0.15)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 64, height: 64, borderRadius: '50%',
                        bgcolor: 'primary.main', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        mx: 'auto', mb: 2,
                      }}
                    >
                      {f.icon}
                    </Box>
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>{f.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {f.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Universities served */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 }, textAlign: 'center' }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1.5, fontWeight: 600 }}>
          Built for UK universities
        </Typography>
        <Typography variant="h4" sx={{ mt: 1.5, mb: 4 }}>
          Designed around how UK university students actually study.
        </Typography>
        <Stack
          direction="row"
          spacing={2}
          justifyContent="center"
          alignItems="center"
          flexWrap="wrap"
          sx={{ gap: 2 }}
        >
          {universities.map((uni) => (
            <Box
              key={uni}
              sx={{
                width: 80, height: 80, borderRadius: '50%',
                border: '2px solid', borderColor: 'divider',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'white',
                color: 'primary.main',
                fontWeight: 700,
                fontSize: '0.9rem',
                transition: 'transform 150ms ease',
                '&:hover': { transform: 'scale(1.06)', borderColor: 'primary.main' },
              }}
            >
              {uni}
            </Box>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
          Plus other UK institutions. Verify your university email after sign-up to unlock your campus space.
        </Typography>
      </Container>

      {/* Example scenarios */}
      <Box sx={{ bgcolor: 'grey.50', py: { xs: 8, md: 10 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.5, fontWeight: 600 }}>
              How StudySpace can help
            </Typography>
            <Typography variant="h2" sx={{ mt: 1.5 }}>
              Example scenarios for real study situations.
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 640, mx: 'auto', mt: 1.5 }}>
              A quick look at the kinds of study moments the platform is built to support.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {scenarios.map((scenario) => (
              <Grid item xs={12} md={4} key={scenario.title}>
                <Card sx={{ height: '100%', p: 1, position: 'relative' }}>
                  <CardContent>
                    <Chip
                      label={scenario.context}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ mb: 2 }}
                    />
                    <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 700 }}>
                      {scenario.title}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {scenario.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* FAQ kept at the end as requested */}
      <Container maxWidth="md" sx={{ py: { xs: 8, md: 10 } }}>
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.5, fontWeight: 600 }}>
            FAQ
          </Typography>
          <Typography variant="h2" sx={{ mt: 1.5, mb: 1 }}>
            Frequently asked questions
          </Typography>
          <Typography color="text.secondary">
            Everything you need to know, plus a few things you might not have thought to ask.
          </Typography>
        </Box>
        {faqs.map((faq, i) => (
          <Accordion
            key={i}
            expanded={expandedFaq === i}
            onChange={(_, isExpanded) => setExpandedFaq(isExpanded ? i : false)}
            disableGutters
            elevation={0}
            sx={{
              border: 'none',
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={
                <ExpandMore sx={{ color: expandedFaq === i ? 'primary.main' : 'text.secondary' }} />
              }
              sx={{ px: 2, py: 1.5, '& .MuiAccordionSummary-content': { my: 1 } }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: expandedFaq === i ? 700 : 500,
                  color: expandedFaq === i ? 'primary.main' : 'text.primary',
                  pr: 2,
                  fontSize: '1.05rem',
                }}
              >
                {faq.q}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 3, pt: 0 }}>
              <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>{faq.a}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Container>

      {/* Final CTA */}
      <Box sx={{ bgcolor: '#F0FDF4', py: { xs: 7, md: 9 } }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography variant="h3" sx={{ mb: 1.5 }}>Ready to study smarter?</Typography>
          <Typography color="text.secondary" sx={{ mb: 3.5, fontSize: '1.05rem' }}>
            Sign up free in two minutes. No credit card. Nothing to cancel.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button variant="contained" size="large" onClick={goPrimary} endIcon={<ArrowForward />}>
              {user ? 'Find a Tutor' : 'Create Free Account'}
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/about')}>
              Learn More
            </Button>
          </Stack>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
}
