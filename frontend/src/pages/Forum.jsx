import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Container, Typography, Grid, Card, CardContent, Button, Box, Chip, Stack, Tabs, Tab, Avatar } from '@mui/material';
import { Forum as ForumIcon, Add, ThumbUp, ChatBubble, PushPin } from '@mui/icons-material';

export default function Forum() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [sort, setSort] = useState('latest');

  useEffect(() => {
    api.get('/forum/categories/').then(r => setCategories(r.data.results || r.data || []));
    fetchPosts();
  }, []);

  const fetchPosts = (catId = null) => {
    const params = {};
    if (catId) params.category = catId;
    api.get('/forum/posts/', { params }).then(r => setPosts(r.data.results || r.data || []));
  };

  const selectCategory = (catId) => {
    setSelectedCat(catId === selectedCat ? null : catId);
    fetchPosts(catId === selectedCat ? null : catId);
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    return Math.floor(hrs / 24) + "d ago";
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h2">Community Forum</Typography>
          <Typography color="text.secondary">Ask questions, share tips, and connect with peers.</Typography>
        </Box>
        {user && <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/forum/new')}>New Post</Button>}
      </Box>

      {/* Categories */}
      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
        {categories.map(c => (
          <Chip key={c.id} label={c.name + " (" + (c.post_count || 0) + ")"}
            onClick={() => selectCategory(c.id)}
            color={selectedCat === c.id ? 'primary' : 'default'}
            variant={selectedCat === c.id ? 'filled' : 'outlined'} />
        ))}
      </Stack>

      {/* Posts */}
      <Stack spacing={2}>
        {posts.map(p => (
          <Card key={p.id} sx={{ cursor: 'pointer' }} onClick={() => navigate("/forum/post/" + p.id)}>
            <CardContent sx={{ display: 'flex', gap: 2 }}>
              <Avatar sx={{ bgcolor: p.is_anonymous ? 'grey.400' : 'primary.main' }}>
                {p.is_anonymous ? '?' : p.author_name?.[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {p.is_pinned && <PushPin sx={{ fontSize: 16, color: 'primary.main' }} />}
                  <Typography variant="h5">{p.title}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {p.content}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="caption" color="text.secondary">{p.author_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{timeAgo(p.created_at)}</Typography>
                  <Chip icon={<ThumbUp sx={{ fontSize: 14 }} />} label={p.upvotes} size="small" variant="outlined" />
                  <Chip icon={<ChatBubble sx={{ fontSize: 14 }} />} label={p.reply_count} size="small" variant="outlined" />
                </Stack>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
      {posts.length === 0 && <Box sx={{ textAlign: 'center', py: 6 }}><Typography color="text.secondary">No posts yet. Be the first to start a discussion!</Typography></Box>}
    </Container>
  );
}
