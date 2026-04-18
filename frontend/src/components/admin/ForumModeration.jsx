import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Stack, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert, Snackbar,
  Tabs, Tab, CircularProgress, MenuItem, Select,
} from '@mui/material';
import { Delete, Article, ChatBubble, Flag } from '@mui/icons-material';
import api from '../../utils/api';

/**
 * Admin tab — moderate flagged forum posts and replies.
 *
 * Flagged content comes from:
 *   - Automatic keyword detection on post creation
 *   - User reports (3+ reports auto-flag)
 *
 * Moderators can soft-delete with a reason. The author is notified.
 */
export default function ForumModeration({ onChange }) {
  const [content, setContent] = useState({ flagged_posts: [], flagged_replies: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [subtab, setSubtab] = useState(0); // 0 = posts, 1 = replies

  const [dialog, setDialog] = useState(null); // { type: 'post'|'reply', item }
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const REASONS = [
    'Inappropriate content',
    'Spam or promotional',
    'Harassment or bullying',
    'Hate speech',
    'Academic dishonesty',
    'Off-topic',
    'Other (see message)',
  ];
  const [presetReason, setPresetReason] = useState(REASONS[0]);

  const fetchContent = useCallback(() => {
    setLoading(true);
    api.get('/forum/admin/flagged/')
      .then(r => setContent(r.data))
      .catch(() => setContent({ flagged_posts: [], flagged_replies: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const openDeleteDialog = (type, item) => {
    setDialog({ type, item });
    setPresetReason(REASONS[0]);
    setReason('');
    setError('');
  };

  const closeDialog = () => {
    if (!submitting) {
      setDialog(null);
      setReason('');
      setError('');
    }
  };

  const handleDelete = async () => {
    if (!dialog) return;
    const final = presetReason === REASONS[REASONS.length - 1]
      ? reason.trim()
      : presetReason;

    if (!final) {
      setError('Please provide a reason.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const url = dialog.type === 'post'
        ? `/forum/admin/posts/${dialog.item.id}/delete/`
        : `/forum/admin/replies/${dialog.item.id}/delete/`;
      await api.delete(url, { data: { reason: final } });
      setSnackbar(`${dialog.type === 'post' ? 'Post' : 'Reply'} removed. Author notified.`);
      setDialog(null);
      fetchContent();
      if (onChange) onChange();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  const posts = content.flagged_posts || [];
  const replies = content.flagged_replies || [];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Forum Moderation</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review flagged content. Removed content is soft-deleted and the author is notified with the reason.
      </Typography>

      <Tabs value={subtab} onChange={(_, v) => setSubtab(v)} sx={{ mb: 2 }}>
        <Tab icon={<Article sx={{ fontSize: 18 }} />} iconPosition="start"
             label={`Posts (${posts.length})`} />
        <Tab icon={<ChatBubble sx={{ fontSize: 18 }} />} iconPosition="start"
             label={`Replies (${replies.length})`} />
      </Tabs>

      {/* Posts tab */}
      {subtab === 0 && (
        <>
          {posts.length === 0 ? (
            <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No flagged posts.</Typography>
            </CardContent></Card>
          ) : (
            <Stack spacing={2}>
              {posts.map(p => (
                <Card key={p.id} sx={{ borderLeft: '4px solid', borderColor: p.is_deleted ? 'text.disabled' : 'error.main' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <Flag color="error" sx={{ fontSize: 20, mt: 0.5 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h5" sx={{ mb: 0.5 }}>{p.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          By {p.author_name} • {p.category} • {new Date(p.created_at).toLocaleString('en-GB')}
                        </Typography>
                      </Box>
                      {p.is_deleted && <Chip label="Deleted" size="small" />}
                    </Box>
                    {p.flag_reason && (
                      <Alert severity="warning" sx={{ mb: 1.5 }}>
                        <strong>Flag reason:</strong> {p.flag_reason}
                      </Alert>
                    )}
                    <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                      {p.content_preview}
                      {p.content_preview.length >= 200 && '...'}
                    </Typography>
                    {!p.is_deleted && (
                      <Button variant="contained" color="error" startIcon={<Delete />} size="small"
                              onClick={() => openDeleteDialog('post', p)}>
                        Remove Post
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}

      {/* Replies tab */}
      {subtab === 1 && (
        <>
          {replies.length === 0 ? (
            <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No flagged replies.</Typography>
            </CardContent></Card>
          ) : (
            <Stack spacing={2}>
              {replies.map(r => (
                <Card key={r.id} sx={{ borderLeft: '4px solid', borderColor: r.is_deleted ? 'text.disabled' : 'error.main' }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Reply to: "{r.post_title}"
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      By {r.author_name} • {new Date(r.created_at).toLocaleString('en-GB')}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                      {r.content_preview}
                    </Typography>
                    {!r.is_deleted && (
                      <Button variant="contained" color="error" startIcon={<Delete />} size="small"
                              onClick={() => openDeleteDialog('reply', r)}>
                        Remove Reply
                      </Button>
                    )}
                    {r.is_deleted && <Chip label="Deleted" size="small" />}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!dialog} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Remove {dialog?.type === 'post' ? 'Post' : 'Reply'}
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Typography variant="body2" sx={{ mb: 2 }}>
            The author will receive a notification explaining why their content was removed.
          </Typography>

          <Typography variant="body2" sx={{ mb: 1 }}>Reason</Typography>
          <Select
            fullWidth size="small"
            value={presetReason}
            onChange={(e) => setPresetReason(e.target.value)}
            sx={{ mb: 2 }}
          >
            {REASONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>

          {presetReason === REASONS[REASONS.length - 1] && (
            <TextField
              fullWidth multiline rows={3}
              label="Custom reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={submitting}>
            {submitting ? 'Removing...' : 'Remove'}
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
