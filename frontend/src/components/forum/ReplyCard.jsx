import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import {
  Card, CardContent, Box, Typography, Avatar, IconButton, Button, TextField,
  Stack, Chip, Collapse, Tooltip, Menu, MenuItem, FormControlLabel, Checkbox,
  Alert,
} from '@mui/material';
import {
  ThumbUp, ThumbDown, Reply, Flag, Edit, MoreVert,
  ExpandLess, ExpandMore, School,
} from '@mui/icons-material';
import ReportDialog from './ReportDialog';


function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}


export default function ReplyCard({ reply, onRefresh, postId, depth = 0 }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [userVote, setUserVote] = useState(reply.user_vote || null);
  const [upvotes, setUpvotes] = useState(reply.upvotes);
  const [downvotes, setDownvotes] = useState(reply.downvotes);

  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyAnon, setReplyAnon] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [expanded, setExpanded] = useState(true);
  const [menuEl, setMenuEl] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState('');

  const children = reply.children || [];
  const isOwn = user && reply.author_id === user.id;

  const handleVote = async (type) => {
    if (!user) { navigate('/login'); return; }
    try {
      const res = await api.post(`/forum/replies/${reply.id}/vote/`, { vote_type: type });
      setUpvotes(res.data.upvotes);
      setDownvotes(res.data.downvotes);
      setUserVote(res.data.user_vote);
    } catch {}
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      await api.post(`/forum/posts/${postId}/replies/`, {
        content: replyText, is_anonymous: replyAnon, parent_id: reply.id,
      });
      setReplyText(''); setReplyAnon(false); setReplying(false);
      if (onRefresh) onRefresh();
    } catch { setError('Failed to post reply.'); }
    setSubmittingReply(false);
  };

  const handleSubmitEdit = async () => {
    if (!editText.trim() || submittingEdit) return;
    setSubmittingEdit(true);
    try {
      await api.patch(`/forum/replies/${reply.id}/edit/`, { content: editText });
      setEditing(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to edit.');
    }
    setSubmittingEdit(false);
  };

  const handleAuthorClick = () => {
    if (!reply.is_anonymous && reply.author_id) {
      navigate(`/users/${reply.author_id}`);
    }
  };

  // Depth 0 = top-level reply, 1 = nested (reply to reply)
  // Only top-level replies can be replied to (prevents deep nesting)
  const canReply = depth === 0 && user;

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {/* Left collapse rail */}
        {children.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton size="small" onClick={() => setExpanded(!expanded)}
              sx={{ mt: 0.5 }}
            >
              {expanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
            </IconButton>
            {expanded && (
              <Box sx={{
                width: 2, flex: 1, bgcolor: 'divider',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'primary.light' },
              }}
                onClick={() => setExpanded(false)}
              />
            )}
          </Box>
        )}

        <Card variant="outlined" sx={{ flex: 1, borderColor: depth > 0 ? 'primary.light' : 'divider' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}

            {/* Header */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Avatar
                src={reply.author_avatar || undefined}
                onClick={handleAuthorClick}
                sx={{
                  width: 32, height: 32, fontSize: 14,
                  bgcolor: reply.is_anonymous ? 'grey.400' : 'info.main',
                  cursor: reply.is_anonymous ? 'default' : 'pointer',
                }}
              >
                {reply.is_anonymous ? '?' : reply.author_name?.[0]?.toUpperCase()}
              </Avatar>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography
                    variant="body2" fontWeight={500}
                    onClick={handleAuthorClick}
                    sx={{ cursor: reply.is_anonymous ? 'default' : 'pointer',
                          '&:hover': { textDecoration: reply.is_anonymous ? 'none' : 'underline' } }}
                  >
                    {reply.author_name}
                  </Typography>
                  {reply.author_role === 'tutor' && (
                    <Chip label="Tutor" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {timeAgo(reply.created_at)}
                  </Typography>
                  {reply.is_edited && (
                    <Tooltip title={`Edited ${timeAgo(reply.edited_at)}`}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        (edited)
                      </Typography>
                    </Tooltip>
                  )}
                </Box>

                {/* Content or edit field */}
                {editing ? (
                  <Box sx={{ mt: 1 }}>
                    <TextField
                      fullWidth multiline rows={3} value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      size="small"
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button size="small" variant="contained" onClick={handleSubmitEdit}
                        disabled={submittingEdit || !editText.trim()}>
                        {submittingEdit ? 'Saving...' : 'Save'}
                      </Button>
                      <Button size="small" onClick={() => { setEditing(false); setEditText(reply.content); }}>
                        Cancel
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ lineHeight: 1.6, mt: 0.5, whiteSpace: 'pre-wrap' }}>
                    {reply.content}
                  </Typography>
                )}

                {/* Actions */}
                {!editing && (
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                    <Tooltip title="Upvote">
                      <IconButton size="small" onClick={() => handleVote('up')}
                        sx={{ color: userVote === 'up' ? 'primary.main' : 'text.secondary' }}>
                        <ThumbUp sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Typography variant="caption" fontWeight={userVote ? 600 : 400}>{upvotes}</Typography>

                    <Tooltip title="Downvote">
                      <IconButton size="small" onClick={() => handleVote('down')}
                        sx={{ color: userVote === 'down' ? 'error.main' : 'text.secondary' }}>
                        <ThumbDown sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Typography variant="caption" fontWeight={userVote ? 600 : 400}>{downvotes}</Typography>

                    {canReply && (
                      <Button size="small" startIcon={<Reply sx={{ fontSize: 14 }} />}
                        onClick={() => setReplying(!replying)}
                        sx={{ ml: 0.5, minWidth: 'auto', textTransform: 'none', fontSize: 12 }}>
                        Reply
                      </Button>
                    )}

                    {children.length > 0 && !expanded && (
                      <Button size="small" onClick={() => setExpanded(true)}
                        sx={{ ml: 0.5, minWidth: 'auto', textTransform: 'none', fontSize: 12 }}>
                        Show {children.length} {children.length === 1 ? 'reply' : 'replies'}
                      </Button>
                    )}

                    {/* More menu */}
                    {user && (
                      <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} sx={{ ml: 'auto' }}>
                        <MoreVert sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                    <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
                      {isOwn && reply.can_edit && (
                        <MenuItem onClick={() => { setEditing(true); setMenuEl(null); }}>
                          <Edit sx={{ mr: 1, fontSize: 16 }} /> Edit
                        </MenuItem>
                      )}
                      {isOwn && !reply.can_edit && (
                        <MenuItem disabled>
                          <Edit sx={{ mr: 1, fontSize: 16 }} />
                          <Box>
                            <Typography variant="body2">Edit</Typography>
                            <Typography variant="caption" color="text.secondary">24h window passed</Typography>
                          </Box>
                        </MenuItem>
                      )}
                      {!isOwn && (
                        <MenuItem onClick={() => { setReportOpen(true); setMenuEl(null); }}>
                          <Flag sx={{ mr: 1, fontSize: 16 }} /> Report
                        </MenuItem>
                      )}
                    </Menu>
                  </Stack>
                )}

                {/* Reply input */}
                <Collapse in={replying}>
                  <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <TextField
                      fullWidth multiline rows={2} size="small"
                      placeholder={`Reply to ${reply.author_name}...`}
                      value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <FormControlLabel
                        control={<Checkbox size="small" checked={replyAnon} onChange={(e) => setReplyAnon(e.target.checked)} />}
                        label={<Typography variant="caption">Anonymous</Typography>}
                      />
                      <Box>
                        <Button size="small" onClick={() => { setReplying(false); setReplyText(''); }}>Cancel</Button>
                        <Button size="small" variant="contained" onClick={handleSubmitReply}
                          disabled={!replyText.trim() || submittingReply}>
                          {submittingReply ? 'Posting...' : 'Reply'}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Collapse>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Nested children */}
      {children.length > 0 && (
        <Collapse in={expanded}>
          <Box sx={{ ml: 4, mt: 1 }}>
            <Stack spacing={1.5}>
              {children.map(child => (
                <ReplyCard
                  key={child.id} reply={child} onRefresh={onRefresh}
                  postId={postId} depth={depth + 1}
                />
              ))}
            </Stack>
          </Box>
        </Collapse>
      )}

      <ReportDialog
        open={reportOpen} onClose={() => setReportOpen(false)}
        targetType="reply" targetId={reply.id}
      />
    </>
  );
}
