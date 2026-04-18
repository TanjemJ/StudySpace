import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import ReplyCard from '../components/forum/ReplyCard';
import ReportDialog from '../components/forum/ReportDialog';
import {
  Container, Typography, Card, CardContent, Box, Avatar, Button, TextField,
  Stack, Chip, Checkbox, FormControlLabel, IconButton, Divider, Breadcrumbs,
  Link, Paper, Tooltip, Menu, MenuItem, Alert,
} from '@mui/material';
import {
  ThumbUp, ThumbDown, School, PushPin, Flag, ChatBubble,
  Schedule, MoreVert, Edit,
} from '@mui/icons-material';


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

function uniShort(uni) {
  if (!uni) return null;
  if (uni.includes('South Bank')) return 'LSBU';
  if (uni.includes('Kings')) return 'KCL';
  if (uni.includes('College London')) return 'UCL';
  if (uni.includes('Imperial')) return 'Imperial';
  if (uni.includes('Queen')) return 'QMUL';
  return uni.substring(0, 12);
}

export default function ForumThread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);

  // Post editing
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // Menus
  const [postMenuEl, setPostMenuEl] = useState(null);
  const [postReportOpen, setPostReportOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAll = () => {
    api.get('/forum/posts/' + id + '/').then(r => {
      setPost(r.data);
      setEditTitle(r.data.title);
      setEditContent(r.data.content);
    });
    api.get('/forum/posts/' + id + '/replies/').then(r => setReplies(r.data.results || r.data || []));
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleVote = async (type) => {
    if (!user) { navigate('/login'); return; }
    try {
      const res = await api.post('/forum/posts/' + id + '/vote/', { vote_type: type });
      setPost(prev => ({ ...prev, upvotes: res.data.upvotes, downvotes: res.data.downvotes, user_vote: res.data.user_vote }));
    } catch {}
  };

  const handlePostReply = async () => {
    if (!replyText.trim() || posting) return;
    setPosting(true);
    try {
      await api.post('/forum/posts/' + id + '/replies/', { content: replyText, is_anonymous: anonymous });
      setReplyText(''); setAnonymous(false);
      fetchAll();
      setSuccess('Reply posted.');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Failed to post reply.'); }
    setPosting(false);
  };

  const handleSavePostEdit = async () => {
    try {
      await api.patch(`/forum/posts/${id}/edit/`, { title: editTitle, content: editContent });
      setEditingPost(false);
      fetchAll();
      setSuccess('Post updated.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to edit post.');
    }
  };

  const handleAuthorClick = () => {
    if (!post.is_anonymous && post.author_id) {
      navigate(`/users/${post.author_id}`);
    }
  };

  if (!post) return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;

  const isOwnPost = user && post.author_id === user.id;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '80vh' }}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Breadcrumb */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link underline="hover" color="inherit" onClick={() => navigate('/forum')} sx={{ cursor: 'pointer' }}>
            Forum
          </Link>
          {post.category_name && (
            <Link underline="hover" color="inherit" onClick={() => navigate('/forum')} sx={{ cursor: 'pointer' }}>
              {post.category_name}
            </Link>
          )}
          <Typography color="text.primary" noWrap sx={{ maxWidth: 300 }}>{post.title}</Typography>
        </Breadcrumbs>

        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {/* Post card */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            {/* Badges */}
            <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              {post.is_pinned && (
                <Chip icon={<PushPin sx={{ fontSize: 14 }} />} label="Pinned" size="small"
                  sx={{ bgcolor: 'primary.light', color: 'white' }} />
              )}
              <Chip label={post.category_name || 'General'} size="small" variant="outlined" />
              {post.university && (
                <Chip icon={<School sx={{ fontSize: 14 }} />} label={uniShort(post.university)}
                  size="small" color="success" variant="outlined" />
              )}
            </Stack>

            {/* Title — editable */}
            {editingPost ? (
              <TextField
                fullWidth value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                sx={{ mb: 2 }} inputProps={{ maxLength: 200 }}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h2" sx={{ fontSize: { xs: '24px', md: '31px' }, flex: 1 }}>
                  {post.title}
                  {post.is_edited && (
                    <Tooltip title={`Edited ${timeAgo(post.edited_at)}`}>
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontStyle: 'italic' }}>
                        (edited)
                      </Typography>
                    </Tooltip>
                  )}
                </Typography>
                {user && (
                  <IconButton size="small" onClick={(e) => setPostMenuEl(e.currentTarget)}>
                    <MoreVert />
                  </IconButton>
                )}
                <Menu anchorEl={postMenuEl} open={Boolean(postMenuEl)} onClose={() => setPostMenuEl(null)}>
                  {isOwnPost && post.can_edit && (
                    <MenuItem onClick={() => { setEditingPost(true); setPostMenuEl(null); }}>
                      <Edit sx={{ mr: 1, fontSize: 18 }} /> Edit post
                    </MenuItem>
                  )}
                  {isOwnPost && !post.can_edit && (
                    <MenuItem disabled>
                      <Edit sx={{ mr: 1, fontSize: 18 }} />
                      <Box>
                        <Typography variant="body2">Edit post</Typography>
                        <Typography variant="caption" color="text.secondary">24h window passed</Typography>
                      </Box>
                    </MenuItem>
                  )}
                  {!isOwnPost && (
                    <MenuItem onClick={() => { setPostReportOpen(true); setPostMenuEl(null); }}>
                      <Flag sx={{ mr: 1, fontSize: 18 }} /> Report post
                    </MenuItem>
                  )}
                </Menu>
              </Box>
            )}

            {/* Author */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Avatar
                src={post.author_avatar || undefined}
                onClick={handleAuthorClick}
                sx={{
                  bgcolor: post.is_anonymous ? 'grey.400' : 'primary.main',
                  width: 40, height: 40,
                  cursor: post.is_anonymous ? 'default' : 'pointer',
                }}
              >
                {post.is_anonymous ? '?' : post.author_name?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography
                  variant="body2" fontWeight={500}
                  onClick={handleAuthorClick}
                  sx={{ cursor: post.is_anonymous ? 'default' : 'pointer',
                        '&:hover': { textDecoration: post.is_anonymous ? 'none' : 'underline' } }}
                >
                  {post.author_name}
                  {post.author_role === 'tutor' && (
                    <Chip label="Tutor" size="small" color="primary" variant="outlined"
                      sx={{ ml: 1, height: 18, fontSize: 10 }} />
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  <Schedule sx={{ fontSize: 12, mr: 0.3, verticalAlign: 'middle' }} />
                  {timeAgo(post.created_at)}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Content */}
            {editingPost ? (
              <>
                <TextField
                  fullWidth multiline rows={8} value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Button variant="contained" onClick={handleSavePostEdit}>Save changes</Button>
                  <Button onClick={() => { setEditingPost(false); setEditTitle(post.title); setEditContent(post.content); }}>
                    Cancel
                  </Button>
                </Stack>
              </>
            ) : (
              <Typography sx={{ mb: 2, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{post.content}</Typography>
            )}

            {/* Tags */}
            {!editingPost && post.tags && post.tags.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
                {post.tags.map(tag => (
                  <Chip key={tag} label={`#${tag}`} size="small"
                    sx={{ bgcolor: '#F0FDF4', color: 'primary.main' }} />
                ))}
              </Stack>
            )}

            <Divider sx={{ mb: 1.5 }} />

            {/* Vote bar */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="Upvote">
                <IconButton size="small" onClick={() => handleVote('up')}
                  sx={{ color: post.user_vote === 'up' ? 'primary.main' : 'text.secondary' }}>
                  <ThumbUp fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography variant="body2" fontWeight={600} color={post.user_vote === 'up' ? 'primary.main' : 'text.secondary'}>
                {post.upvotes}
              </Typography>

              <Tooltip title="Downvote">
                <IconButton size="small" onClick={() => handleVote('down')}
                  sx={{ color: post.user_vote === 'down' ? 'error.main' : 'text.secondary' }}>
                  <ThumbDown fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography variant="body2" color="text.secondary">{post.downvotes}</Typography>

              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <ChatBubble sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">{post.reply_count} replies</Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Replies */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h4">Replies</Typography>
          <Chip label={replies.length} size="small" color="primary" />
        </Box>

        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {replies.map(r => (
            <ReplyCard key={r.id} reply={r} onRefresh={fetchAll} postId={id} depth={0} />
          ))}
          {replies.length === 0 && (
            <Paper sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No replies yet. Be the first to share your thoughts!</Typography>
            </Paper>
          )}
        </Stack>

        {/* New reply input */}
        {user ? (
          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 1.5 }}>Write a Reply</Typography>
              <TextField
                fullWidth multiline rows={4}
                placeholder="Share your thoughts, experience, or advice..."
                value={replyText} onChange={(e) => setReplyText(e.target.value)}
                sx={{ mb: 1.5 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <FormControlLabel
                  control={<Checkbox checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">Post anonymously</Typography>}
                />
                <Button variant="contained" onClick={handlePostReply}
                  disabled={!replyText.trim() || posting}>
                  {posting ? 'Posting...' : 'Submit Reply'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>Log in to reply to this post.</Typography>
              <Button variant="contained" onClick={() => navigate('/login')}>Log In</Button>
            </CardContent>
          </Card>
        )}

        <ReportDialog
          open={postReportOpen} onClose={() => setPostReportOpen(false)}
          targetType="post" targetId={id}
        />
      </Container>
    </Box>
  );
}
