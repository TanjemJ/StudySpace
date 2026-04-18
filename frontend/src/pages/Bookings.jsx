import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Container, Typography, Card, CardContent, Box, Chip, Stack, Avatar, Button,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, Rating,
  TextField, Alert, Snackbar,
} from '@mui/material';
import {
  RateReview, CheckCircle, EditNote, Cancel, HourglassEmpty, SwapHoriz,
} from '@mui/icons-material';

/**
 * Bookings page.
 *
 * Update 6b: handles the two-way "request change" flow. When the tutor has
 * requested a change, the student sees a yellow banner on their booking card
 * with Accept / Decline buttons.
 */
export default function Bookings() {
  const { user } = useAuth();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState(0);
  const [reviewedIds, setReviewedIds] = useState(new Set());

  // Review dialog state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Change response dialog state (student accepts/declines tutor's change request)
  const [changeDialog, setChangeDialog] = useState(null); // { booking, action }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const isTutor = user?.role === 'tutor';

  const fetchBookings = useCallback(() => {
    api.get('/tutoring/bookings/')
      .then(r => {
        const list = r.data.results || r.data || [];
        setBookings(list);
        const reviewed = new Set(list.filter(b => b.has_review).map(b => b.id));
        setReviewedIds(reviewed);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [location.key, fetchBookings]);

  // Tab 0 = Upcoming. For students, this also includes pending + change_requested
  //                  so they can see everything that's not resolved.
  //                  For tutors, pending is shown on their dashboard instead.
  // Tab 1 = Past (completed). Tab 2 = Cancelled.
  const filtered = bookings.filter(b => {
    if (tab === 0) {
      if (isTutor) {
        return ['confirmed', 'pending', 'change_requested'].includes(b.status);
      }
      return ['confirmed', 'pending', 'change_requested'].includes(b.status);
    }
    if (tab === 1) return b.status === 'completed';
    if (tab === 2) return b.status === 'cancelled';
    return false;
  });

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
        booking_id: reviewTarget.id,
        rating,
        comment: comment.trim(),
      });
      setReviewedIds(prev => new Set([...prev, reviewTarget.id]));
      setReviewOpen(false);
      setSnackbar('Review submitted — thanks for your feedback!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- NEW: change request handlers ---

  const openChangeResponse = (booking, action) => {
    setChangeDialog({ booking, action });
    setError('');
  };

  const confirmChangeResponse = async () => {
    if (!changeDialog) return;
    const { booking, action } = changeDialog;
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/tutoring/bookings/${booking.id}/${action}/`);
      setSnackbar(
        action === 'accept_change'
          ? 'Change accepted — your booking is confirmed.'
          : 'Booking cancelled.'
      );
      setChangeDialog(null);
      fetchBookings();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s) => {
    if (s === 'confirmed') return 'success';
    if (s === 'pending') return 'warning';
    if (s === 'change_requested') return 'warning';
    if (s === 'completed') return 'info';
    return 'default';
  };

  const statusLabel = (s) => {
    if (s === 'change_requested') return 'Change requested';
    return s;
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
          const hasReviewed = reviewedIds.has(b.id);
          const canReview = !isTutor && tab === 1 && b.status === 'completed' && !hasReviewed;
          const awaitingStudent = !isTutor && b.status === 'change_requested';
          const awaitingTutorStudentSide = !isTutor && b.status === 'pending';
          const awaitingStudentTutorSide = isTutor && b.status === 'change_requested';

          return (
            <Card key={b.id} sx={{
              borderLeft: awaitingStudent || awaitingStudentTutorSide ? '4px solid' : undefined,
              borderColor: awaitingStudent || awaitingStudentTutorSide ? 'warning.main' : undefined,
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Avatar src={otherAvatar || undefined} sx={{ bgcolor: 'primary.main' }}>
                    {otherName?.[0]}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    <Typography variant="h5">{otherName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {b.subject} — {b.slot_date} at {b.slot_start}
                    </Typography>
                  </Box>
                  <Chip
                    label={statusLabel(b.status)}
                    color={statusColor(b.status)}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                  <Typography variant="h5" color="primary">£{b.price}</Typography>
                  {canReview && (
                    <Button
                      variant="contained" size="small" startIcon={<RateReview />}
                      onClick={() => openReview(b)}
                    >
                      Leave Review
                    </Button>
                  )}
                  {hasReviewed && tab === 1 && (
                    <Chip icon={<CheckCircle />} label="Reviewed"
                          size="small" variant="outlined" color="success" />
                  )}
                </Box>

                {/* Student's note (visible to tutor) */}
                {b.student_note && isTutor && (
                  <Typography variant="caption" color="text.secondary"
                              sx={{ display: 'block', mt: 1.5 }}>
                    Student's note: "{b.student_note}"
                  </Typography>
                )}

                {/* Pending (student side) - waiting for tutor */}
                {awaitingTutorStudentSide && (
                  <Alert severity="info" icon={<HourglassEmpty />} sx={{ mt: 2 }}>
                    Waiting for the tutor to accept or decline this booking.
                  </Alert>
                )}

                {/* Change requested — student side */}
                {awaitingStudent && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="warning" icon={<SwapHoriz />} sx={{ mb: 1.5 }}>
                      <strong>{b.tutor_name} has suggested a change:</strong>
                      <Typography sx={{ mt: 0.5, fontStyle: 'italic' }}>
                        "{b.tutor_note}"
                      </Typography>
                    </Alert>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained" color="success" size="small"
                        startIcon={<CheckCircle />}
                        onClick={() => openChangeResponse(b, 'accept_change')}
                      >
                        Accept Change
                      </Button>
                      <Button
                        variant="outlined" color="error" size="small"
                        startIcon={<Cancel />}
                        onClick={() => openChangeResponse(b, 'decline_change')}
                      >
                        Decline & Cancel
                      </Button>
                    </Stack>
                  </Box>
                )}

                {/* Change requested — tutor side (awaiting student) */}
                {awaitingStudentTutorSide && (
                  <Alert severity="info" icon={<HourglassEmpty />} sx={{ mt: 2 }}>
                    <strong>Awaiting student response</strong> — you asked: "{b.tutor_note}"
                  </Alert>
                )}

                {/* Tutor note on cancelled bookings (for student) */}
                {b.tutor_note && !isTutor && b.status === 'cancelled' && (
                  <Typography variant="caption" color="warning.main"
                              sx={{ display: 'block', mt: 1.5 }}>
                    Tutor said: "{b.tutor_note}"
                  </Typography>
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
            <Rating size="large" value={rating}
                    onChange={(_, v) => setRating(v || 1)} />
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
          <Typography variant="caption" color="text.secondary"
                      sx={{ display: 'block', mt: 1 }}>
            Your review will be public on the tutor's profile. Be honest and constructive.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitReview}
                  disabled={submitting || !comment.trim()}>
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* NEW: change-response dialog */}
      <Dialog
        open={!!changeDialog}
        onClose={() => !submitting && setChangeDialog(null)}
        maxWidth="sm" fullWidth
      >
        <DialogTitle>
          {changeDialog?.action === 'accept_change' && 'Accept the suggested change?'}
          {changeDialog?.action === 'decline_change' && 'Decline and cancel booking?'}
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {changeDialog && (
            <>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                <strong>{changeDialog.booking.tutor_name} suggested:</strong>
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                "{changeDialog.booking.tutor_note}"
              </Alert>
              {changeDialog.action === 'accept_change' ? (
                <Typography variant="body2">
                  By accepting, you agree to this change and your booking will be confirmed.
                  The time slot will remain reserved.
                </Typography>
              ) : (
                <Typography variant="body2">
                  The booking will be cancelled and the time slot will be freed up for other
                  students. You can book again later if you find a slot that works.
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeDialog(null)} disabled={submitting}>
            Back
          </Button>
          <Button
            variant="contained"
            color={changeDialog?.action === 'decline_change' ? 'error' : 'success'}
            onClick={confirmChangeResponse}
            disabled={submitting}
          >
            {submitting ? 'Working...' : 'Confirm'}
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
    </Container>
  );
}
