import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Container, Typography, Grid, Card, CardContent, Button, Box, Chip, Stack, Avatar } from '@mui/material';
import { CalendarMonth, Forum, SmartToy, AccessTime, Search, Edit, Chat } from '@mui/icons-material';

/**
 * Student Dashboard.
 *
 * Update 6 fixes:
 *  - Forum Posts and AI Chats stats were hardcoded as '—'. Now fetched from
 *    /auth/dashboard-stats/student/ and refreshed on every navigation back
 *    to this page (via location.key) plus on window focus.
 *  - Upcoming Sessions now uses the same active booking statuses as the
 *    Bookings page, matching the backend stats view.
 */
export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({
    upcoming_sessions: 0,
    forum_posts: 0,
    ai_chats: 0,
    hours_tutored: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/tutoring/bookings/').then(r => setBookings(r.data.results || r.data || [])).catch(() => {}),
      api.get('/auth/dashboard-stats/student/').then(r => setStats(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // Refresh on navigation back to this page
  useEffect(() => {
    fetchAll();
  }, [location.key, fetchAll]);

  // Refresh on window focus (user returns from another tab)
  useEffect(() => {
    const onFocus = () => fetchAll();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchAll]);

  const activeBookingStatuses = ['confirmed', 'pending', 'pending_payment', 'change_requested'];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings
    .filter(b => activeBookingStatuses.includes(b.status) && (!b.slot_date || b.slot_date >= today))
    .sort((a, b) => `${a.slot_date || ''} ${a.slot_start || ''}`.localeCompare(`${b.slot_date || ''} ${b.slot_start || ''}`));

  const statusColor = (status) => {
    if (status === 'confirmed') return 'success';
    if (status === 'pending' || status === 'pending_payment' || status === 'change_requested') return 'warning';
    return 'default';
  };

  const statusLabel = (status) => {
    if (status === 'pending_payment') return 'Payment pending';
    if (status === 'change_requested') return 'Change requested';
    return status;
  };

  const statCards = [
    {
      label: 'Upcoming Sessions',
      value: stats.upcoming_sessions,
      icon: <CalendarMonth />,
      color: 'primary.main',
    },
    {
      label: 'Forum Posts',
      value: stats.forum_posts,
      icon: <Forum />,
      color: 'info.main',
    },
    {
      label: 'AI Chats',
      value: stats.ai_chats,
      icon: <SmartToy />,
      color: 'success.main',
    },
    {
      label: 'Hours Tutored',
      value: stats.hours_tutored,
      icon: <AccessTime />,
      color: 'secondary.main',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 1 }}>
        Welcome back, {user?.first_name || user?.display_name}!
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here is your StudySpace overview.
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map(s => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Box sx={{ color: s.color, mb: 1 }}>{s.icon}</Box>
                <Typography variant="h3">{s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h4" sx={{ mb: 2 }}>Quick Actions</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => navigate('/tutors')}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Search sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h5">Find a Tutor</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => navigate('/forum')}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Edit sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h5">Post in Forum</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => navigate('/ai-assistant')}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Chat sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h5">Ask AI Assistant</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h4" sx={{ mb: 2 }}>Upcoming Sessions</Typography>
      {upcoming.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              No upcoming sessions.{' '}
              <Button onClick={() => navigate('/tutors')}>Find a tutor</Button>
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {upcoming.slice(0, 3).map(b => (
            <Card key={b.id}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar src={b.tutor_avatar || undefined} sx={{ bgcolor: 'primary.main' }}>
                  {b.tutor_name?.[0]}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5">{b.tutor_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {b.subject} — {b.slot_date} at {b.slot_start}
                  </Typography>
                </Box>
                <Chip
                  label={statusLabel(b.status)}
                  color={statusColor(b.status)}
                  size="small"
                  sx={{ textTransform: 'capitalize' }}
                />
                <Button variant="contained" size="small" onClick={() => navigate('/bookings')}>
                  View Booking
                </Button>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
