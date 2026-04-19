import { useState } from 'react';
import {
  Alert, Box, Button, Stack, Typography, Chip,
} from '@mui/material';
import {
  CheckCircle, Cancel, Undo, SwapHoriz, ArrowForward,
} from '@mui/icons-material';
import api from '../../utils/api';

/**
 * Displays a pending change request on a booking with diff (Current → Proposed)
 * and action buttons.
 *
 * Shows one of two action sets:
 *   — If the current user is the requester → "Withdraw"
 *   — If the current user is the other party → "Accept change" / "Decline"
 *
 * Props:
 *   changeRequest — the pending_change object from the serialized booking
 *   booking       — the parent booking (used for current values + current user role)
 *   currentUserId — to detect requester vs other party
 *   onResolved    — () => void  (refetch after resolve)
 */
export default function ChangeRequestCard({
  changeRequest: cr, booking, currentUserId, onResolved,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!cr) return null;

  const isRequester = cr.requested_by_name && String(cr.requested_by_name) &&
    // We compare user IDs where available, but the serializer exposes
    // requested_by = 'student' | 'tutor' + requested_by_name. We infer
    // requester identity from the booking: requester is student if
    // requested_by == 'student', else tutor.
    ((cr.requested_by === 'student' && booking.student_id === currentUserId) ||
     (cr.requested_by === 'tutor' && booking.tutor_id === currentUserId));

  const resolve = async (action) => {
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/tutoring/change-requests/${cr.id}/${action}/`);
      onResolved?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
      setSubmitting(false);
    }
  };

  // Build diff rows — only show fields that actually changed
  const diffs = [];
  if (cr.proposed_date && cr.proposed_date !== cr.current_date) {
    diffs.push({ label: 'Date', from: cr.current_date, to: cr.proposed_date });
  }
  if (cr.proposed_start_time && cr.proposed_start_time !== cr.current_start_time) {
    diffs.push({
      label: 'Start',
      from: cr.current_start_time?.slice(0, 5),
      to: cr.proposed_start_time?.slice(0, 5),
    });
  }
  if (cr.proposed_end_time && cr.proposed_end_time !== cr.current_end_time) {
    diffs.push({
      label: 'End',
      from: cr.current_end_time?.slice(0, 5),
      to: cr.proposed_end_time?.slice(0, 5),
    });
  }
  if (cr.proposed_session_type && cr.proposed_session_type !== cr.current_session_type) {
    diffs.push({
      label: 'Session type',
      from: cr.current_session_type,
      to: cr.proposed_session_type,
    });
  }

  return (
    <Alert
      severity="warning"
      icon={<SwapHoriz />}
      sx={{ mt: 2, '& .MuiAlert-message': { width: '100%' } }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        {isRequester
          ? 'You proposed a change — waiting for a response'
          : `${cr.requested_by_name} proposed a change`}
      </Typography>

      {cr.message && (
        <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1.5 }}>
          "{cr.message}"
        </Typography>
      )}

      {diffs.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          {diffs.map(d => (
            <Box key={d.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary"
                          sx={{ minWidth: 100, fontWeight: 600 }}>
                {d.label}
              </Typography>
              <Chip label={String(d.from)} size="small" variant="outlined" />
              <ArrowForward sx={{ fontSize: 14 }} />
              <Chip label={String(d.to)} size="small" color="warning" />
            </Box>
          ))}
        </Box>
      )}

      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
          {error}
        </Typography>
      )}

      <Stack direction="row" spacing={1}>
        {isRequester ? (
          <Button
            size="small" variant="outlined"
            startIcon={<Undo />}
            onClick={() => resolve('withdraw')}
            disabled={submitting}
          >
            Withdraw Request
          </Button>
        ) : (
          <>
            <Button
              size="small" variant="contained" color="success"
              startIcon={<CheckCircle />}
              onClick={() => resolve('accept')}
              disabled={submitting}
            >
              Accept Change
            </Button>
            <Button
              size="small" variant="outlined" color="error"
              startIcon={<Cancel />}
              onClick={() => resolve('decline')}
              disabled={submitting}
            >
              Decline
            </Button>
          </>
        )}
      </Stack>
    </Alert>
  );
}
