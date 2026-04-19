import { useState, useRef } from 'react';
import {
  Box, Typography, Button, Stack, Card, CardContent, IconButton,
  Alert, LinearProgress, Link, Chip,
} from '@mui/material';
import {
  AttachFile, Delete, InsertDriveFile, CloudUpload, Download,
} from '@mui/icons-material';
import api from '../../utils/api';

const MAX_SIZE_MB = 10;
const MAX_DOCS = 5;
const ALLOWED_EXTS = /\.(pdf|jpg|jpeg|png|doc|docx|txt)$/i;

/**
 * Booking documents widget.
 *
 * Shows all documents on the booking plus an upload button. Users can only
 * delete documents they uploaded. Both parties see each other's uploads.
 *
 * Props:
 *   booking       — the booking object (uses booking.id and booking.documents[])
 *   currentUserId — for showing/hiding the Delete button
 *   canEdit       — bool (false when booking completed/cancelled)
 *   onChanged     — () => void (refetch after upload/delete)
 */
export default function BookingDocumentsList({ booking, currentUserId, canEdit = true, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const docs = booking?.documents || [];
  const atLimit = docs.length >= MAX_DOCS;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`"${file.name}" exceeds the ${MAX_SIZE_MB}MB limit.`);
      return;
    }
    if (!ALLOWED_EXTS.test(file.name)) {
      setError('Allowed formats: PDF, JPG, PNG, DOC, DOCX, TXT.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/tutoring/bookings/${booking.id}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Remove this document?')) return;
    try {
      await api.delete(`/tutoring/bookings/documents/${docId}/`);
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          <AttachFile sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
          Attachments ({docs.length}/{MAX_DOCS})
        </Typography>
        {canEdit && !atLimit && (
          <Button
            size="small" variant="outlined" startIcon={<CloudUpload />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Add file'}
          </Button>
        )}
      </Box>

      {uploading && <LinearProgress sx={{ mb: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {docs.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No documents attached.
          {canEdit && ' Add coursework, notes, or references here.'}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {docs.map(doc => {
            const isOwner = String(doc.uploader_id) === String(currentUserId);
            return (
              <Card key={doc.id} variant="outlined">
                <CardContent sx={{ py: 1, px: 1.5, display: 'flex', alignItems: 'center', gap: 1,
                                    '&:last-child': { pb: 1 } }}>
                  <InsertDriveFile sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>{doc.original_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {doc.uploader_name} · {formatSize(doc.size_bytes)}
                      {isOwner && <Chip label="you" size="small" sx={{ ml: 0.5, height: 16, fontSize: '0.65rem' }} />}
                    </Typography>
                  </Box>
                  {doc.file_url && (
                    <IconButton size="small" component={Link} href={doc.file_url}
                                target="_blank" rel="noopener">
                      <Download fontSize="small" />
                    </IconButton>
                  )}
                  {canEdit && isOwner && (
                    <IconButton size="small" onClick={() => handleDelete(doc.id)} color="error">
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
