import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Container, Typography, Card, CardContent, Box, Avatar, Button, TextField, Stack, Chip, Checkbox, FormControlLabel, IconButton } from '@mui/material';
import { ThumbUp, ThumbDown } from '@mui/icons-material';

export default function ForumThread() {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  useEffect(() => {
    api.get("/forum/posts/" + id + "/").then(r => setPost(r.data));
    api.get("/forum/posts/" + id + "/replies/").then(r => setReplies(r.data.results || r.data || []));
  }, [id]);

  const handleVote = async (type) => {
    const res = await api.post("/forum/posts/" + id + "/vote/", { vote_type: type });
    setPost(prev => ({ ...prev, upvotes: res.data.upvotes, downvotes: res.data.downvotes }));
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    await api.post("/forum/posts/" + id + "/replies/", { content: replyText, is_anonymous: anonymous });
    setReplyText('');
    const r = await api.get("/forum/posts/" + id + "/replies/");
    setReplies(r.data.results || r.data || []);
  };

  if (!post) return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card sx={{ mb: 3 }}><CardContent>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: post.is_anonymous ? 'grey.400' : 'primary.main' }}>{post.is_anonymous ? '?' : post.author_name?.[0]}</Avatar>
          <Box>
            <Typography variant="body2" color="text.secondary">{post.author_name} — {new Date(post.created_at).toLocaleDateString()}</Typography>
          </Box>
        </Box>
        <Typography variant="h3" sx={{ mb: 2 }}>{post.title}</Typography>
        <Typography sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{post.content}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton size="small" onClick={() => handleVote('up')}><ThumbUp fontSize="small" /></IconButton>
          <Typography variant="body2">{post.upvotes}</Typography>
          <IconButton size="small" onClick={() => handleVote('down')}><ThumbDown fontSize="small" /></IconButton>
          <Typography variant="body2">{post.downvotes}</Typography>
        </Stack>
      </CardContent></Card>

      <Typography variant="h4" sx={{ mb: 2 }}>Replies ({replies.length})</Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        {replies.map(r => (
          <Card key={r.id} variant="outlined"><CardContent sx={{ display: 'flex', gap: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: r.is_anonymous ? 'grey.400' : 'info.main' }}>{r.is_anonymous ? '?' : r.author_name?.[0]}</Avatar>
            <Box>
              <Typography variant="body2" color="text.secondary">{r.author_name} — {new Date(r.created_at).toLocaleDateString()}</Typography>
              <Typography>{r.content}</Typography>
            </Box>
          </CardContent></Card>
        ))}
      </Stack>

      {user ? (
        <Card><CardContent>
          <TextField fullWidth multiline rows={3} placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} sx={{ mb: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <FormControlLabel control={<Checkbox checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} size="small" />} label="Post anonymously" />
            <Button variant="contained" onClick={handleReply} disabled={!replyText.trim()}>Submit Reply</Button>
          </Box>
        </CardContent></Card>
      ) : (
        <Card><CardContent><Typography color="text.secondary">Log in to reply to this post.</Typography></CardContent></Card>
      )}
    </Container>
  );
}
