import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Card, CardContent, TextField, Button, Box, Alert,
  Stack, MenuItem, Grid,
} from '@mui/material';
import { Send, Email, Phone, AccessTime, CheckCircle } from '@mui/icons-material';
import Footer from '../components/layout/Footer';

const subjectOptions = [
  'General enquiry',
  'Account issue',
  'Booking or payment problem',
  'Report a user or content',
  'Tutor verification question',
  'Feature request or feedback',
  'Accessibility concern',
  'Partnership or institutional enquiry',
  'Other',
];

const SUPPORT_EMAIL = 'studyspaceadmin@gmail.com';
const SUPPORT_PHONE_DISPLAY = '+44 7858 357360';
const SUPPORT_PHONE_TEL = '+447858357360';

export default function ContactUs() {
  const { user } = useAuth();
  const [name, setName] = useState(user ? `${user.first_name} ${user.last_name}`.trim() : '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !subject || !message) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/contact/', { name, email, subject, message });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Box sx={{ bgcolor: 'background.default', flex: 1, display: 'flex', alignItems: 'center' }}>
          <Container maxWidth="sm" sx={{ textAlign: 'center', py: 8 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h2" sx={{ mb: 1 }}>Message Sent</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Thank you for reaching out. We'll get back to you at <strong>{email}</strong> as soon as possible,
              usually within 1–2 business days.
            </Typography>
            <Button
              variant="contained"
              onClick={() => { setSuccess(false); setMessage(''); setSubject(''); }}
            >
              Send Another Message
            </Button>
          </Container>
        </Box>
        <Footer />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Box sx={{ bgcolor: 'background.default', flex: 1 }}>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Typography variant="h2" sx={{ mb: 1 }}>Contact Us</Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Have a question, issue, or suggestion? We'd love to hear from you.
          </Typography>

          <Grid container spacing={4}>
            {/* Contact form */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                  <form onSubmit={handleSubmit}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                      <TextField
                        fullWidth label="Your name" value={name}
                        onChange={(e) => setName(e.target.value)} required
                      />
                      <TextField
                        fullWidth label="Email address" type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)} required
                        helperText={user ? 'Auto-filled from your account. You can edit if needed.' : ''}
                      />
                    </Stack>

                    <TextField
                      fullWidth select label="Subject" value={subject}
                      onChange={(e) => setSubject(e.target.value)} sx={{ mb: 2 }} required
                    >
                      <MenuItem value="" disabled>Select a subject...</MenuItem>
                      {subjectOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>

                    <TextField
                      fullWidth multiline rows={6} label="Message" value={message}
                      onChange={(e) => setMessage(e.target.value)} sx={{ mb: 2 }} required
                      placeholder="Tell us how we can help. Please include as much detail as possible."
                      inputProps={{ maxLength: 5000 }}
                      helperText={`${message.length}/5000 characters`}
                    />

                    <Button
                      type="submit" variant="contained" size="large" startIcon={<Send />}
                      disabled={loading || !name || !email || !subject || !message}
                    >
                      {loading ? 'Sending...' : 'Send Message'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </Grid>

            {/* Contact info sidebar */}
            <Grid item xs={12} md={4}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h5" sx={{ mb: 2 }}>Get in Touch</Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Email sx={{ fontSize: 20, color: 'primary.main', mt: 0.25 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={500}>Email</Typography>
                        <Typography variant="body2" color="text.secondary">
                          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'inherit' }}>
                            {SUPPORT_EMAIL}
                          </a>
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Phone sx={{ fontSize: 20, color: 'primary.main', mt: 0.25 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={500}>Phone</Typography>
                        <Typography variant="body2" color="text.secondary">
                          <a href={`tel:${SUPPORT_PHONE_TEL}`} style={{ color: 'inherit' }}>
                            {SUPPORT_PHONE_DISPLAY}
                          </a>
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <AccessTime sx={{ fontSize: 20, color: 'primary.main', mt: 0.25 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={500}>Hours</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Monday–Friday<br />
                          09:00–18:00 UK time
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h5" sx={{ mb: 1 }}>Response Time</Typography>
                  <Typography variant="body2" color="text.secondary">
                    We aim to respond to all enquiries within 1–2 business days. For urgent account issues,
                    please include your registered email address.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Footer />
    </Box>
  );
}
