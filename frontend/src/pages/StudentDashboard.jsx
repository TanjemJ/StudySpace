import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Container, Typography, Grid, Card, CardContent, Button, Box, Chip, Stack, Avatar } from '@mui/material';
import { CalendarMonth, Forum, SmartToy, AccessTime, Search, Edit, Chat } from '@mui/icons-material';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Refresh on every navigation to this page (not just on mount)
  useEffect(() => {
    setLoading(true);
    api.get('/tutoring/bookings/')
      .then(r => setBookings(r.data.results || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [location.key]);

  const upcoming = bookings.filter(b => b.status === 'confirmed');
  const stats = [
    { label: 'Upcoming Sessions', value: upcoming.length, icon: <CalendarMonth />, color: 'primary.main' },
    { label: 'Forum Posts', value: '—', icon: <Forum />, color: 'info.main' },
    { label: 'AI Chats', value: '—', icon: <SmartToy />, color: 'success.main' },
    { label: 'Hours Tutored', value: bookings.filter(b => b.status === 'completed').length, icon: <AccessTime />, color: 'secondary.main' },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 1 }}>Welcome back, {user?.first_name || user?.display_name}!</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>Here is your StudySpace overview.</Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map(s => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Box sx={{ color: s.color, mb: 1 }}>{s.icon}</Box>
              <Typography variant="h3">{s.value}</Typography>
              <Typography variant="body2" color="text.secondary">{s.label}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h4" sx={{ mb: 2 }}>Quick Actions</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => navigate('/tutors')}>
            <CardContent sx={{ textAlign: 'center' }}><Search sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} /><Typography variant="h5">Find a Tutor</Typography></CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => navigate('/forum')}>
            <CardContent sx={{ textAlign: 'center' }}><Edit sx={{ fontSize: 40, color: 'info.main', mb: 1 }} /><Typography variant="h5">Post in Forum</Typography></CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => navigate('/ai-assistant')}>
            <CardContent sx={{ textAlign: 'center' }}><Chat sx={{ fontSize: 40, color: 'success.main', mb: 1 }} /><Typography variant="h5">Ask AI Assistant</Typography></CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h4" sx={{ mb: 2 }}>Upcoming Sessions</Typography>
      {upcoming.length === 0 ? (
        <Card><CardContent><Typography color="text.secondary">No upcoming sessions. <Button onClick={() => navigate('/tutors')}>Find a tutor</Button></Typography></CardContent></Card>
      ) : (
        <Stack spacing={2}>
          {upcoming.slice(0, 3).map(b => (
            <Card key={b.id}><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar src={b.tutor_avatar || undefined} sx={{ bgcolor: 'primary.main' }}>{b.tutor_name?.[0]}</Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5">{b.tutor_name}</Typography>
                <Typography variant="body2" color="text.secondary">{b.subject} — {b.slot_date} at {b.slot_start}</Typography>
              </Box>
              <Chip label={b.status} color="success" size="small" />
              <Button variant="contained" size="small">Join Session</Button>
            </CardContent></Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
