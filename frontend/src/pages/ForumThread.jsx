import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Card, CardContent, Box, Avatar, Button, TextField,
  Stack, Chip, Checkbox, FormControlLabel, IconButton, Divider, Breadcrumbs,
  Link, Alert, Paper, Tooltip,
} from '@mui/material';
import {
  ThumbUp, ThumbDown, ArrowBack, School, PushPin, Flag, ChatBubble,
  Schedule, Share,
} from '@mui/icons-material';

export default function ForumThread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    api.get('/forum/posts/' + id + '/').then(r => setPost(r.data));
    fetchReplies();
  }, [id]);

  const fetchReplies = () => {
    api.get('/forum/posts/' + id + '/replies/').then(r => setReplies(r.data.results || r.data || []));
  };

  const handleVote = async (type) => {
    if (!user) { navigate('/login'); return; }
    try {
      const res = await api.post('/forum/posts/' + id + '/vote/', { vote_type: type });
      setPost(prev => ({ ...prev, upvotes: res.data.upvotes, downvotes: res.data.downvotes }));
    } catch { }
  };

  const handleReply = async () => {
    if (!replyText.trim() || loading) return;
    setLoading(true);
    try {
      await api.post('/forum/posts/' + id + '/replies/', { content: replyText, is_anonymous: anonymous });
      setReplyText('');
      setAnonymous(false);
      fetchReplies();
    } catch { }
    setLoading(false);
  };

  const handleReport = async () => {
    try {
      await api.post('/forum/posts/' + id + '/report/', { reason: 'Inappropriate content' });
      setReported(true);
    } catch { }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!post) return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;

  const uniShort = post.university ?
    (post.university.includes('South Bank') ? 'LSBU' : post.university.includes('Kings') ? 'KCL' : post.university.includes('College London') ? 'UCL' : post.university.includes('Imperial') ? 'Imperial' : post.university.includes('Queen') ? 'QMUL' : post.university.substring(0, 12))
    : null;

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

        {/* Post card */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            {/* Meta badges */}
            <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              {post.is_pinned && (
                <Chip icon={<PushPin sx={{ fontSize: 14 }} />} label="Pinned" size="small"
                  sx={{ bgcolor: 'primary.light', color: 'white' }} />
              )}
              <Chip label={post.category_name || 'General'} size="small" variant="outlined" />
              {uniShort && (
                <Chip icon={<School sx={{ fontSize: 14 }} />} label={uniShort} size="small" color="success" variant="outlined" />
              )}
            </Stack>

            {/* Title */}
            <Typography variant="h2" sx={{ mb: 2, fontSize: { xs: '24px', md: '31px' } }}>{post.title}</Typography>

            {/* Author info */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Avatar sx={{ bgcolor: post.is_anonymous ? 'grey.400' : 'primary.main', width: 40, height: 40 }}>
                {post.is_anonymous ? '?' : post.author_name?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {post.author_name}
                  {post.author_university && !post.is_anonymous && (
                    <Typography component="span" variant="caption" color="text.secondary"> · {post.author_university}</Typography>
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
            <Typography sx={{ mb: 2, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{post.content}</Typography>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
                {post.tags.map(tag => (
                  <Chip key={tag} label={`#${tag}`} size="small"
                    sx={{ bgcolor: '#F0FDF4', color: 'primary.main', cursor: 'pointer' }}
                    onClick={() => navigate('/forum')} />
                ))}
              </Stack>
            )}

            <Divider sx={{ mb: 1.5 }} />

            {/* Action bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title="Upvote">
                  <IconButton size="small" onClick={() => handleVote('up')} color={post.upvotes > 0 ? 'primary' : 'default'}>
                    <ThumbUp fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography variant="body2" fontWeight={600} color="primary.main">{post.upvotes}</Typography>
                <Tooltip title="Downvote">
                  <IconButton size="small" onClick={() => handleVote('down')}>
                    <ThumbDown fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography variant="body2" color="text.secondary">{post.downvotes}</Typography>
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                <ChatBubble sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">{replies.length} replies</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5}>
                {user && !reported && (
                  <Tooltip title="Report this post">
                    <IconButton size="small" onClick={handleReport} color="default">
                      <Flag fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {reported && <Chip label="Reported" size="small" color="warning" />}
              </Stack>
            </Box>
          </CardContent>
        </Card>

        {/* Replies section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h4">Replies</Typography>
          <Chip label={replies.length} size="small" color="primary" />
        </Box>

        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {replies.map((r, index) => (
            <Card key={r.id} variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: r.is_anonymous ? 'grey.400' : 'info.main' }}>
                    {r.is_anonymous ? '?' : r.author_name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={500}>{r.author_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{timeAgo(r.created_at)}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{r.content}</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                      <IconButton size="small"><ThumbUp sx={{ fontSize: 14 }} /></IconButton>
                      <Typography variant="caption">{r.upvotes}</Typography>
                    </Stack>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}

          {replies.length === 0 && (
            <Paper sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No replies yet. Be the first to share your thoughts!</Typography>
            </Paper>
          )}
        </Stack>

        {/* Reply input */}
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
                <Button
                  variant="contained" onClick={handleReply}
                  disabled={!replyText.trim() || loading}
                >
                  {loading ? 'Posting...' : 'Submit Reply'}
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
      </Container>
    </Box>
  );
}
