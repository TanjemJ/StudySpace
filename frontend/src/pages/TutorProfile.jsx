import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Card, CardContent, Box, Chip, Stack, Avatar, Button,
  Rating, Grid, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Stepper, Step, StepLabel, IconButton,
  ToggleButtonGroup, ToggleButton, Tooltip,
} from '@mui/material';
import {
  VerifiedUser, Close, VideoCall, Person, ArrowBack, ArrowForward, CheckCircle,
  ChevronLeft, ChevronRight, Today as TodayIcon, LocationOn,
  CloudUpload, InsertDriveFile,
} from '@mui/icons-material';

// ---- Booking window config ----
const MAX_WEEKS_AHEAD = 8;          // Students can book up to 8 weeks out (per design decision).
const MAX_BOOKING_DOCS = 5;
const MAX_DOC_SIZE_MB = 10;
const ALLOWED_DOC_EXTS = /\.(pdf|jpg|jpeg|png|doc|docx|txt)$/i;

// ---- Date helpers ----
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();          // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

// ---- Session type / video platform options ----
// `chat` is intentionally excluded from new booking flows. Old chat bookings
// are displayed elsewhere as "Other".
const SESSION_TYPES = [
  { value: 'video',     label: 'Video Call', icon: <VideoCall />, desc: 'Pick a platform below' },
  { value: 'in_person', label: 'In Person',  icon: <Person />,    desc: 'Suggest a location below' },
];
const VIDEO_PLATFORMS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom',        label: 'Zoom' },
  { value: 'teams',       label: 'Microsoft Teams' },
];

// ---- Location formatter (shared with TutorSearch via props) ----
function formatLocation(tutor) {
  const city = (tutor.location_city || '').trim();
  const area = (tutor.location_postcode_area || '').trim();
  if (!city && !area) return null;
  if (city && area) return `${city} (${area})`;
  return city || area;
}

export default function TutorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tutor, setTutor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [slots, setSlots] = useState([]);

  // Booking dialog state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [sessionType, setSessionType] = useState('video');
  const [videoPlatform, setVideoPlatform] = useState('');         // empty = no preference
  const [locationSuggestion, setLocationSuggestion] = useState('');
  const [subject, setSubject] = useState('');
  const [studentNote, setStudentNote] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // File attachments (added 2026-04-25 — students can now attach files at booking time)
  const [bookingDocs, setBookingDocs] = useState([]);    // [{ file, description }]
  const [docDragActive, setDocDragActive] = useState(false);
  const docInputRef = useRef(null);

  // Calendar nav (added 2026-04-25)
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const earliestMonday = useMemo(() => getMonday(today), [today]);
  const latestMonday = useMemo(() => getMonday(addDays(today, MAX_WEEKS_AHEAD * 7 - 1)), [today]);
  const [weekStart, setWeekStart] = useState(earliestMonday);

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
    setVideoPlatform('');
    setLocationSuggestion('');
    setSubject(tutor?.subjects?.[0] || '');
    setStudentNote('');
    setBookingDocs([]);
    setBookingError('');
    setBookingSuccess(false);
    setWeekStart(earliestMonday);
  };

  const openMessage = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const res = await api.post('/messages/conversations/start/', {
      user_id: tutor.user.id,
    });

    navigate(`/messages/${res.data.id}`);
  };


  // Two-phase submit: create booking first, then upload each attached doc to it.
  const handleBook = async () => {
    if (!selectedSlot || !subject) {
      setBookingError('Please select a time slot and subject.');
      return;
    }
    setBookingLoading(true);
    setBookingError('');
    try {
      const payload = {
        slot_id: selectedSlot.id,
        subject,
        session_type: sessionType,
        student_note: studentNote,
      };
      if (sessionType === 'video' && videoPlatform) {
        payload.video_platform = videoPlatform;
      }
      if (sessionType === 'in_person' && locationSuggestion.trim()) {
        payload.location_suggestion = locationSuggestion.trim();
      }

      const res = await api.post('/tutoring/bookings/create/', payload);
      const bookingId = res.data?.id;

      // Upload attached documents (best-effort — booking already exists).
      // If any individual upload fails, we still treat the booking as created
      // and surface a partial-success message.
      const failedNames = [];
      if (bookingId && bookingDocs.length > 0) {
        for (const doc of bookingDocs) {
          try {
            const fd = new FormData();
            fd.append('file', doc.file);
            if (doc.description) fd.append('description', doc.description);
            await api.post(`/tutoring/bookings/${bookingId}/documents/`, fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (uploadErr) {
            failedNames.push(doc.file.name);
          }
        }
      }

      if (failedNames.length > 0) {
        setBookingError(
          `Booking confirmed, but these files failed to upload: ${failedNames.join(', ')}. ` +
          `You can re-attach them from the Bookings page.`,
        );
      }
      setBookingSuccess(true);
      setBookingStep(2);
    } catch (err) {
      setBookingError(err.response?.data?.error || 'Booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  // ---- doc drop / pick ----
  const acceptDocs = (files) => {
    const incoming = Array.from(files);
    const next = [...bookingDocs];
    for (const f of incoming) {
      if (next.length >= MAX_BOOKING_DOCS) break;
      if (!ALLOWED_DOC_EXTS.test(f.name)) continue;
      if (f.size > MAX_DOC_SIZE_MB * 1024 * 1024) continue;
      next.push({ file: f, description: '' });
    }
    setBookingDocs(next);
  };
  const onDocDrop = (e) => {
    e.preventDefault(); setDocDragActive(false);
    acceptDocs(e.dataTransfer.files);
  };
  const onDocDragOver = (e) => { e.preventDefault(); setDocDragActive(true); };
  const onDocDragLeave = () => setDocDragActive(false);

  // ---- Week navigation ----
  const canGoBack = weekStart > earliestMonday;
  const canGoFwd  = weekStart < latestMonday;
  const goPrev = () => setWeekStart(getMonday(addDays(weekStart, -7)));
  const goNext = () => setWeekStart(getMonday(addDays(weekStart, 7)));
  const goToday = () => setWeekStart(earliestMonday);

  // Slots within the visible week, grouped by date.
  const visibleSlotsByDate = useMemo(() => {
    if (!weekStart) return {};
    const out = {};
    const weekEnd = addDays(weekStart, 6);
    for (const s of slots) {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);
      // exclude slots before today
      if (d < today) continue;
      // exclude slots beyond the booking horizon
      if (d > addDays(today, MAX_WEEKS_AHEAD * 7 - 1)) continue;
      // exclude slots outside the visible week
      if (d < weekStart || d > weekEnd) continue;
      if (s.is_booked) continue;
      if (!out[s.date]) out[s.date] = [];
      out[s.date].push(s);
    }
    return out;
  }, [slots, weekStart, today]);

  if (!tutor) {
    return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;
  }

  const locationText = formatLocation(tutor);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header card */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Avatar src={tutor.user?.avatar || undefined}
                    sx={{ bgcolor: 'primary.main', width: 80, height: 80, fontSize: 36 }}>
              {tutor.user?.display_name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <Typography variant="h2">{tutor.user?.first_name} {tutor.user?.last_name}</Typography>
                {tutor.verification_status === 'approved' && (
                  <Chip icon={<VerifiedUser />} label="Verified" color="success" size="small" />
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Rating value={tutor.average_rating} precision={0.1} readOnly />
                <Typography variant="body2" color="text.secondary">
                  ({tutor.total_reviews} reviews)
                </Typography>
                {locationText && (
                  <Tooltip title="Approximate location — only given so students can gauge proximity for in-person sessions.">
                    <Chip
                      icon={<LocationOn sx={{ fontSize: 16 }} />}
                      label={`Based in ${locationText}`}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 0.5 }}
                    />
                  </Tooltip>
                )}
              </Box>
              <Typography variant="h3" color="primary" sx={{ mb: 2 }}>£{tutor.hourly_rate}/hr</Typography>
              <Stack direction="row" spacing={1}>
                {user && user.id !== id ? (
                  <Button variant="contained" size="large" onClick={openBooking}>Book a Session</Button>
                ) : !user ? (
                  <Button variant="contained" size="large" onClick={() => navigate('/login')}>
                    Log in to Book
                  </Button>
                ) : (
                  <Button variant="contained" size="large" disabled>This is your profile</Button>
                )}
                <Button
                  variant="outlined"
                  size="large"
                  onClick={openMessage}
                  disabled={user?.id === tutor.user?.id}
                >
                  Message
                </Button>
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
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'info.main', fontSize: 14 }}>
                          {r.student_name?.[0]}
                        </Avatar>
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
              <Typography sx={{ mb: locationText ? 3 : 0 }}>{tutor.total_sessions} completed</Typography>

              {locationText && (
                <>
                  <Typography variant="h4" sx={{ mb: 1 }}>Location</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <LocationOn sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography>{locationText}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Approximate. Used so you can gauge proximity for in-person sessions.
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ===== BOOKING DIALOG ===== */}
      <Dialog open={bookingOpen} onClose={() => !bookingLoading && setBookingOpen(false)}
              maxWidth="sm" fullWidth>
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

          {/* Step 0: Select slot — week navigation */}
          {bookingStep === 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                         mb: 2, gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  Select a time slot with {tutor.user?.first_name}.
                  Bookings open up to {MAX_WEEKS_AHEAD} weeks ahead.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <IconButton onClick={goPrev} disabled={!canGoBack} size="small">
                  <ChevronLeft />
                </IconButton>
                <Typography variant="h6" sx={{ flex: 1, textAlign: 'center' }}>
                  Week of {weekStart.toLocaleDateString('en-GB',
                    { day: 'numeric', month: 'short', year: 'numeric' })}
                </Typography>
                <IconButton onClick={goNext} disabled={!canGoFwd} size="small">
                  <ChevronRight />
                </IconButton>
                <Tooltip title="Jump to this week">
                  <span>
                    <IconButton onClick={goToday} size="small"
                                disabled={sameDay(weekStart, earliestMonday)}>
                      <TodayIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {Object.keys(visibleSlotsByDate).length === 0 ? (
                <Alert severity="info">
                  No slots available this week. Try a different week using the arrows above.
                </Alert>
              ) : (
                <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                  {Object.entries(visibleSlotsByDate)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, dateSlots]) => (
                    <Box key={date} sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        {new Date(date).toLocaleDateString('en-GB',
                          { weekday: 'long', day: 'numeric', month: 'long' })}
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
              <Card variant="outlined" sx={{ mb: 2, bgcolor: '#F0FDF4' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="body2" fontWeight={500}>
                    {tutor.user?.first_name} {tutor.user?.last_name} — £{tutor.hourly_rate}/hr
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSlot && new Date(selectedSlot.date).toLocaleDateString('en-GB',
                      { weekday: 'long', day: 'numeric', month: 'long' })}
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
                {SESSION_TYPES.map(opt => (
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
                      <Box sx={{ color: sessionType === opt.value ? 'primary.main' : 'text.secondary' }}>
                        {opt.icon}
                      </Box>
                      <Typography variant="caption" fontWeight={500}>{opt.label}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary"
                                  sx={{ fontSize: 10 }}>{opt.desc}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>

              {/* Conditional: video platform select */}
              {sessionType === 'video' && (
                <TextField
                  fullWidth select label="Video platform (preference)"
                  value={videoPlatform}
                  onChange={(e) => setVideoPlatform(e.target.value)}
                  helperText="Pick your preferred platform — your tutor will confirm or suggest a different one."
                  sx={{ mb: 2 }}
                >
                  <MenuItem value=""><em>No preference</em></MenuItem>
                  {VIDEO_PLATFORMS.map(p => (
                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                  ))}
                </TextField>
              )}

              {/* Conditional: location suggestion */}
              {sessionType === 'in_person' && (
                <TextField
                  fullWidth
                  label="Suggested location (optional)"
                  value={locationSuggestion}
                  onChange={(e) => setLocationSuggestion(e.target.value)}
                  placeholder="e.g. LSBU library, near Elephant & Castle"
                  helperText={
                    locationText
                      ? `Tutor is based in ${locationText}. Suggest somewhere convenient — they'll confirm or propose a different spot.`
                      : "Suggest somewhere convenient — your tutor will confirm or propose a different spot."
                  }
                  inputProps={{ maxLength: 200 }}
                  sx={{ mb: 2 }}
                />
              )}

              <TextField
                fullWidth multiline rows={3} label="Message to tutor (optional)"
                value={studentNote} onChange={(e) => setStudentNote(e.target.value)}
                placeholder="Tell your tutor what you need help with, any topics you'd like to cover, or questions you have."
                sx={{ mb: 2 }}
              />

              {/* File attachments */}
              <Typography variant="h6" sx={{ mb: 1 }}>Attach files (optional)</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Up to {MAX_BOOKING_DOCS} files (PDF, JPG, PNG, DOC/DOCX, TXT — ≤ {MAX_DOC_SIZE_MB}MB each).
                Useful for sharing homework, past papers, or notes ahead of the session.
              </Typography>
              <Box
                onDragOver={onDocDragOver}
                onDragLeave={onDocDragLeave}
                onDrop={onDocDrop}
                onClick={() => docInputRef.current?.click()}
                sx={{
                  border: '2px dashed',
                  borderColor: docDragActive ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  p: 2,
                  textAlign: 'center',
                  cursor: 'pointer',
                  mb: 1.5,
                  bgcolor: docDragActive ? 'action.hover' : 'transparent',
                }}
              >
                <CloudUpload sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2">
                  Drag &amp; drop files or click to browse
                </Typography>
                <input
                  ref={docInputRef}
                  type="file" multiple hidden
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
                  onChange={(e) => acceptDocs(e.target.files)}
                />
              </Box>
              <Stack spacing={0.5}>
                {bookingDocs.map((d, i) => (
                  <Box key={i}
                       sx={{ display: 'flex', alignItems: 'center', gap: 1,
                             p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <InsertDriveFile sx={{ color: 'text.secondary', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(d.file.size / 1024).toFixed(0)} KB
                    </Typography>
                    <IconButton size="small"
                                onClick={() => setBookingDocs(bookingDocs.filter((_, j) => j !== i))}>
                      <Close fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            </>
          )}

          {/* Step 2: Confirmation */}
          {bookingStep === 2 && bookingSuccess && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h3" sx={{ mb: 1 }}>Session Booked!</Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Your session with {tutor.user?.first_name} has been requested.
                You'll find it in your dashboard once {tutor.user?.first_name} accepts.
              </Typography>
              <Stack direction="row" spacing={2} justifyContent="center">
                <Button variant="contained" onClick={() => navigate('/bookings')}>
                  View My Bookings
                </Button>
                <Button variant="outlined" onClick={() => setBookingOpen(false)}>Close</Button>
              </Stack>
            </Box>
          )}
        </DialogContent>

        {!bookingSuccess && (
          <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
            {bookingStep > 0 ? (
              <Button startIcon={<ArrowBack />} onClick={() => setBookingStep(bookingStep - 1)}>
                Back
              </Button>
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
