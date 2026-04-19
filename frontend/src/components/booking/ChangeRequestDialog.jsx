import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Box, Alert, Typography, Stack, Chip,
} from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import api from '../../utils/api';

/**
 * Shared dialog for proposing changes to a booking.
 *
 * Either the tutor or the student can open this. They can propose a new date,
 * a new start/end time, or a new session type, plus an optional message.
 * Submitting creates a BookingChangeRequest on the backend and notifies the
 * other party.
 *
 * Props:
 *   open           — bool
 *   booking        — the current booking object
 *   onClose        — () => void
 *   onSubmitted    — () => void  (called after success so parent can refetch)
 */
export default function ChangeRequestDialog({ open, booking, onClose, onSubmitted }) {
  const [proposedDate, setProposedDate] = useState('');
  const [proposedStart, setProposedStart] = useState('');
  const [proposedEnd, setProposedEnd] = useState('');
  const [proposedType, setProposedType] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill with the current values when the dialog opens
  useEffect(() => {
    if (open && booking) {
      setProposedDate(booking.slot_date || '');
      setProposedStart(booking.slot_start?.slice(0, 5) || '');
      setProposedEnd(booking.slot_end?.slice(0, 5) || '');
      setProposedType(booking.session_type || '');
      setMessage('');
      setError('');
    }
  }, [open, booking]);

  if (!booking) return null;

  const hasChanges =
    proposedDate !== booking.slot_date ||
    proposedStart !== booking.slot_start?.slice(0, 5) ||
    proposedEnd !== booking.slot_end?.slice(0, 5) ||
    proposedType !== booking.session_type;

  const submit = async () => {
    if (!hasChanges) {
      setError('Please change at least one field before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = { message };
      if (proposedDate !== booking.slot_date) payload.proposed_date = proposedDate;
      if (proposedStart !== booking.slot_start?.slice(0, 5))
        payload.proposed_start_time = proposedStart + ':00';
      if (proposedEnd !== booking.slot_end?.slice(0, 5))
        payload.proposed_end_time = proposedEnd + ':00';
      if (proposedType !== booking.session_type) payload.proposed_session_type = proposedType;

      await api.post(`/tutoring/bookings/${booking.id}/change-requests/`, payload);
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit change request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SwapHoriz color="warning" />
        Request a Change
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Propose new values for the fields you want to change. The other party
          will see a side-by-side comparison and can accept or decline.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth type="date" label="Date"
            value={proposedDate}
            onChange={(e) => setProposedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().slice(0, 10) }}
            helperText={proposedDate !== booking.slot_date
              ? `Was: ${booking.slot_date}` : 'Unchanged'}
          />

          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth type="time" label="Start time"
              value={proposedStart}
              onChange={(e) => setProposedStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={proposedStart !== booking.slot_start?.slice(0, 5)
                ? `Was: ${booking.slot_start?.slice(0, 5)}` : 'Unchanged'}
            />
            <TextField
              fullWidth type="time" label="End time"
              value={proposedEnd}
              onChange={(e) => setProposedEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={proposedEnd !== booking.slot_end?.slice(0, 5)
                ? `Was: ${booking.slot_end?.slice(0, 5)}` : 'Unchanged'}
            />
          </Stack>

          <TextField
            select fullWidth label="Session type"
            value={proposedType}
            onChange={(e) => setProposedType(e.target.value)}
            helperText={proposedType !== booking.session_type
              ? `Was: ${booking.session_type}` : 'Unchanged'}
          >
            <MenuItem value="video">Video Call</MenuItem>
            <MenuItem value="in_person">In Person</MenuItem>
            <MenuItem value="chat">Chat</MenuItem>
          </TextField>

          <TextField
            fullWidth multiline rows={3}
            label="Message (optional)"
            placeholder="Explain why you're requesting this change."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            inputProps={{ maxLength: 500 }}
          />
        </Box>

        {!hasChanges && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No changes detected — modify at least one field to submit.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={submitting || !hasChanges}
        >
          {submitting ? 'Submitting...' : 'Submit Change Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
