import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Card, CardContent, Box, Chip, Stack, Avatar, Button,
  Rating, Grid, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Stepper, Step, StepLabel, IconButton,
} from '@mui/material';
import {
  VerifiedUser, CalendarMonth, School, Close, VideoCall, Person, Chat,
  ArrowBack, ArrowForward, CheckCircle,
} from '@mui/icons-material';

export default function TutorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tutor, setTutor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [slots, setSlots] = useState([]);

  // Booking dialog
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [sessionType, setSessionType] = useState('video');
  const [subject, setSubject] = useState('');
  const [studentNote, setStudentNote] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/tutors/' + id + '/').then(r => setTutor(r.data)).catch(() => {});
    api.get('/tutoring/reviews/' + id + '/').then(r => setReviews(r.data.results || r.data || [])).catch(() => {});
    api.get('/tutoring/availability/' + id + '/').then(r => setSlots(r.data.results || r.data || [])).catch(() => {});
  }, [id]);

  const openBooking = () => {
    if (!user) { navigate('/login'); return; }
    setBookingOpen(true);
    setBookingStep(0);
    setSelectedSlot(null);
    setSessionType('video');
    setSubject(tutor?.subjects?.[0] || '');
    setStudentNote('');
    setBookingError('');
    setBookingSuccess(false);
  };

  const handleBook = async () => {
    if (!selectedSlot || !subject) {
      setBookingError('Please select a time slot and subject.');
      return;
    }
    setBookingLoading(true);
    setBookingError('');
    try {
      await api.post('/tutoring/bookings/create/', {
        slot_id: selectedSlot.id,
        subject,
        session_type: sessionType,
        student_note: studentNote,
      });
      setBookingSuccess(true);
      setBookingStep(2);
    } catch (err) {
      setBookingError(err.response?.data?.error || 'Booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    const key = slot.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  if (!tutor) return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header card */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 80, height: 80, fontSize: 36 }}>
              {tutor.user?.display_name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="h2">{tutor.user?.first_name} {tutor.user?.last_name}</Typography>
                {tutor.verification_status === 'approved' && <Chip icon={<VerifiedUser />} label="Verified" color="success" size="small" />}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Rating value={tutor.average_rating} precision={0.1} readOnly />
                <Typography variant="body2" color="text.secondary">({tutor.total_reviews} reviews)</Typography>
              </Box>
              <Typography variant="h3" color="primary" sx={{ mb: 2 }}>£{tutor.hourly_rate}/hr</Typography>
              <Stack direction="row" spacing={1}>
                {user && user.id !== id ? (<Button variant="contained" size="large" onClick={openBooking}>Book a Session</Button>) : !user ? (<Button variant="contained" size="large" onClick={() => navigate("/login")}>Log in to Book</Button>) : (<Button variant="contained" size="large" disabled>This is your profile</Button>)}
                <Button variant="outlined" size="large" disabled>Message (Coming Soon)</Button>
              </Stack>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Bio */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 2 }}>About</Typography>
              <Typography sx={{ lineHeight: 1.7 }}>{tutor.bio}</Typography>
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 2 }}>Reviews ({reviews.length})</Typography>
              {reviews.length === 0 ? (
                <Typography color="text.secondary">No reviews yet.</Typography>
              ) : (
                <Stack spacing={2}>
                  {reviews.map(r => (
                    <Box key={r.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'info.main', fontSize: 14 }}>{r.student_name?.[0]}</Avatar>
                        <Typography variant="h6">{r.student_name}</Typography>
                        <Rating value={r.rating} size="small" readOnly />
                      </Box>
                      <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{r.comment}</Typography>
                      <Divider sx={{ mt: 2 }} />
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>Subjects</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 3 }}>
                {(tutor.subjects || []).map(s => (
                  <Chip key={s} label={s} color="primary" size="small" />
                ))}
              </Box>

              <Typography variant="h4" sx={{ mb: 1 }}>Experience</Typography>
              <Typography sx={{ mb: 3 }}>{tutor.experience_years} years</Typography>

              <Typography variant="h4" sx={{ mb: 1 }}>Sessions</Typography>
              <Typography>{tutor.total_sessions} completed</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ===== BOOKING DIALOG ===== */}
      <Dialog open={bookingOpen} onClose={() => !bookingLoading && setBookingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {bookingSuccess ? 'Session Booked!' : 'Book a Session'}
          <IconButton onClick={() => setBookingOpen(false)} size="small"><Close /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {!bookingSuccess && (
            <Stepper activeStep={bookingStep} sx={{ mb: 3 }}>
              <Step><StepLabel>Select Time</StepLabel></Step>
              <Step><StepLabel>Details</StepLabel></Step>
              <Step><StepLabel>Confirmed</StepLabel></Step>
            </Stepper>
          )}

          {bookingError && <Alert severity="error" sx={{ mb: 2 }}>{bookingError}</Alert>}

          {/* Step 0: Select slot */}
          {bookingStep === 0 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select an available time slot with {tutor.user?.first_name}.
              </Typography>
              {Object.keys(slotsByDate).length === 0 ? (
                <Alert severity="info">No available slots at the moment. Check back later.</Alert>
              ) : (
                <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                  {Object.entries(slotsByDate).slice(0, 7).map(([date, dateSlots]) => (
                    <Box key={date} sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        {new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {dateSlots.map(slot => (
                          <Chip
                            key={slot.id}
                            label={slot.start_time?.substring(0, 5) + ' – ' + slot.end_time?.substring(0, 5)}
                            onClick={() => setSelectedSlot(slot)}
                            color={selectedSlot?.id === slot.id ? 'primary' : 'default'}
                            variant={selectedSlot?.id === slot.id ? 'filled' : 'outlined'}
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}

          {/* Step 1: Session details */}
          {bookingStep === 1 && (
            <>
              {/* Summary */}
              <Card variant="outlined" sx={{ mb: 2, bgcolor: '#F0FDF4' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="body2" fontWeight={500}>
                    {tutor.user?.first_name} {tutor.user?.last_name} — £{tutor.hourly_rate}/hr
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSlot && new Date(selectedSlot.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' '}{selectedSlot?.start_time?.substring(0, 5)} – {selectedSlot?.end_time?.substring(0, 5)}
                  </Typography>
                </CardContent>
              </Card>

              <TextField
                fullWidth select label="Subject" value={subject}
                onChange={(e) => setSubject(e.target.value)} sx={{ mb: 2 }} required
              >
                {(tutor.subjects || []).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                <MenuItem value="Other">Other</MenuItem>
              </TextField>

              <Typography variant="h6" sx={{ mb: 1 }}>Session Type</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                {[
                  { value: 'video', label: 'Video Call', icon: <VideoCall />, desc: 'Google Meet / Zoom / Teams' },
                  { value: 'in_person', label: 'In Person', icon: <Person />, desc: 'Meet at agreed location' },
                  { value: 'chat', label: 'Chat', icon: <Chat />, desc: 'Text-based session' },
                ].map(opt => (
                  <Card
                    key={opt.value}
                    variant={sessionType === opt.value ? 'elevation' : 'outlined'}
                    sx={{
                      flex: 1, cursor: 'pointer', textAlign: 'center', py: 1.5,
                      border: sessionType === opt.value ? '2px solid' : '1px solid',
                      borderColor: sessionType === opt.value ? 'primary.main' : 'divider',
                    }}
                    onClick={() => setSessionType(opt.value)}
                  >
                    <CardContent sx={{ py: 0.5, '&:last-child': { pb: 0.5 } }}>
                      <Box sx={{ color: sessionType === opt.value ? 'primary.main' : 'text.secondary' }}>{opt.icon}</Box>
                      <Typography variant="caption" fontWeight={500}>{opt.label}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: 10 }}>{opt.desc}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>

              <TextField
                fullWidth multiline rows={3} label="Message to tutor (optional)"
                value={studentNote} onChange={(e) => setStudentNote(e.target.value)}
                placeholder="Tell your tutor what you need help with, any topics you'd like to cover, or questions you have."
                sx={{ mb: 1 }}
              />
            </>
          )}

          {/* Step 2: Confirmation */}
          {bookingStep === 2 && bookingSuccess && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h3" sx={{ mb: 1 }}>Session Booked!</Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Your session with {tutor.user?.first_name} has been confirmed. You'll find it in your dashboard.
              </Typography>
              <Stack direction="row" spacing={2} justifyContent="center">
                <Button variant="contained" onClick={() => navigate('/bookings')}>View My Bookings</Button>
                <Button variant="outlined" onClick={() => setBookingOpen(false)}>Close</Button>
              </Stack>
            </Box>
          )}
        </DialogContent>

        {!bookingSuccess && (
          <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
            {bookingStep > 0 ? (
              <Button startIcon={<ArrowBack />} onClick={() => setBookingStep(bookingStep - 1)}>Back</Button>
            ) : <Box />}
            {bookingStep === 0 && (
              <Button
                variant="contained" endIcon={<ArrowForward />}
                onClick={() => setBookingStep(1)}
                disabled={!selectedSlot}
              >
                Continue
              </Button>
            )}
            {bookingStep === 1 && (
              <Button
                variant="contained" onClick={handleBook}
                disabled={bookingLoading || !subject}
              >
                {bookingLoading ? 'Booking...' : `Confirm & Pay £${tutor.hourly_rate}`}
              </Button>
            )}
          </DialogActions>
        )}
      </Dialog>
    </Container>
  );
}
