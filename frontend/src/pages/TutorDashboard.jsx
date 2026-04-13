import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Container, Typography, Grid, Card, CardContent, Box, Chip, Stack, Avatar, Button, Alert } from '@mui/material';
import { CalendarMonth, Payments, Star, People } from '@mui/icons-material';

export default function TutorDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    api.get('/tutoring/bookings/').then(r => setBookings(r.data.results || r.data || [])).catch(() => {});
  }, []);

  const pending = bookings.filter(b => b.status === 'pending');
  const confirmed = bookings.filter(b => b.status === 'confirmed');

  const stats = [
    { label: 'Upcoming Sessions', value: confirmed.length, icon: <CalendarMonth />, color: 'primary.main' },
    { label: 'Total Earnings', value: '£—', icon: <Payments />, color: 'secondary.main' },
    { label: 'Average Rating', value: '4.8', icon: <Star />, color: 'warning.main' },
    { label: 'Total Students', value: bookings.length, icon: <People />, color: 'info.main' },
  ];

  const handleAction = async (id, action) => {
    await api.post("/tutoring/bookings/" + id + "/" + action + "/");
    const res = await api.get('/tutoring/bookings/');
    setBookings(res.data.results || res.data || []);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 1 }}>Welcome back, {user?.first_name}!</Typography>
      <Alert severity="success" icon={false} sx={{ mb: 3 }}>Verification Status: <strong>Approved</strong></Alert>

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

      {pending.length > 0 && (
        <>
          <Typography variant="h4" sx={{ mb: 2 }}>Pending Booking Requests</Typography>
          <Stack spacing={2} sx={{ mb: 4 }}>
            {pending.map(b => (
              <Card key={b.id}><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main' }}>{b.student_name?.[0]}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5">{b.student_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{b.subject} — {b.slot_date} at {b.slot_start}</Typography>
                </Box>
                <Button variant="contained" size="small" onClick={() => handleAction(b.id, 'accept')}>Accept</Button>
                <Button variant="outlined" size="small" color="error" onClick={() => handleAction(b.id, 'cancel')}>Decline</Button>
              </CardContent></Card>
            ))}
          </Stack>
        </>
      )}
    </Container>
  );
}
