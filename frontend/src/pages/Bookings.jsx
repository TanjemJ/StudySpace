import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Container, Typography, Card, CardContent, Box, Chip, Stack, Avatar, Button,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, Rating,
  TextField, Alert, Snackbar, Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  RateReview, CheckCircle, Cancel as CancelIcon, HourglassEmpty, SwapHoriz,
  ExpandMore, ExpandLess, VideoCall, Chat as ChatIcon, Person as PersonIcon,
} from '@mui/icons-material';

import ChangeRequestCard from '../components/booking/ChangeRequestCard';
import ChangeRequestDialog from '../components/booking/ChangeRequestDialog';
import BookingDocumentsList from '../components/booking/BookingDocumentsList';
import CancelBookingDialog from '../components/booking/CancelBookingDialog';

/**
 * Bookings page 
 *
 * Everything happens here now for students + tutors (same page, different
 * role-based UI):
 *   - Documents widget per booking
 *   - Accept / decline change requests
 *   - Propose new changes (even on confirmed bookings)
 *   - Cancel with tiered refund disclosure
 *   - Review completed bookings
 */

export default function Bookings() {
  const { user } = useAuth();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState(0);
  const [expanded, setExpanded] = useState({});  // { bookingId: true }

  // Dialog state
  const [changeReqOpen, setChangeReqOpen] = useState(false);
  const [changeReqTarget, setChangeReqTarget] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);

  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineSubmitting, setDeclineSubmitting] = useState(false);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const isTutor = user?.role === 'tutor';

  const fetchBookings = useCallback(() => {
    api.get('/tutoring/bookings/')
      .then(r => setBookings(r.data.results || r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchBookings(); }, [location.key, fetchBookings]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      setSnackbar('Payment received. Your tutor will see the request shortly.');
      fetchBookings();
    }
    if (params.get('payment') === 'cancelled') {
      setSnackbar('Checkout was cancelled. The slot will be released if payment is not completed.');
      fetchBookings();
    }
  }, [location.search, fetchBookings]);

  const filtered = bookings.filter(b => {
    if (tab === 0) {
      const activeStatuses = isTutor
        ? ['confirmed', 'pending', 'change_requested']
        : ['confirmed', 'pending', 'pending_payment', 'change_requested'];
      return activeStatuses.includes(b.status);
    }
    if (tab === 1) return b.status === 'completed';
    if (tab === 2) return b.status === 'cancelled';
    return false;
  });

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- review ---
  const openReview = (booking) => {
    setReviewTarget(booking);
    setRating(5);
    setComment('');
    setError('');
    setReviewOpen(true);
  };

  const submitReview = async () => {
    if (!comment.trim()) { setError('Please write a short comment.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/tutoring/reviews/create/', {
        booking_id: reviewTarget.id, rating, comment: comment.trim(),
      });
      setReviewOpen(false);
      setSnackbar('Review submitted.');
      fetchBookings();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- change request / cancel helpers ---
  const openChangeRequest = (booking) => {
    setChangeReqTarget(booking);
    setChangeReqOpen(true);
  };

  const openCancel = (booking) => {
    setCancelTarget(booking);
    setCancelOpen(true);
  };

    // Tutor accepts a pending booking — one click, no dialog.
  const quickAccept = async (booking) => {
    try {
      await api.post(`/tutoring/bookings/${booking.id}/accept/`);
      setSnackbar('Booking accepted.');
      fetchBookings();
    } catch (err) {
      setSnackbar(err.response?.data?.error || 'Failed to accept booking.');
    }
  };

  const openDecline = (booking) => {
    setDeclineTarget(booking);
    setDeclineReason('');
    setError('');
  };

  const submitDecline = async () => {
    if (!declineTarget) return;
    setDeclineSubmitting(true);
    setError('');
    try {
      await api.post(`/tutoring/bookings/${declineTarget.id}/decline/`, {
        reason: declineReason,
      });
      setSnackbar('Booking declined. The student has been refunded.');
      setDeclineTarget(null);
      setDeclineReason('');
      fetchBookings();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to decline booking.');
    } finally {
      setDeclineSubmitting(false);
    }
  };

  // --- rendering helpers ---
  const statusColor = (s) => {
    if (s === 'confirmed') return 'success';
    if (s === 'pending') return 'warning';
    if (s === 'pending_payment') return 'warning';
    if (s === 'change_requested') return 'warning';
    if (s === 'completed') return 'info';
    if (s === 'cancelled') return 'default';
    return 'default';
  };

  const statusLabel = (s) => {
    if (s === 'change_requested') return 'Change requested';
    if (s === 'pending_payment') return 'Payment pending';
    return s;
  };

  const sessionIcon = (type) => {
    if (type === 'video') return <VideoCall sx={{ fontSize: 16 }} />;
    if (type === 'in_person') return <PersonIcon sx={{ fontSize: 16 }} />;
    return <ChatIcon sx={{ fontSize: 16 }} />;
  };

  function sessionTypeLabel(t) {
    if (t === 'video') return 'Video Call';
    if (t === 'in_person') return 'In Person';
    if (t === 'chat') return 'Other';
    if (t === 'other') return 'Other';
    return t || '—';
  }

  function videoPlatformLabel(p) {
    if (p === 'google_meet') return 'Google Meet';
    if (p === 'zoom') return 'Zoom';
    if (p === 'teams') return 'Microsoft Teams';
    return p || '';
  }

  const refundTierChip = (booking) => {
    if (!booking.refund_tier) return null;
    const { tier, label, percent } = booking.refund_tier;
    const color = percent === 100 ? 'success' : percent === 50 ? 'warning' : 'default';
    return (
      <Tooltip title={`If you cancel now: ${label}`}>
        <Chip label={`Refund: ${percent}%`} size="small" variant="outlined" color={color} />
      </Tooltip>
    );
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 3 }}>My Bookings</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Upcoming" />
        <Tab label="Past" />
        <Tab label="Cancelled" />
      </Tabs>

      <Stack spacing={2}>
        {filtered.map(b => {
          const otherName = isTutor ? b.student_name : b.tutor_name;
          const otherAvatar = isTutor ? b.student_avatar : b.tutor_avatar;
          const canReview = !isTutor && tab === 1 && b.status === 'completed' && !b.has_review;
          const isActive = isTutor
            ? ['confirmed', 'pending', 'change_requested'].includes(b.status)
            : ['confirmed', 'pending', 'pending_payment', 'change_requested'].includes(b.status);
          const canEditDocs = isActive;
          const pendingChange = b.pending_change;
          const isExpanded = !!expanded[b.id];

          // Who can request changes / cancel?
          // - Pending: tutor can accept/decline/request-change; student can cancel (full refund since tutor hasn't accepted)
          // - Confirmed: both can request-change or cancel
          // - Change_requested: both see the diff card, the non-requester acts
          const canRequestChange = ['pending', 'confirmed'].includes(b.status) && !pendingChange;
          const canCancel = isActive;

          return (
            <Card key={b.id} sx={{
              borderLeft: pendingChange ? '4px solid' : undefined,
              borderColor: pendingChange ? 'warning.main' : undefined,
            }}>
              <CardContent>
                {/* Top row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Avatar src={otherAvatar || undefined} sx={{ bgcolor: 'primary.main' }}>
                    {otherName?.[0]}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    <Typography variant="h5">{otherName}</Typography>
                    <Typography variant="body2" color="text.secondary"
                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {sessionIcon(b.session_type)} {b.subject} — {b.slot_date} at {b.slot_start?.slice(0, 5)}
                    </Typography>
                    {(b.video_platform || b.location_suggestion) && (
                      <Typography variant="caption" color="text.secondary"
                                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        {b.session_type === 'video' && b.video_platform && (
                          <>via {videoPlatformLabel(b.video_platform)}</>
                        )}
                        {b.session_type === 'in_person' && b.location_suggestion && (
                          <>📍 {b.location_suggestion}</>
                        )}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={statusLabel(b.status)}
                    color={statusColor(b.status)}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                  <Typography variant="h5" color="primary">£{b.price}</Typography>
                  {canReview && (
                    <Button variant="contained" size="small" startIcon={<RateReview />}
                            onClick={() => openReview(b)}>
                      Leave Review
                    </Button>
                  )}
                  {b.has_review && tab === 1 && (
                    <Chip icon={<CheckCircle />} label="Reviewed"
                          size="small" variant="outlined" color="success" />
                  )}
                </Box>

                {/* Pending change card (shared by both sides — component handles role logic) */}
                {pendingChange && (
                  <ChangeRequestCard
                    changeRequest={pendingChange}
                    booking={b}
                    currentUserId={user?.id}
                    onResolved={() => {
                      fetchBookings();
                      setSnackbar('Change request updated.');
                    }}
                  />
                )}

                {/* Student note (visible to tutor) */}
                {b.student_note && isTutor && !pendingChange && (
                  <Alert severity="info" sx={{ mt: 1.5 }}>
                    <strong>Student's note:</strong> "{b.student_note}"
                  </Alert>
                )}

                {/* Pending (student side) - waiting for tutor */}
                {!isTutor && b.status === 'pending' && !pendingChange && (
                  <Alert severity="info" icon={<HourglassEmpty />} sx={{ mt: 1.5 }}>
                    Waiting for the tutor to accept this booking.
                  </Alert>
                )}
                {!isTutor && b.status === 'pending_payment' && (
                  <Alert severity="warning" icon={<HourglassEmpty />} sx={{ mt: 1.5 }}>
                    Payment is still being confirmed. The tutor will receive the request once Stripe confirms payment.
                  </Alert>
                )}

                {/* Cancelled with tutor note */}
                {b.tutor_note && !isTutor && b.status === 'cancelled' && (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    <strong>Tutor said:</strong> "{b.tutor_note}"
                  </Alert>
                )}
                {b.status === 'cancelled' && b.refund_percent !== undefined && (
                  <Alert severity={b.refund_percent > 0 ? 'success' : 'info'} sx={{ mt: 1.5 }}>
                    Refund: {b.refund_percent}%
                    {b.cancelled_at && ` · Cancelled ${new Date(b.cancelled_at).toLocaleDateString('en-GB')}`}
                  </Alert>
                )}

                {/* Actions row (active bookings only) */}
                {isActive && (
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    
                    {isTutor && b.status === 'pending' && !pendingChange && (
                      <>
                        <Button
                          size="small" variant="contained" color="success"
                          startIcon={<CheckCircle />}
                          onClick={() => quickAccept(b)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="small" variant="outlined" color="error"
                          startIcon={<CancelIcon />}
                          onClick={() => openDecline(b)}
                        >
                          Decline
                        </Button>
                      </>
                    )}

                    {canRequestChange && (
                      <Button
                        size="small" variant="outlined" startIcon={<SwapHoriz />}
                        onClick={() => openChangeRequest(b)}
                      >
                        Request Change
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        size="small" variant="outlined" color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => openCancel(b)}
                      >
                        Cancel Booking
                      </Button>
                    )}
                    {!isTutor && refundTierChip(b)}
                    <Box sx={{ flex: 1 }} />
                    <Button
                      size="small"
                      endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                      onClick={() => toggleExpand(b.id)}
                    >
                      {isExpanded ? 'Hide details' : `Details${b.documents?.length ? ` (${b.documents.length} file${b.documents.length === 1 ? '' : 's'})` : ''}`}
                    </Button>
                  </Box>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <>
                    <Divider sx={{ mt: 2 }} />
                    {!isTutor && b.student_note && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Your note:
                        </Typography>
                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                          "{b.student_note}"
                        </Typography>
                      </Box>
                    )}
                    <BookingDocumentsList
                      booking={b}
                      currentUserId={user?.id}
                      canEdit={canEditDocs}
                      onChanged={fetchBookings}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card>
            <CardContent>
              <Typography color="text.secondary">No bookings in this category.</Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* Shared dialogs */}
      <ChangeRequestDialog
        open={changeReqOpen}
        booking={changeReqTarget}
        onClose={() => setChangeReqOpen(false)}
        onSubmitted={() => {
          fetchBookings();
          setSnackbar('Change request submitted.');
        }}
      />

      <CancelBookingDialog
        open={cancelOpen}
        booking={cancelTarget}
        isTutor={isTutor}
        onClose={() => setCancelOpen(false)}
        onCancelled={() => {
          fetchBookings();
          setSnackbar('Booking cancelled.');
        }}
      />

      {/* Review dialog */}
      <Dialog open={reviewOpen} onClose={() => !submitting && setReviewOpen(false)}
              maxWidth="sm" fullWidth>
        <DialogTitle>Review your session with {reviewTarget?.tutor_name}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              How would you rate the session?
            </Typography>
            <Rating size="large" value={rating} onChange={(_, v) => setRating(v || 1)} />
          </Box>
          <TextField
            fullWidth multiline rows={4}
            label="Your review"
            placeholder="What went well? What could be improved?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            inputProps={{ maxLength: 1000 }}
            helperText={`${comment.length} / 1000`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewOpen(false)} disabled={submitting}>Cancel</Button>
          <Button variant="contained" onClick={submitReview}
                  disabled={submitting || !comment.trim()}>
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3500}
        onClose={() => setSnackbar('')}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Dialog
        open={!!declineTarget}
        onClose={() => !declineSubmitting && setDeclineTarget(null)}
        maxWidth="sm" fullWidth
      >
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
          <Button onClick={() => setDeclineTarget(null)} disabled={declineSubmitting}>
            Back
          </Button>
          <Button
            variant="contained" color="error"
            onClick={submitDecline}
            disabled={declineSubmitting}
          >
            {declineSubmitting ? 'Declining...' : 'Decline Booking'}
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}
