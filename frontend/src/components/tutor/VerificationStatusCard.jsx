import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
  Alert, CircularProgress, Link, MenuItem, Select, FormControl, InputLabel,
  IconButton,
} from '@mui/material';
import {
  CloudUpload, Description, HourglassEmpty, HelpOutline, Cancel,
  Delete, OpenInNew,
} from '@mui/icons-material';
import api from '../../utils/api';

const MAX_FILE_SIZE_MB = 10;
const MAX_PER_UPLOAD = 5;
const ALLOWED_EXTS = /\.(pdf|jpg|jpeg|png)$/i;
const TYPE_OPTIONS = [
  { value: 'photo_id', label: 'Photo ID' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'dbs', label: 'DBS Certificate' },
  { value: 'other', label: 'Other' },
];

const docTypeLabel = (t) =>
  TYPE_OPTIONS.find(o => o.value === t)?.label || t;

/**
 * Tutor-side verification status card.
 *
 * Renders different UIs based on verification_status:
 *   pending        → "pending review" summary + read-only docs
 *   under_review   → "actively under review" summary + read-only docs
 *   info_requested → admin's message + upload UI to attach more documents
 *   rejected       → reason (terminal state)
 *   approved       → returns null (TutorDashboard's existing approved alert
 *                    handles this case so we don't duplicate UI)
 *
 * Props:
 *   onChange — called after a successful upload so the parent can refresh
 *              other dashboard data (stats, user object, etc.).
 */
export default function VerificationStatusCard({ onChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]); // [{ file, type }]
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get('/auth/me/verification/')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Don't render anything while loading, on error, or for approved tutors.
  // The TutorDashboard already shows its own approved alert — we don't want
  // to double up.
  if (loading || !data) return null;
  if (data.verification_status === 'approved') return null;

  const handleAddFiles = (selected) => {
    setUploadError('');
    const remaining = MAX_PER_UPLOAD - uploadFiles.length;
    if (selected.length > remaining) {
      setUploadError(`You can attach at most ${MAX_PER_UPLOAD} files at a time.`);
    }
    const accepted = [];
    for (const f of Array.from(selected).slice(0, remaining)) {
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setUploadError(`"${f.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`);
        continue;
      }
      if (!ALLOWED_EXTS.test(f.name)) {
        setUploadError(`"${f.name}" is not a supported format. Use PDF, JPG, or PNG.`);
        continue;
      }
      accepted.push({ file: f, type: 'other' });
    }
    setUploadFiles(prev => [...prev, ...accepted]);
  };

  const handleRemoveFile = (idx) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleTypeChange = (idx, value) => {
    setUploadFiles(prev =>
      prev.map((d, i) => (i === idx ? { ...d, type: value } : d))
    );
  };

  const closeDialog = () => {
    if (submitting) return;
    setUploadOpen(false);
    setUploadFiles([]);
    setUploadError('');
  };

  const handleSubmit = async () => {
    if (uploadFiles.length === 0) {
      setUploadError('Please attach at least one document.');
      return;
    }
    setSubmitting(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('document_count', uploadFiles.length.toString());
      uploadFiles.forEach((d, i) => {
        fd.append(`document_${i}`, d.file);
        fd.append(`document_${i}_type`, d.type);
      });
      await api.post('/auth/me/verification/documents/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadFiles([]);
      setUploadOpen(false);
      fetchData();
      if (onChange) onChange();
    } catch (err) {
      setUploadError(
        err.response?.data?.error || 'Upload failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Status-driven presentation. One config object per non-approved state.
  const config = (() => {
    switch (data.verification_status) {
      case 'pending':
        return {
          severity: 'warning',
          icon: <HourglassEmpty sx={{ fontSize: 32, color: 'warning.main' }} />,
          chipLabel: 'Pending review',
          chipColor: 'warning',
          title: 'Your tutor application is pending review',
          body: 'Our admin team reviews new applications in submission order. '
              + 'You will receive a notification when the review is complete. '
              + 'No action is required from you right now.',
          showUpload: false,
        };
      case 'under_review':
        return {
          severity: 'info',
          icon: <HourglassEmpty sx={{ fontSize: 32, color: 'info.main' }} />,
          chipLabel: 'Under review',
          chipColor: 'info',
          title: 'Your application is under review',
          body: 'An admin is actively reviewing your documents. '
              + 'You will receive a notification when a decision is made.',
          showUpload: false,
        };
      case 'info_requested':
        return {
          severity: 'info',
          icon: <HelpOutline sx={{ fontSize: 32, color: 'info.main' }} />,
          chipLabel: 'Action required',
          chipColor: 'default',
          title: 'Additional information requested',
          body: '',  // We render a dedicated Alert with the message instead.
          showUpload: true,
        };
      case 'rejected':
        return {
          severity: 'error',
          icon: <Cancel sx={{ fontSize: 32, color: 'error.main' }} />,
          chipLabel: 'Not approved',
          chipColor: 'error',
          title: 'Verification application not approved',
          body: data.rejection_reason
              || 'Your application was not approved. Please contact support if you wish to appeal.',
          showUpload: false,
        };
      default:
        return null;
    }
  })();

  if (!config) return null;

  const documentLimitReached = data.document_count >= data.max_total_documents;

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          mb: 3,
          borderLeft: 4,
          borderLeftColor: `${config.severity}.main`,
        }}
      >
        <CardContent>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <Box sx={{ flexShrink: 0, mt: 0.5 }}>{config.icon}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ mb: 1, flexWrap: 'wrap' }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {config.title}
                </Typography>
                <Chip
                  label={config.chipLabel}
                  color={config.chipColor}
                  size="small"
                />
              </Stack>

              {/* Admin's info-request message gets its own prominent Alert */}
              {data.verification_status === 'info_requested'
                && data.info_request_message && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <strong>Admin&apos;s message:</strong>{' '}
                  {data.info_request_message}
                </Alert>
              )}

              {/* Generic body for all other states */}
              {config.body && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {config.body}
                </Typography>
              )}

              {/* Documents on file */}
              {data.documents && data.documents.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    Documents on file ({data.documents.length})
                  </Typography>
                  <Stack spacing={1}>
                    {data.documents.map(doc => (
                      <Stack
                        key={doc.id}
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{ flexWrap: 'wrap' }}
                      >
                        <Description fontSize="small" color="action" />
                        <Chip
                          label={docTypeLabel(doc.type)}
                          size="small"
                          variant="outlined"
                        />
                        {doc.file_url ? (
                          <Link
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            View
                            <OpenInNew sx={{ fontSize: 14 }} />
                          </Link>
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                          >
                            (Not viewable)
                          </Typography>
                        )}
                        {doc.uploaded_at && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </Typography>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Upload button — only for info_requested */}
              {config.showUpload && (
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ flexWrap: 'wrap' }}
                >
                  <Button
                    variant="contained"
                    startIcon={<CloudUpload />}
                    onClick={() => setUploadOpen(true)}
                    disabled={documentLimitReached}
                  >
                    Upload additional documents
                  </Button>
                  {documentLimitReached && (
                    <Typography variant="caption" color="error">
                      Document limit reached ({data.max_total_documents}).
                      Contact support to replace a document.
                    </Typography>
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog
        open={uploadOpen}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upload additional documents</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Attach up to {MAX_PER_UPLOAD} files (PDF, JPG, or PNG; max{' '}
            {MAX_FILE_SIZE_MB} MB each). Once you submit, your application
            moves back into the admin review queue.
          </DialogContentText>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleAddFiles(e.target.files || []);
              e.target.value = '';
            }}
          />

          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadFiles.length >= MAX_PER_UPLOAD || submitting}
            fullWidth
            sx={{ mb: 2 }}
          >
            Choose files ({uploadFiles.length}/{MAX_PER_UPLOAD})
          </Button>

          {uploadFiles.length > 0 && (
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              {uploadFiles.map((d, i) => (
                <Stack
                  key={`${d.file.name}-${i}`}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  <Description fontSize="small" />
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.file.name}
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={d.type}
                      label="Type"
                      onChange={(e) => handleTypeChange(i, e.target.value)}
                    >
                      {TYPE_OPTIONS.map(o => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemoveFile(i)}
                    disabled={submitting}
                    aria-label={`Remove ${d.file.name}`}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}

          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || uploadFiles.length === 0}
            startIcon={
              submitting
                ? <CircularProgress size={16} color="inherit" />
                : <CloudUpload />
            }
          >
            {submitting ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
