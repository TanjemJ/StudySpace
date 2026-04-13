import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Container, Typography, Card, CardContent, Box, Chip, Stack, Avatar, Button, Tabs, Tab } from '@mui/material';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    api.get('/tutoring/bookings/').then(r => setBookings(r.data.results || r.data || []));
  }, []);

  const statuses = ['confirmed', 'completed', 'cancelled'];
  const filtered = bookings.filter(b => b.status === statuses[tab]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 3 }}>My Bookings</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Upcoming" />
        <Tab label="Past" />
        <Tab label="Cancelled" />
      </Tabs>
      <Stack spacing={2}>
        {filtered.map(b => (
          <Card key={b.id}><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>{(b.tutor_name || b.student_name)?.[0]}</Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5">{b.tutor_name || b.student_name}</Typography>
              <Typography variant="body2" color="text.secondary">{b.subject} — {b.slot_date} at {b.slot_start}</Typography>
            </Box>
            <Chip label={b.status} color={b.status === 'confirmed' ? 'success' : b.status === 'completed' ? 'info' : 'default'} size="small" />
            <Typography variant="h5" color="primary">£{b.price}</Typography>
          </CardContent></Card>
        ))}
        {filtered.length === 0 && <Card><CardContent><Typography color="text.secondary">No bookings in this category.</Typography></CardContent></Card>}
      </Stack>
    </Container>
  );
}
