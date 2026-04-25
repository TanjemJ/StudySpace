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
 */
function sessionTypeLabel(t) {
  if (t === 'video') return 'Video Call';
  if (t === 'in_person') return 'In Person';
  if (t === 'chat') return 'Other';   // legacy
  if (t === 'other') return 'Other';
  return t || '—';
}

function platformLabel(p) {
  if (p === 'google_meet') return 'Google Meet';
  if (p === 'zoom') return 'Zoom';
  if (p === 'teams') return 'Microsoft Teams';
  return p || '—';
}

export default function ChangeRequestCard({
  changeRequest: cr, booking, currentUserId, onResolved,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!cr) return null;

  const isRequester = cr.requested_by_name && String(cr.requested_by_name) &&
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

  // Build diff rows — only show fields that actually changed.
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
      from: sessionTypeLabel(cr.current_session_type),
      to: sessionTypeLabel(cr.proposed_session_type),
    });
  }
  // New (2026-04-25): platform / location diff rows.
  if (cr.proposed_video_platform &&
      cr.proposed_video_platform !== (cr.current_video_platform || '')) {
    diffs.push({
      label: 'Video platform',
      from: platformLabel(cr.current_video_platform) || '— not set —',
      to: platformLabel(cr.proposed_video_platform),
    });
  }
  if (cr.proposed_location_suggestion &&
      cr.proposed_location_suggestion !== (cr.current_location_suggestion || '')) {
    diffs.push({
      label: 'Location',
      from: cr.current_location_suggestion || '— not set —',
      to: cr.proposed_location_suggestion,
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
          ? 'You requested a change to this booking.'
          : `${cr.requested_by_name} proposed a change.`}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {diffs.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          {diffs.map((d, i) => (
            <Stack key={i} direction="row" alignItems="center" spacing={1}
                   sx={{ flexWrap: 'wrap', mb: 0.25 }}>
              <Typography variant="caption" sx={{ minWidth: 100, fontWeight: 600 }}>
                {d.label}:
              </Typography>
              <Chip size="small" variant="outlined" label={String(d.from)} />
              <ArrowForward sx={{ fontSize: 14 }} />
              <Chip size="small" color="warning" label={String(d.to)} />
            </Stack>
          ))}
        </Box>
      )}

      {cr.message && (
        <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1.5 }}>
          "{cr.message}"
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {isRequester ? (
          <Button
            size="small" variant="outlined" startIcon={<Undo />}
            onClick={() => resolve('withdraw')} disabled={submitting}
          >
            Withdraw
          </Button>
        ) : (
          <>
            <Button
              size="small" variant="contained" color="success"
              startIcon={<CheckCircle />}
              onClick={() => resolve('accept')} disabled={submitting}
            >
              Accept change
            </Button>
            <Button
              size="small" variant="outlined" color="error"
              startIcon={<Cancel />}
              onClick={() => resolve('decline')} disabled={submitting}
            >
              Decline
            </Button>
          </>
        )}
      </Stack>
    </Alert>
  );
}
