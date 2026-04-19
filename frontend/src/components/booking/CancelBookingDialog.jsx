import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Alert, Typography, Box,
} from '@mui/material';
import { Warning, CheckCircle, Cancel } from '@mui/icons-material';
import api from '../../utils/api';

/**
 * Cancel booking dialog with tiered refund disclosure.
 *
 * Uses booking.refund_tier (supplied by the backend) to show what the
 * user will get back. Tutors always get the full-refund path so they
 * see an even simpler message.
 */
export default function CancelBookingDialog({
  open, booking, isTutor, onClose, onCancelled,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!booking) return null;

  const refund = booking.refund_tier || { tier: 'full', percent: 100, label: 'Full refund' };
  const displayLabel = isTutor ? 'Full refund (tutor cancellation)' : refund.label;
  const displayPct = isTutor ? 100 : refund.percent;

  const severity = displayPct === 100 ? 'success'
                 : displayPct === 50 ? 'warning'
                 : 'error';

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/tutoring/bookings/${booking.id}/cancel/`);
      onCancelled?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Cancellation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Cancel color="error" />
        Cancel this booking?
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="body2" sx={{ mb: 2 }}>
          {booking.subject} with {isTutor ? booking.student_name : booking.tutor_name} on{' '}
          <strong>{booking.slot_date}</strong> at <strong>{booking.slot_start?.slice(0, 5)}</strong>
        </Typography>

        <Alert severity={severity} icon={displayPct > 0 ? <CheckCircle /> : <Warning />}>
          <Typography sx={{ fontWeight: 600 }}>
            {displayLabel}
            {!isTutor && booking.hours_until_session !== null && (
              <> · {booking.hours_until_session.toFixed(1)} hours until session</>
            )}
          </Typography>
          {!isTutor && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              Cancellation policy — Full refund: more than 72h before · 50% refund: 24–72h before · No refund: less than 24h before
            </Typography>
          )}
          {isTutor && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              When a tutor cancels, the student always receives a full refund.
            </Typography>
          )}
        </Alert>

        {displayPct === 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            You will not receive a refund. The session will be removed from your bookings.
            Consider requesting a change instead if a different date/time would work.
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            The other party will be notified immediately. Any attached documents will be
            removed from active view.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Keep booking</Button>
        <Button
          variant="contained" color="error"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? 'Cancelling...' : `Confirm Cancel (${displayPct}% refund)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
