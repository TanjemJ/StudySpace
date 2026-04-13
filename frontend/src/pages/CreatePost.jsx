import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Container, Typography, Card, CardContent, TextField, Button, MenuItem, Checkbox, FormControlLabel, Stack } from '@mui/material';

export default function CreatePost() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [catId, setCatId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  useEffect(() => {
    api.get('/forum/categories/').then(r => setCategories(r.data.results || r.data || []));
  }, []);

  const handleSubmit = async () => {
    await api.post('/forum/posts/create/', { category_id: catId, title, content, is_anonymous: anonymous });
    navigate('/forum');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 3 }}>Create New Post</Typography>
      <Card><CardContent>
        <TextField fullWidth select label="Category" value={catId} onChange={(e) => setCatId(e.target.value)} sx={{ mb: 2 }} required>
          {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="Title" value={title} onChange={(e) => setTitle(e.target.value)} sx={{ mb: 2 }} required />
        <TextField fullWidth label="Content" multiline rows={6} value={content} onChange={(e) => setContent(e.target.value)} sx={{ mb: 2 }} required />
        <FormControlLabel control={<Checkbox checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />} label="Post anonymously" sx={{ mb: 2 }} />
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={handleSubmit} disabled={!catId || !title || !content}>Publish Post</Button>
          <Button variant="outlined" onClick={() => navigate('/forum')}>Cancel</Button>
        </Stack>
      </CardContent></Card>
    </Container>
  );
}
