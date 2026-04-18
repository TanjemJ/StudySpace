import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Grid, Card, CardContent, Box, Chip, Stack, Avatar,
  Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Snackbar,
} from '@mui/material';
import {
  CheckCircle, Cancel, EditNote, AccessTime, Payments, Star, VideoCall,
  Chat as ChatIcon, Person as PersonIcon, CalendarMonth, Schedule,
  HourglassEmpty, SwapHoriz,
} from '@mui/icons-material';

/**
 * Tutor Dashboard (Update 6b).
 *
 * Additions:
 *  - New "Awaiting Student Response" section for bookings where the tutor
 *    requested a change and is now waiting for the student's reply
 *  - Pending requests count no longer includes change_requested (which lives
 *    in its own section)
 */
export default function TutorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({
    pending_requests: 0,
    upcoming_sessions: 0,
    earnings_this_month: 0,
    total_students: 0,
    average_rating: 0,
    total_reviews: 0,
    total_sessions: 0,
  });

  const [actionDialog, setActionDialog] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [error, setError] = useState('');

  const fetchData = useCallback(() => {
    Promise.all([
      api.get('/tutoring/bookings/').then(r => setBookings(r.data.results || r.data || [])).catch(() => {}),
      api.get('/auth/dashboard-stats/tutor/').then(r => setStats(r.data)).catch(() => {}),
    ]);
  }, []);

  useEffect(() => { fetchData(); }, [location.key, fetchData]);

  const pending = bookings.filter(b => b.status === 'pending');
  const awaitingStudent = bookings.filter(b => b.status === 'change_requested');
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const completed = bookings.filter(b => b.status === 'completed');
  const today = new Date().toISOString().slice(0, 10);
  const todaysSessions = confirmed.filter(b => b.slot_date === today);

  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const amount = completed
      .filter(b => b.slot_date === key)
      .reduce((sum, b) => sum + parseFloat(b.price || 0), 0);
    weeklyData.push({ day, amount });
  }
  const maxWeekly = Math.max(...weeklyData.map(d => d.amount), 1);

  const statCards = [
    {
      label: 'Earnings This Month',
      value: `£${stats.earnings_this_month.toFixed(0)}`,
      icon: <Payments />, color: 'success.main',
      subtitle: `${completed.length} sessions completed`,
    },
    {
      label: 'Sessions Completed',
      value: stats.total_sessions || 0,
      icon: <CheckCircle />, color: 'primary.main',
      subtitle: 'All time',
    },
    {
      label: 'Average Rating',
      value: stats.average_rating > 0 ? stats.average_rating.toFixed(1) : '—',
      icon: <Star />, color: 'warning.main',
      subtitle: `From ${stats.total_reviews} reviews`,
    },
    {
      label: 'Pending + Awaiting',
      value: pending.length + awaitingStudent.length,
      icon: <AccessTime />, color: 'info.main',
      subtitle: awaitingStudent.length > 0
        ? `${awaitingStudent.length} awaiting student`
        : (pending.length > 0 ? 'Action needed' : 'Nothing pending'),
    },
  ];

  const openAction = (booking, action) => {
    setActionDialog({ booking, action });
    setActionMsg('');
    setError('');
  };

  const closeAction = () => {
    if (!submitting) {
      setActionDialog(null);
      setActionMsg('');
      setError('');
    }
  };

  const confirmAction = async () => {
    if (!actionDialog) return;
    const { booking, action } = actionDialog;

    if (action === 'request_change' && !actionMsg.trim()) {
      setError('Please describe the change you need.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {};
      if (action === 'decline') payload.reason = actionMsg.trim();
      if (action === 'request_change') payload.message = actionMsg.trim();

      await api.post(`/tutoring/bookings/${booking.id}/${action}/`, payload);

      const verbs = {
        accept: 'accepted',
        decline: 'declined',
        request_change: 'change requested — waiting on student',
        complete: 'marked complete',
        cancel: 'cancelled',
      };
      setSnackbar(`Booking ${verbs[action]}.`);
      setActionDialog(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const quickAccept = async (booking) => {
    try {
      await api.post(`/tutoring/bookings/${booking.id}/accept/`);
      setSnackbar('Booking accepted.');
      fetchData();
    } catch (err) {
      setSnackbar(err.response?.data?.error || 'Failed to accept.');
    }
  };

  const sessionIcon = (type) => {
    if (type === 'video') return <VideoCall sx={{ fontSize: 16, color: 'info.main' }} />;
    if (type === 'in_person') return <PersonIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
    return <ChatIcon sx={{ fontSize: 16, color: 'primary.main' }} />;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                 mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2">Welcome back, {user?.first_name}!</Typography>
          <Typography color="text.secondary">
            Here's what's happening with your tutoring today.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Schedule />}
          onClick={() => navigate('/tutor-schedule')}
        >
          Manage Availability
        </Button>
      </Box>

      {user?.tutor_profile?.verification_status === 'approved' && (
        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 3 }}>
          Your tutor profile is <strong>approved and live</strong>. Students can find and book you.
        </Alert>
      )}
      {user?.tutor_profile?.verification_status === 'pending' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Your profile is <strong>pending review</strong> by our admin team.
        </Alert>
      )}
      {user?.tutor_profile?.verification_status === 'info_requested' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <strong>More information needed:</strong>{' '}
          {user.tutor_profile.rejection_reason || 'Check your notifications.'}
        </Alert>
      )}
      {user?.tutor_profile?.verification_status === 'rejected' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Your application was rejected. Reason:{' '}
          {user.tutor_profile.rejection_reason || '(see your notifications)'}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map(s => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Box sx={{ color: s.color, mb: 1 }}>{s.icon}</Box>
                <Typography variant="h3">{s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                {s.subtitle && (
                  <Typography variant="caption" color="text.secondary"
                              sx={{ display: 'block', mt: 0.5 }}>
                    {s.subtitle}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          {/* Today's sessions */}
          <Typography variant="h4" sx={{ mb: 2 }}>Today's Sessions</Typography>
          {todaysSessions.length === 0 ? (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography color="text.secondary">No sessions today.</Typography>
              </CardContent>
            </Card>
          ) : (
            <Stack spacing={1.5} sx={{ mb: 4 }}>
              {todaysSessions.map(b => (
                <Card key={b.id}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={b.student_avatar || undefined}>
                      {b.student_first_name?.[0]}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5">
                        {b.student_first_name} {b.student_last_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {sessionIcon(b.session_type)} {b.subject} — {b.slot_start}
                      </Typography>
                    </Box>
                    <Button variant="contained" size="small" startIcon={<CheckCircle />}
                            onClick={() => openAction(b, 'complete')}>
                      Mark Complete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {/* Student requests (pending) */}
          <Typography variant="h4" sx={{ mb: 2 }}>
            Student Requests
            {pending.length > 0 && (
              <Chip label={pending.length} color="warning" size="small" sx={{ ml: 1 }} />
            )}
          </Typography>
          {pending.length === 0 ? (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography color="text.secondary">No pending requests.</Typography>
              </CardContent>
            </Card>
          ) : (
            <Stack spacing={1.5} sx={{ mb: 4 }}>
              {pending.map(b => (
                <Card key={b.id} sx={{ borderLeft: '4px solid', borderColor: 'warning.main' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                      <Avatar src={b.student_avatar || undefined}>
                        {b.student_first_name?.[0]}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h5">
                          {b.student_first_name} {b.student_last_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {sessionIcon(b.session_type)} {b.subject} — {b.slot_date} at {b.slot_start}
                        </Typography>
                      </Box>
                      <Typography variant="h5" color="primary">£{b.price}</Typography>
                    </Box>
                    {b.student_note && (
                      <Alert severity="info" sx={{ mb: 1.5 }}>
                        <strong>Student's note:</strong> "{b.student_note}"
                      </Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                      <Button variant="contained" color="success" size="small"
                              startIcon={<CheckCircle />} onClick={() => quickAccept(b)}>
                        Accept
                      </Button>
                      <Button variant="outlined" size="small" startIcon={<EditNote />}
                              onClick={() => openAction(b, 'request_change')}>
                        Request Change
                      </Button>
                      <Button variant="outlined" color="error" size="small"
                              startIcon={<Cancel />}
                              onClick={() => openAction(b, 'decline')}>
                        Decline
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {/* NEW: Awaiting Student Response */}
          {awaitingStudent.length > 0 && (
            <>
              <Typography variant="h4" sx={{ mb: 2 }}>
                Awaiting Student Response
                <Chip label={awaitingStudent.length} color="info"
                      size="small" sx={{ ml: 1 }} />
              </Typography>
              <Stack spacing={1.5} sx={{ mb: 4 }}>
                {awaitingStudent.map(b => (
                  <Card key={b.id} sx={{ borderLeft: '4px solid', borderColor: 'info.main' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                        <Avatar src={b.student_avatar || undefined}>
                          {b.student_first_name?.[0]}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h5">
                            {b.student_first_name} {b.student_last_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {sessionIcon(b.session_type)} {b.subject} — {b.slot_date} at {b.slot_start}
                          </Typography>
                        </Box>
                        <Chip
                          icon={<HourglassEmpty />}
                          label="Awaiting response"
                          color="info" size="small"
                        />
                      </Box>
                      <Alert severity="warning" icon={<SwapHoriz />} sx={{ mb: 1 }}>
                        <strong>You asked:</strong> "{b.tutor_note}"
                      </Alert>
                      <Typography variant="caption" color="text.secondary">
                        The student will see this request on their Bookings page and can accept
                        or decline. You'll get a notification either way.
                      </Typography>
                      <Box sx={{ mt: 1.5 }}>
                        <Button
                          variant="outlined" color="error" size="small"
                          onClick={() => openAction(b, 'cancel')}
                        >
                          Cancel this booking
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </>
          )}
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>Weekly Earnings</Typography>
              <Stack spacing={1.5}>
                {weeklyData.map(d => (
                  <Box key={d.day}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{d.day}</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        £{d.amount.toFixed(0)}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: 'action.hover', borderRadius: 1,
                               height: 6, overflow: 'hidden' }}>
                      <Box sx={{
                        bgcolor: 'success.main', height: '100%',
                        width: `${(d.amount / maxWeekly) * 100}%`,
                        transition: 'width 0.3s',
                      }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Upcoming ({confirmed.length})
              </Typography>
              {confirmed.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No upcoming sessions.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {confirmed.slice(0, 5).map(b => (
                    <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarMonth sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {b.student_first_name} • {b.subject}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {b.slot_date} at {b.slot_start}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action dialog */}
      <Dialog open={!!actionDialog} onClose={closeAction} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionDialog?.action === 'decline' && 'Decline Booking'}
          {actionDialog?.action === 'request_change' && 'Request a Change'}
          {actionDialog?.action === 'complete' && 'Mark Session Complete'}
          {actionDialog?.action === 'cancel' && 'Cancel Booking'}
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {actionDialog?.action === 'decline' && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                The booking will be cancelled and the time slot will be freed.
                Optionally, leave a brief reason.
              </Typography>
              <TextField
                fullWidth multiline rows={3}
                label="Reason (optional)"
                placeholder="e.g. I'm no longer available at that time."
                value={actionMsg}
                onChange={(e) => setActionMsg(e.target.value)}
              />
            </>
          )}

          {actionDialog?.action === 'request_change' && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                The booking will be flagged as awaiting the student's response. The student will
                see your message on their Bookings page and can accept the change (confirming the
                booking) or decline (cancelling it).
              </Typography>
              <TextField
                fullWidth multiline rows={3}
                label="What change do you need?"
                placeholder="e.g. Could we push this to 3pm instead?"
                value={actionMsg}
                onChange={(e) => setActionMsg(e.target.value)}
                autoFocus
              />
            </>
          )}

          {actionDialog?.action === 'complete' && (
            <Typography variant="body2">
              Mark this session as complete? This will finalise the booking and prompt the
              student to leave a review.
            </Typography>
          )}

          {actionDialog?.action === 'cancel' && (
            <Typography variant="body2">
              Cancel this booking? The student will be notified and the time slot will be freed.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAction} disabled={submitting}>Cancel</Button>
          <Button
            variant="contained"
            color={['decline', 'cancel'].includes(actionDialog?.action) ? 'error' : 'primary'}
            onClick={confirmAction}
            disabled={submitting}
          >
            {submitting ? 'Working...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar('')}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}
