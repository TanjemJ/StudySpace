import { useState } from 'react';
import api from '../../utils/api';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Radio, RadioGroup, FormControlLabel, FormControl, TextField, Alert,
} from '@mui/material';
import { Flag } from '@mui/icons-material';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'inappropriate', label: 'Inappropriate or offensive content' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'academic_dishonesty', label: 'Academic dishonesty' },
  { value: 'other', label: 'Other (please specify)' },
];

export default function ReportDialog({ open, onClose, targetType, targetId, onReported }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (loading) return;
    setReason(''); setDetails(''); setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason.');
      return;
    }
    if (reason === 'other' && !details.trim()) {
      setError('Please provide details for "Other".');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const endpoint = targetType === 'post'
        ? `/forum/posts/${targetId}/report/`
        : `/forum/replies/${targetId}/report/`;
      await api.post(endpoint, { reason, details });
      if (onReported) onReported();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Flag sx={{ color: 'error.main' }} />
        Report {targetType === 'post' ? 'Post' : 'Comment'}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Help us keep StudySpace safe. Please select a reason below and our moderation team will review it.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <RadioGroup value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map(r => (
              <FormControlLabel
                key={r.value}
                value={r.value}
                control={<Radio size="small" />}
                label={<Typography variant="body2">{r.label}</Typography>}
                sx={{ mb: 0.25 }}
              />
            ))}
          </RadioGroup>
        </FormControl>

        <TextField
          fullWidth multiline rows={3}
          label={reason === 'other' ? 'Please specify (required)' : 'Additional details (optional)'}
          value={details} onChange={(e) => setDetails(e.target.value)}
          sx={{ mt: 2 }}
          inputProps={{ maxLength: 1000 }}
          helperText={`${details.length}/1000 characters`}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained" color="error" onClick={handleSubmit}
          disabled={loading || !reason}
        >
          {loading ? 'Submitting...' : 'Submit Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
