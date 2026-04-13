import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Card, CardContent, TextField, Button, MenuItem,
  Checkbox, FormControlLabel, Stack, Box, Chip, Alert, Divider, InputAdornment,
} from '@mui/material';
import { ArrowBack, Send, Lock, School, Tag } from '@mui/icons-material';

export default function CreatePost() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [catId, setCatId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const userUniversity = user?.student_profile?.university || '';

  useEffect(() => {
    api.get('/forum/categories/').then(r => setCategories(r.data.results || r.data || []));
  }, []);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async () => {
    if (!catId || !title.trim() || !content.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/forum/posts/create/', {
        category_id: catId,
        title: title.trim(),
        content: content.trim(),
        is_anonymous: anonymous,
        tags,
      });
      if (res.data.message && res.data.message.includes('review')) {
        // Post was auto-flagged
        navigate('/forum');
      } else {
        navigate('/forum/post/' + res.data.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === catId);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '80vh' }}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/forum')} sx={{ mb: 2 }}>
          Back to Forum
        </Button>

        <Typography variant="h2" sx={{ mb: 3 }}>Create New Post</Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Card>
          <CardContent sx={{ p: 3 }}>
            {/* Category selection */}
            <TextField
              fullWidth select label="Category" value={catId}
              onChange={(e) => setCatId(e.target.value)} sx={{ mb: 2 }} required
              helperText="Choose the most relevant category for your post."
            >
              <MenuItem value="" disabled>Select a category...</MenuItem>
              <MenuItem disabled><Typography variant="caption" color="text.secondary" fontWeight={600}>GLOBAL CATEGORIES</Typography></MenuItem>
              {categories.filter(c => !c.university).map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
              {categories.filter(c => c.university).length > 0 && (
                <MenuItem disabled><Typography variant="caption" color="text.secondary" fontWeight={600}>UNIVERSITY FORUMS</Typography></MenuItem>
              )}
              {categories.filter(c => c.university).map(c => (
                <MenuItem key={c.id} value={c.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {c.is_university_only ? <Lock sx={{ fontSize: 16, color: 'text.secondary' }} /> : <School sx={{ fontSize: 16, color: 'primary.main' }} />}
                    {c.name}
                  </Box>
                </MenuItem>
              ))}
            </TextField>

            {/* University-only warning */}
            {selectedCategory?.is_university_only && selectedCategory?.university !== userUniversity && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This category is restricted to {selectedCategory.university} students. You may not be able to post here without verification.
              </Alert>
            )}

            {/* Title */}
            <TextField
              fullWidth label="Title" value={title}
              onChange={(e) => setTitle(e.target.value)} sx={{ mb: 2 }} required
              placeholder="What's your question or topic?"
              inputProps={{ maxLength: 200 }}
              helperText={`${title.length}/200 characters`}
            />

            {/* Content */}
            <TextField
              fullWidth label="Content" multiline rows={8} value={content}
              onChange={(e) => setContent(e.target.value)} sx={{ mb: 2 }} required
              placeholder="Describe your question, share your thoughts, or start a discussion. Be as detailed as possible to get the best responses."
              inputProps={{ maxLength: 10000 }}
              helperText={`${content.length}/10000 characters`}
            />

            <Divider sx={{ my: 2 }} />

            {/* Tags */}
            <Typography variant="h6" sx={{ mb: 1 }}>Tags (optional)</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small" placeholder="Add a tag..." value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                sx={{ flex: 1 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Tag sx={{ fontSize: 18 }} /></InputAdornment> }}
                disabled={tags.length >= 5}
              />
              <Button variant="outlined" size="small" onClick={addTag} disabled={!tagInput.trim() || tags.length >= 5}>
                Add
              </Button>
            </Box>
            {tags.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                {tags.map(tag => (
                  <Chip key={tag} label={`#${tag}`} size="small" onDelete={() => removeTag(tag)}
                    sx={{ bgcolor: '#F0FDF4', color: 'primary.main' }} />
                ))}
              </Stack>
            )}
            <Typography variant="caption" color="text.secondary">
              Add up to 5 tags to help others find your post. Press Enter or click Add.
            </Typography>

            <Divider sx={{ my: 2 }} />

            {/* Options */}
            <FormControlLabel
              control={<Checkbox checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />}
              label={
                <Box>
                  <Typography variant="body2">Post anonymously</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Your name will be hidden from other users. You can still receive replies.
                  </Typography>
                </Box>
              }
              sx={{ mb: 3, alignItems: 'flex-start' }}
            />

            {/* Submit */}
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained" size="large" startIcon={<Send />}
                onClick={handleSubmit}
                disabled={!catId || !title.trim() || !content.trim() || loading}
              >
                {loading ? 'Publishing...' : 'Publish Post'}
              </Button>
              <Button variant="outlined" size="large" onClick={() => navigate('/forum')}>
                Cancel
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
