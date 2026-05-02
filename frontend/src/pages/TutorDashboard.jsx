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
  CheckCircle, Cancel, SwapHoriz, AccessTime, Payments, Star, VideoCall,
  Chat as ChatIcon, Person as PersonIcon, CalendarMonth, Schedule,
  HourglassEmpty, AttachFile, EditNote,
} from '@mui/icons-material';

import ChangeRequestDialog from '../components/booking/ChangeRequestDialog';
import ChangeRequestCard from '../components/booking/ChangeRequestCard';
import BookingDocumentsList from '../components/booking/BookingDocumentsList';
import CancelBookingDialog from '../components/booking/CancelBookingDialog';


export default function TutorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({
    pending_requests: 0, upcoming_sessions: 0, earnings_this_month: 0,
    total_students: 0, average_rating: 0, total_reviews: 0, total_sessions: 0,
  });

  // Simple decline dialog (separate from change-request dialog)
  const [declineDialog, setDeclineDialog] = useState(null);
  const [declineReason, setDeclineReason] = useState('');

  // Dialog targets
  const [changeReqTarget, setChangeReqTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [docsTarget, setDocsTarget] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const fetchData = useCallback(() => {
    Promise.all([
      api.get('/tutoring/bookings/').then(r => setBookings(r.data.results || r.data || [])).catch(() => {}),
      api.get('/auth/dashboard-stats/tutor/').then(r => setStats(r.data)).catch(() => {}),
    ]);
  }, []);

  useEffect(() => { fetchData(); }, [location.key, fetchData]);

  const pending = bookings.filter(b => b.status === 'pending' && !b.pending_change);
  const withPendingChange = bookings.filter(b => b.pending_change);
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const completed = bookings.filter(b => b.status === 'completed');
  const today = new Date().toISOString().slice(0, 10);
  const todaysSessions = confirmed.filter(b => b.slot_date === today);
  const upcomingConfirmed = confirmed.filter(b => b.slot_date > today);

  // Weekly earnings
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
    { label: 'Earnings This Month', value: `£${stats.earnings_this_month.toFixed(0)}`,
      icon: <Payments />, color: 'success.main',
      subtitle: `${completed.length} sessions completed` },
    { label: 'Sessions Completed', value: stats.total_sessions || 0,
      icon: <CheckCircle />, color: 'primary.main', subtitle: 'All time' },
    { label: 'Average Rating', value: stats.average_rating > 0 ? stats.average_rating.toFixed(1) : '—',
      icon: <Star />, color: 'warning.main', subtitle: `From ${stats.total_reviews} reviews` },
    { label: 'Pending + Awaiting', value: pending.length + withPendingChange.length,
      icon: <AccessTime />, color: 'info.main',
      subtitle: withPendingChange.length > 0
        ? `${withPendingChange.length} change request${withPendingChange.length === 1 ? '' : 's'}`
        : (pending.length > 0 ? 'Action needed' : 'Nothing pending') },
  ];

  const quickAccept = async (booking) => {
    try {
      await api.post(`/tutoring/bookings/${booking.id}/accept/`);
      setSnackbar('Booking accepted.');
      fetchData();
    } catch (err) {
      setSnackbar(err.response?.data?.error || 'Failed to accept.');
    }
  };

  const submitDecline = async () => {
    if (!declineDialog) return;
    setSubmitting(true);
    try {
      await api.post(`/tutoring/bookings/${declineDialog.id}/decline/`,
                     { reason: declineReason.trim() });
      setSnackbar('Booking declined.');
      setDeclineDialog(null);
      setDeclineReason('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Decline failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const markComplete = async (booking) => {
    try {
      await api.post(`/tutoring/bookings/${booking.id}/complete/`);
      setSnackbar('Session marked as complete.');
      fetchData();
    } catch (err) {
      setSnackbar(err.response?.data?.error || 'Failed.');
    }
  };

  const sessionIcon = (type) => {
    if (type === 'video') return <VideoCall sx={{ fontSize: 16, color: 'info.main' }} />;
    if (type === 'in_person') return <PersonIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
    return <ChatIcon sx={{ fontSize: 16, color: 'primary.main' }} />;
  };

  // Renders the action row on a confirmed upcoming booking
  const confirmedActions = (b) => (
    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
      <Button size="small" variant="outlined" startIcon={<SwapHoriz />}
              onClick={() => setChangeReqTarget(b)}>
        Request Change
      </Button>
      <Button size="small" variant="outlined" startIcon={<AttachFile />}
              onClick={() => setDocsTarget(b)}>
        {b.documents?.length ? `Files (${b.documents.length})` : 'Attach File'}
      </Button>
      <Button size="small" variant="outlined" color="error" startIcon={<Cancel />}
              onClick={() => setCancelTarget(b)}>
        Cancel
      </Button>
    </Stack>
  );

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
        <Button variant="outlined" startIcon={<Schedule />}
                onClick={() => navigate('/tutor-schedule')}>
          Manage Availability
        </Button>
      </Box>

      {user?.tutor_profile?.verification_status === 'approved' && (
        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 3 }}>
          Your tutor profile is <strong>approved and live</strong>.
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
          {user.tutor_profile.info_request_message || 'Check your notifications.'}
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
          {/* Today's Sessions */}
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
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar src={b.student_avatar || undefined}>
                        {b.student_first_name?.[0]}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h5">
                          {b.student_first_name} {b.student_last_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {sessionIcon(b.session_type)} {b.subject} — {b.slot_start?.slice(0, 5)}
                        </Typography>
                      </Box>
                      <Button variant="contained" size="small" startIcon={<CheckCircle />}
                              onClick={() => markComplete(b)}>
                        Mark Complete
                      </Button>
                    </Box>
                    {b.pending_change && (
                      <ChangeRequestCard
                        changeRequest={b.pending_change}
                        booking={b}
                        currentUserId={user?.id}
                        onResolved={fetchData}
                      />
                    )}
                    {confirmedActions(b)}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {/* Pending Requests */}
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
                          {sessionIcon(b.session_type)} {b.subject} — {b.slot_date} at {b.slot_start?.slice(0, 5)}
                        </Typography>
                      </Box>
                      <Typography variant="h5" color="primary">£{b.price}</Typography>
                    </Box>
                    {b.student_note && (
                      <Alert severity="info" sx={{ mb: 1.5 }}>
                        <strong>Student's note:</strong> "{b.student_note}"
                      </Alert>
                    )}
                    {b.documents?.length > 0 && (
                      <Alert severity="info" icon={<AttachFile />} sx={{ mb: 1.5 }}>
                        Student attached {b.documents.length} document
                        {b.documents.length === 1 ? '' : 's'}.{' '}
                        <Button size="small" onClick={() => setDocsTarget(b)}>
                          View
                        </Button>
                      </Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                      <Button variant="contained" color="success" size="small"
                              startIcon={<CheckCircle />} onClick={() => quickAccept(b)}>
                        Accept
                      </Button>
                      <Button variant="outlined" size="small" startIcon={<SwapHoriz />}
                              onClick={() => setChangeReqTarget(b)}>
                        Request Change
                      </Button>
                      <Button variant="outlined" color="error" size="small"
                              startIcon={<Cancel />}
                              onClick={() => { setDeclineDialog(b); setDeclineReason(''); }}>
                        Decline
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {/* Bookings with pending change requests */}
          {withPendingChange.length > 0 && (
            <>
              <Typography variant="h4" sx={{ mb: 2 }}>
                Change Requests
                <Chip label={withPendingChange.length} color="info"
                      size="small" sx={{ ml: 1 }} />
              </Typography>
              <Stack spacing={1.5} sx={{ mb: 4 }}>
                {withPendingChange.map(b => (
                  <Card key={b.id} sx={{ borderLeft: '4px solid', borderColor: 'info.main' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <Avatar src={b.student_avatar || undefined}>
                          {b.student_first_name?.[0]}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h5">
                            {b.student_first_name} {b.student_last_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {b.subject} — {b.slot_date} at {b.slot_start?.slice(0, 5)}
                          </Typography>
                        </Box>
                      </Box>
                      <ChangeRequestCard
                        changeRequest={b.pending_change}
                        booking={b}
                        currentUserId={user?.id}
                        onResolved={fetchData}
                      />
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </>
          )}

          {/* Upcoming confirmed */}
          {upcomingConfirmed.length > 0 && (
            <>
              <Typography variant="h4" sx={{ mb: 2 }}>
                Upcoming Confirmed Sessions
              </Typography>
              <Stack spacing={1.5} sx={{ mb: 4 }}>
                {upcomingConfirmed.map(b => (
                  <Card key={b.id}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={b.student_avatar || undefined}>
                          {b.student_first_name?.[0]}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h5">
                            {b.student_first_name} {b.student_last_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {sessionIcon(b.session_type)} {b.subject} —{' '}
                            {b.slot_date} at {b.slot_start?.slice(0, 5)}
                          </Typography>
                        </Box>
                        {b.documents?.length > 0 && (
                          <Chip
                            icon={<AttachFile />}
                            label={b.documents.length}
                            size="small" variant="outlined"
                          />
                        )}
                      </Box>
                      {confirmedActions(b)}
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
                    <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, height: 6, overflow: 'hidden' }}>
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
        </Grid>
      </Grid>

      {/* Dialogs */}
      <ChangeRequestDialog
        open={!!changeReqTarget}
        booking={changeReqTarget}
        onClose={() => setChangeReqTarget(null)}
        onSubmitted={() => {
          fetchData();
          setSnackbar('Change request submitted.');
        }}
      />

      <CancelBookingDialog
        open={!!cancelTarget}
        booking={cancelTarget}
        isTutor
        onClose={() => setCancelTarget(null)}
        onCancelled={() => {
          fetchData();
          setSnackbar('Booking cancelled.');
        }}
      />

      {/* Documents dialog */}
      <Dialog open={!!docsTarget} onClose={() => setDocsTarget(null)}
              maxWidth="sm" fullWidth>
        <DialogTitle>
          Booking Documents — {docsTarget?.student_first_name}'s session
        </DialogTitle>
        <DialogContent dividers>
          {docsTarget && (
            <BookingDocumentsList
              booking={docsTarget}
              currentUserId={user?.id}
              canEdit={['pending', 'confirmed', 'change_requested'].includes(docsTarget.status)}
              onChanged={() => {
                fetchData();
                // Refresh the dialog's local copy
                api.get(`/tutoring/bookings/${docsTarget.id}/`)
                  .then(r => setDocsTarget(r.data))
                  .catch(() => {});
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocsTarget(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Decline dialog */}
      <Dialog open={!!declineDialog} onClose={() => !submitting && setDeclineDialog(null)}
              maxWidth="sm" fullWidth>
        <DialogTitle>Decline booking?</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Typography variant="body2" sx={{ mb: 2 }}>
            The student will receive a full refund and the time slot will be freed.
          </Typography>
          <TextField
            fullWidth multiline rows={3}
            label="Reason (optional)"
            placeholder="e.g. I'm no longer available at that time."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeclineDialog(null)} disabled={submitting}>Back</Button>
          <Button variant="contained" color="error" onClick={submitDecline} disabled={submitting}>
            {submitting ? 'Declining...' : 'Decline Booking'}
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
