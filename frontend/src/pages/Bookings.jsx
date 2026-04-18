import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Container, Typography, Card, CardContent, Box, Chip, Stack, Avatar, Button,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, Rating,
  TextField, Alert, Snackbar,
} from '@mui/material';
import { RateReview, CheckCircle } from '@mui/icons-material';

/**
 * Bookings page.
 *
 * Update 6: adds a "Leave Review" button on completed bookings that haven't
 * been reviewed yet, plus a review dialog with rating + comment.
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const isTutor = user?.role === 'tutor';

  const fetchBookings = useCallback(() => {
    api.get('/tutoring/bookings/')
      .then(r => {
        const list = r.data.results || r.data || [];
        setBookings(list);
        // Track which ones already have reviews so we don't show the button
        // (backend only allows one review per booking)
        const reviewed = new Set(list.filter(b => b.has_review).map(b => b.id));
        setReviewedIds(reviewed);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [location.key, fetchBookings]);

  // Tab 0 = Upcoming (confirmed + pending for tutors), 1 = Past (completed), 2 = Cancelled
  const filtered = bookings.filter(b => {
    if (tab === 0) return b.status === 'confirmed' || (isTutor && b.status === 'pending');
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

  const statusColor = (s) => {
    if (s === 'confirmed') return 'success';
    if (s === 'pending') return 'warning';
    if (s === 'completed') return 'info';
    return 'default';
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

          return (
            <Card key={b.id}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Avatar src={otherAvatar || undefined} sx={{ bgcolor: 'primary.main' }}>
                  {otherName?.[0]}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Typography variant="h5">{otherName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {b.subject} — {b.slot_date} at {b.slot_start}
                  </Typography>
                  {b.student_note && isTutor && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Note: "{b.student_note}"
                    </Typography>
                  )}
                  {b.tutor_note && !isTutor && (
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                      Tutor: "{b.tutor_note}"
                    </Typography>
                  )}
                </Box>
                <Chip label={b.status} color={statusColor(b.status)} size="small" />
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
                  <Chip icon={<CheckCircle />} label="Reviewed" size="small" variant="outlined" color="success" />
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
      <Dialog open={reviewOpen} onClose={() => !submitting && setReviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Review your session with {reviewTarget?.tutor_name}
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              How would you rate the session?
            </Typography>
            <Rating
              size="large"
              value={rating}
              onChange={(_, v) => setRating(v || 1)}
            />
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
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Your review will be public on the tutor's profile. Be honest and constructive.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewOpen(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant="contained" onClick={submitReview}
            disabled={submitting || !comment.trim()}
          >
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
    </Container>
  );
}
