import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Stack, Chip, Avatar, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert, Snackbar,
  Accordion, AccordionSummary, AccordionDetails, Grid, CircularProgress, Link,
} from '@mui/material';
import {
  CheckCircle, Cancel, HelpOutline, Description, ExpandMore, PersonOutline,
  School as SchoolIcon,
} from '@mui/icons-material';
import api from '../../utils/api';

/**
 * Admin tab — review tutor verification applications.
 *
 * Actions:
 *  - Approve    → tutor becomes visible in search, gets notification
 *  - Request Info → sends a message to the tutor asking for more details
 *  - Reject     → sets status to rejected with a reason
 */
export default function VerificationQueue({ onChange }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  // Action dialog state
  const [dialog, setDialog] = useState(null); // { tutor, action }
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const fetchQueue = useCallback(() => {
    setLoading(true);
    api.get('/auth/admin/verification-queue/')
      .then(r => setQueue(r.data))
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const openDialog = (tutor, action) => {
    setDialog({ tutor, action });
    setMessage('');
    setError('');
  };

  const closeDialog = () => {
    if (!submitting) {
      setDialog(null);
      setMessage('');
      setError('');
    }
  };

  const handleAction = async () => {
    if (!dialog) return;
    const { tutor, action } = dialog;

    // Validation
    if (action === 'reject' && !message.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    if (action === 'request_info' && !message.trim()) {
      setError('Please explain what additional information is needed.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {};
      if (action === 'reject') payload.reason = message.trim();
      if (action === 'request_info') payload.message = message.trim();

      await api.post(`/auth/admin/verification/${tutor.id}/${action}/`, payload);

      const actionVerbs = {
        approve: 'approved',
        reject: 'rejected',
        request_info: 'flagged for more info',
      };
      setSnackbar(`${tutor.first_name} ${tutor.last_name} ${actionVerbs[action]}.`);
      setDialog(null);
      fetchQueue();
      if (onChange) onChange();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusChip = (status) => {
    if (status === 'pending') return <Chip label="Pending" color="warning" size="small" />;
    if (status === 'under_review') return <Chip label="Under Review" color="info" size="small" />;
    if (status === 'info_requested') return <Chip label="Info Requested" color="default" size="small" />;
    return <Chip label={status} size="small" />;
  };

  const docTypeLabel = (type) => {
    const labels = {
      qualification: 'Qualification',
      photo_id: 'Photo ID',
      dbs: 'DBS Certificate',
      other: 'Other Document',
    };
    return labels[type] || type;
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Verification Queue</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review tutor applications. Each tutor's documents are available for inspection below.
      </Typography>

      {queue.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography>All clear — no pending verifications.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {queue.map(tutor => (
            <Accordion key={tutor.id} defaultExpanded={false} sx={{ borderRadius: 2, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {tutor.first_name?.[0]}{tutor.last_name?.[0]}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5">
                      {tutor.first_name} {tutor.last_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tutor.email} • £{parseFloat(tutor.hourly_rate).toFixed(0)}/hr • {tutor.experience_years}y experience
                    </Typography>
                  </Box>
                  {statusChip(tutor.verification_status)}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 0.5 }}>Subjects</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                      {(tutor.subjects || []).map(s => <Chip key={s} label={s} size="small" />)}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 0.5 }}>Personal Statement</Typography>
                    <Typography variant="body2" color="text.secondary"
                      sx={{ whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'auto' }}>
                      {tutor.personal_statement || '(None provided)'}
                    </Typography>
                  </Grid>
                </Grid>

                <Typography variant="h6" sx={{ mb: 1 }}>Documents ({tutor.documents?.length || 0})</Typography>
                {(!tutor.documents || tutor.documents.length === 0) ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>No documents uploaded.</Alert>
                ) : (
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    {tutor.documents.map(doc => (
                      <Grid item xs={12} sm={6} md={4} key={doc.id}>
                        <Card variant="outlined">
                          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5,
                            '&:last-child': { pb: 1.5 } }}>
                            <Description color="primary" />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2">{docTypeLabel(doc.type)}</Typography>
                              {doc.file_url && (
                                <Link href={doc.file_url} target="_blank" rel="noopener" variant="caption">
                                  View file →
                                </Link>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}

                {tutor.rejection_reason && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>Previous note:</strong> {tutor.rejection_reason}
                  </Alert>
                )}

                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button variant="contained" color="success" startIcon={<CheckCircle />}
                          onClick={() => openDialog(tutor, 'approve')}>
                    Approve
                  </Button>
                  <Button variant="outlined" color="info" startIcon={<HelpOutline />}
                          onClick={() => openDialog(tutor, 'request_info')}>
                    Request Info
                  </Button>
                  <Button variant="outlined" color="error" startIcon={<Cancel />}
                          onClick={() => openDialog(tutor, 'reject')}>
                    Reject
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}

      {/* Action confirmation dialog */}
      <Dialog open={!!dialog} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialog?.action === 'approve' && 'Approve Tutor'}
          {dialog?.action === 'reject' && 'Reject Application'}
          {dialog?.action === 'request_info' && 'Request More Information'}
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {dialog && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {dialog.action === 'approve' && (
                <>Approve <strong>{dialog.tutor.first_name} {dialog.tutor.last_name}</strong>? They'll appear
                in tutor search immediately and receive a notification.</>
              )}
              {dialog.action === 'reject' && (
                <>Reject <strong>{dialog.tutor.first_name} {dialog.tutor.last_name}</strong>'s application.
                Please provide a reason — this will be sent to the tutor.</>
              )}
              {dialog.action === 'request_info' && (
                <>Ask <strong>{dialog.tutor.first_name} {dialog.tutor.last_name}</strong> for more
                information. They'll receive a notification with your message.</>
              )}
            </Typography>
          )}

          {dialog?.action !== 'approve' && (
            <TextField
              fullWidth multiline rows={4}
              label={dialog?.action === 'reject' ? 'Reason for rejection' : 'What info is needed?'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={dialog?.action === 'reject'
                ? 'e.g. Documents unclear, expired DBS, etc.'
                : 'e.g. Please upload a more recent DBS certificate.'}
              autoFocus
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>Cancel</Button>
          <Button
            variant="contained"
            color={dialog?.action === 'reject' ? 'error' : dialog?.action === 'approve' ? 'success' : 'primary'}
            onClick={handleAction}
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
    </Box>
  );
}
