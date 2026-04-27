import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Grid, Card, CardContent, Stack, Avatar, Paper,
} from '@mui/material';
import {
  School, EmojiObjects, Diversity3, VerifiedUser, AccessibilityNew,
  Forum as ForumIcon, SmartToy, Insights,
} from '@mui/icons-material';
import Footer from '../components/layout/Footer';

const values = [
  {
    icon: <VerifiedUser sx={{ fontSize: 32 }} />,
    title: 'Trust, verified',
    desc: 'Every tutor goes through ID, qualification, and DBS checks. Verification is visible on every profile so you can see what was checked.',
  },
  {
    icon: <AccessibilityNew sx={{ fontSize: 32 }} />,
    title: 'Built to be inclusive',
    desc: 'Six accessibility settings — text size, high contrast, reduced motion, underlined links, dyslexia-friendly font, stronger focus rings — apply across the entire site.',
  },
  {
    icon: <EmojiObjects sx={{ fontSize: 32 }} />,
    title: 'AI that guides, not replaces',
    desc: 'Our AI Academic Assistant uses the Socratic method to help you think — not to do your assignments for you. We build understanding, not shortcuts.',
  },
  {
    icon: <Diversity3 sx={{ fontSize: 32 }} />,
    title: 'Communities you belong to',
    desc: 'University-specific spaces unlock when you verify your university email. Real cohorts, real coursemates, moderated for safety.',
  },
];

const problems = [
  {
    title: 'Fragmented support',
    desc: 'Students juggle separate apps for tutors, peer help, and AI assistance — none of them talk to each other.',
  },
  {
    title: 'Trust is unclear',
    desc: 'It is hard to know which tutors are genuinely qualified versus who has just paid for a listing.',
  },
  {
    title: 'AI cuts the wrong corners',
    desc: 'Generic AI tools either refuse to help or write the entire assignment — neither builds real learning.',
  },
];

const solutions = [
  {
    icon: <School sx={{ fontSize: 28 }} />,
    title: 'One platform',
    desc: 'Verified tutors, university forums, and AI support live together so context flows from one to the next.',
  },
  {
    icon: <VerifiedUser sx={{ fontSize: 28 }} />,
    title: 'Visible verification',
    desc: 'You see exactly what was checked on each tutor — qualifications, ID, DBS — before you book.',
  },
  {
    icon: <SmartToy sx={{ fontSize: 28 }} />,
    title: 'Guided AI, not ghostwriter',
    desc: 'Our prompt design gives you scaffolded help. You learn the path; the AI walks beside you.',
  },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <Box>
      {/* Hero */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #006B3F 0%, #16A34A 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography variant="h1" sx={{ color: 'white', fontSize: { xs: '32px', md: '48px' }, mb: 2 }}>
                Built to make university learning a little easier.
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.92)', maxWidth: 560, lineHeight: 1.7 }}>
                StudySpace exists because UK university students deserve a single, honest place to find tutors,
                connect with their cohort, and get genuine learning support. We believe trust should be visible,
                AI should guide rather than answer, and accessibility is a feature — not an afterthought.
              </Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box
                aria-hidden
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 4,
                  height: { xs: 220, md: 320 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                {/* Placeholder for hero illustration. See zip readme for image prompt. */}
                <School sx={{ fontSize: { xs: 96, md: 140 }, color: 'rgba(255,255,255,0.35)' }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Mission */}
      <Container maxWidth="md" sx={{ py: { xs: 7, md: 10 }, textAlign: 'center' }}>
        <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.5, fontWeight: 600 }}>
          Our mission
        </Typography>
        <Typography variant="h2" sx={{ mt: 1.5, mb: 2.5 }}>
          Help students learn the way they actually want to.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem', lineHeight: 1.8, maxWidth: 720, mx: 'auto' }}>
          Most learning tools optimise for finishing the task. StudySpace optimises for understanding it. Our
          AI assistant asks the next useful question instead of writing your essay. Our tutors are verified
          before they appear in search results. Our forums are moderated by humans, not just by keyword
          filters. And every part of the platform respects six different accessibility preferences, because
          students have different needs and that should never be an inconvenience.
        </Typography>
      </Container>

      {/* The problem */}
      <Box sx={{ bgcolor: '#F0FDF4', py: { xs: 7, md: 9 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.5, fontWeight: 600 }}>
              The problem we set out to solve
            </Typography>
            <Typography variant="h2" sx={{ mt: 1.5 }}>
              Studying shouldn&apos;t be this scattered.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {problems.map((p) => (
              <Grid item xs={12} md={4} key={p.title}>
                <Card sx={{ height: '100%', p: 1 }}>
                  <CardContent>
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 700, color: 'primary.dark' }}>
                      {p.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {p.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Our approach */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 9 } }}>
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.5, fontWeight: 600 }}>
            How StudySpace is different
          </Typography>
          <Typography variant="h2" sx={{ mt: 1.5 }}>
            Three connected tools, one trustworthy place.
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {solutions.map((s) => (
            <Grid item xs={12} md={4} key={s.title}>
              <Box sx={{ textAlign: 'center', p: 3 }}>
                <Box
                  sx={{
                    width: 64, height: 64, borderRadius: '50%',
                    bgcolor: 'primary.main', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mx: 'auto', mb: 2,
                  }}
                >
                  {s.icon}
                </Box>
                <Typography variant="h4" sx={{ mb: 1.5 }}>{s.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {s.desc}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Values */}
      <Box sx={{ bgcolor: 'grey.50', py: { xs: 7, md: 9 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.5, fontWeight: 600 }}>
              Our values
            </Typography>
            <Typography variant="h2" sx={{ mt: 1.5 }}>
              What we hold ourselves to.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {values.map((v) => (
              <Grid item xs={12} sm={6} key={v.title}>
                <Card sx={{ height: '100%', p: 1 }}>
                  <CardContent sx={{ display: 'flex', gap: 2 }}>
                    <Box
                      sx={{
                        width: 56, height: 56, borderRadius: '12px',
                        bgcolor: 'primary.light', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {v.icon}
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ mb: 0.75, fontWeight: 700 }}>
                        {v.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                        {v.desc}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Story */}
      <Container maxWidth="md" sx={{ py: { xs: 7, md: 9 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 3 }}>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.5, fontWeight: 600 }}>
            The story
          </Typography>
          <Typography variant="h3" sx={{ mt: 1, mb: 2 }}>
            From a final-year project to a real platform.
          </Typography>
          <Stack spacing={2}>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.85 }}>
              StudySpace started as a final-year computer science project at London South Bank University.
              The brief was to build something genuinely useful for university students — not another quiz
              app, not another class scheduler, but a platform that joined the dots between human tutors,
              peer communities, and the new generation of AI tools.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.85 }}>
              The early prototype tested with students at LSBU and KCL surfaced a clear pattern: people
              didn&apos;t want yet another tool. They wanted one place where the pieces worked together. So
              StudySpace ships verified tutoring, university forums, and a guided AI assistant as one
              connected experience — and continues to evolve based on what real students ask for next.
            </Typography>
          </Stack>
        </Paper>
      </Container>

      {/* CTA */}
      <Box sx={{ bgcolor: '#F0FDF4', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography variant="h3" sx={{ mb: 2 }}>Curious? Try it free.</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Community forums and the AI Academic Assistant are free. You only pay when you book a tutor.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ gap: 2 }}>
            <Button variant="contained" size="large" onClick={() => navigate('/signup')}>
              Create Free Account
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/contact')}>
              Get in Touch
            </Button>
          </Stack>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
}
