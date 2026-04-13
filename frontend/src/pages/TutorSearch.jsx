import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Container, Typography, Grid, Card, CardContent, TextField, Box, Chip, Stack,
  Avatar, Button, Rating, InputAdornment,
} from '@mui/material';
import { Search, VerifiedUser } from '@mui/icons-material';

export default function TutorSearch() {
  const navigate = useNavigate();
  const [tutors, setTutors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTutors();
  }, []);

  const fetchTutors = (q = '') => {
    setLoading(true);
    api.get('/auth/tutors/', { params: { search: q } })
      .then(r => setTutors(r.data.results || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 1 }}>Find a Tutor</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Browse verified tutors by subject, price, and rating.</Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search by subject, name, or keyword..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchTutors(search)}
          sx={{ flex: 1, minWidth: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
        />
        <Button variant="contained" onClick={() => fetchTutors(search)}>Search</Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{tutors.length} tutors found</Typography>

      <Grid container spacing={3}>
        {tutors.map(t => (
          <Grid item xs={12} sm={6} md={4} key={t.user.id}>
            <Card sx={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }} onClick={() => navigate('/tutors/' + t.user.id)}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, fontSize: 24 }}>
                    {t.user.display_name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="h5" noWrap>{t.user.first_name} {t.user.last_name}</Typography>
                      {t.verification_status === 'approved' && <VerifiedUser sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />}
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap>@{t.user.display_name}</Typography>
                  </Box>
                </Box>

                {/* Fixed: flex-wrap with gap instead of spacing to prevent overflow */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                  {(t.subjects || []).slice(0, 4).map(s => (
                    <Chip key={s} label={s} size="small" variant="outlined" color="primary" sx={{ height: 24, fontSize: 12 }} />
                  ))}
                  {(t.subjects || []).length > 4 && (
                    <Chip label={`+${t.subjects.length - 4}`} size="small" sx={{ height: 24, fontSize: 12 }} />
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Rating value={t.average_rating} precision={0.1} size="small" readOnly />
                  <Typography variant="body2" color="text.secondary">({t.total_reviews})</Typography>
                </Box>

                <Typography variant="h4" color="primary">£{t.hourly_rate}/hr</Typography>

                <Typography variant="body2" color="text.secondary" sx={{
                  mt: 1, flex: 1,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {t.bio}
                </Typography>

                <Button variant="contained" fullWidth sx={{ mt: 2 }}>View Profile</Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {tutors.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h4" color="text.secondary">No tutors found</Typography>
          <Typography color="text.secondary">Try adjusting your search or filters.</Typography>
        </Box>
      )}
    </Container>
  );
}
