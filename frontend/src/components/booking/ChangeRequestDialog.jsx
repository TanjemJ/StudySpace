import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Box, Alert, Typography, Stack,
} from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import api from '../../utils/api';

/**
 * Shared dialog for proposing changes to a booking.
 *
 * Either the tutor or the student can open this. They can propose:
 *   - new date / start / end time
 *   - new session type (video or in_person — chat is no longer offered)
 *   - new video platform (only when session_type='video')
 *   - new location suggestion (only when session_type='in_person')
 * plus an optional explanatory message.
 */
const SESSION_TYPE_OPTIONS = [
  { value: 'video', label: 'Video Call' },
  { value: 'in_person', label: 'In Person' },
];
const VIDEO_PLATFORM_OPTIONS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'teams', label: 'Microsoft Teams' },
];

// Pretty display of a session_type value coming back from the server,
// including the legacy 'chat' value (now shown as "Other" per design).
function sessionTypeLabel(t) {
  if (t === 'video') return 'Video Call';
  if (t === 'in_person') return 'In Person';
  if (t === 'chat') return 'Other';   // legacy
  if (t === 'other') return 'Other';
  return t || '—';
}

export default function ChangeRequestDialog({ open, booking, onClose, onSubmitted }) {
  const [proposedDate, setProposedDate] = useState('');
  const [proposedStart, setProposedStart] = useState('');
  const [proposedEnd, setProposedEnd] = useState('');
  const [proposedType, setProposedType] = useState('');
  const [proposedPlatform, setProposedPlatform] = useState('');
  const [proposedLocation, setProposedLocation] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill with the current booking values when the dialog opens.
  // For session_type, if the booking is a legacy 'chat', default the proposal to 'video'
  // since chat isn't a valid choice anymore.
  useEffect(() => {
    if (open && booking) {
      setProposedDate(booking.slot_date || '');
      setProposedStart(booking.slot_start?.slice(0, 5) || '');
      setProposedEnd(booking.slot_end?.slice(0, 5) || '');
      const t = booking.session_type || 'video';
      setProposedType(t === 'chat' || t === 'other' ? 'video' : t);
      setProposedPlatform(booking.video_platform || '');
      setProposedLocation(booking.location_suggestion || '');
      setMessage('');
      setError('');
    }
  }, [open, booking]);

  if (!booking) return null;

  // Detect changes — note that platform/location only count as "changed"
  // when the matching session_type is selected.
  const dateChanged    = proposedDate !== booking.slot_date;
  const startChanged   = proposedStart !== booking.slot_start?.slice(0, 5);
  const endChanged     = proposedEnd !== booking.slot_end?.slice(0, 5);
  const typeChanged    = proposedType !== booking.session_type;
  const platformChanged = proposedType === 'video' &&
                          proposedPlatform !== (booking.video_platform || '');
  const locationChanged = proposedType === 'in_person' &&
                          proposedLocation.trim() !== (booking.location_suggestion || '').trim();

  const hasChanges = dateChanged || startChanged || endChanged ||
                     typeChanged || platformChanged || locationChanged;

  const submit = async () => {
    if (!hasChanges) {
      setError('Please change at least one field before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = { message };
      if (dateChanged) payload.proposed_date = proposedDate;
      if (startChanged) payload.proposed_start_time = proposedStart + ':00';
      if (endChanged) payload.proposed_end_time = proposedEnd + ':00';
      if (typeChanged) payload.proposed_session_type = proposedType;
      if (platformChanged) payload.proposed_video_platform = proposedPlatform;
      if (locationChanged) payload.proposed_location_suggestion = proposedLocation.trim();

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
            helperText={dateChanged ? `Was: ${booking.slot_date}` : 'Unchanged'}
          />

          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth type="time" label="Start time"
              value={proposedStart}
              onChange={(e) => setProposedStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={startChanged ? `Was: ${booking.slot_start?.slice(0, 5)}` : 'Unchanged'}
            />
            <TextField
              fullWidth type="time" label="End time"
              value={proposedEnd}
              onChange={(e) => setProposedEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={endChanged ? `Was: ${booking.slot_end?.slice(0, 5)}` : 'Unchanged'}
            />
          </Stack>

          <TextField
            select fullWidth label="Session type"
            value={proposedType}
            onChange={(e) => setProposedType(e.target.value)}
            helperText={typeChanged ? `Was: ${sessionTypeLabel(booking.session_type)}` : 'Unchanged'}
          >
            {SESSION_TYPE_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>

          {/* Conditional: video platform */}
          {proposedType === 'video' && (
            <TextField
              select fullWidth label="Video platform"
              value={proposedPlatform}
              onChange={(e) => setProposedPlatform(e.target.value)}
              helperText={
                platformChanged
                  ? `Was: ${booking.video_platform || '— not set —'}`
                  : 'Optional — leave blank if no preference'
              }
            >
              <MenuItem value=""><em>No preference</em></MenuItem>
              {VIDEO_PLATFORM_OPTIONS.map(p => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </TextField>
          )}

          {/* Conditional: location suggestion */}
          {proposedType === 'in_person' && (
            <TextField
              fullWidth label="Suggested location"
              value={proposedLocation}
              onChange={(e) => setProposedLocation(e.target.value)}
              placeholder="e.g. LSBU library, near Elephant & Castle"
              helperText={
                locationChanged
                  ? `Was: ${booking.location_suggestion || '— not set —'}`
                  : 'Optional — your tutor will confirm or propose somewhere else'
              }
              inputProps={{ maxLength: 200 }}
            />
          )}

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
