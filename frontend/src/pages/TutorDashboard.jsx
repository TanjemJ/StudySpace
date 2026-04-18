import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Grid, Card, CardContent, Box, Chip, Stack, Avatar,
  Button, Alert, Divider, IconButton, Tooltip, Rating,
} from '@mui/material';
import {
  CalendarMonth, Payments, Star, People, CheckCircle, Close,
  AccessTime, VideoCall, Person as PersonIcon, Chat, TrendingUp,
} from '@mui/icons-material';


function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

export default function TutorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);

  const fetchData = () => {
    api.get('/tutoring/bookings/').then(r => setBookings(r.data.results || r.data || [])).catch(() => {});
    if (user?.id) {
      api.get(`/tutoring/reviews/${user.id}/`).then(r => setReviews(r.data.results || r.data || [])).catch(() => {});
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const pending = bookings.filter(b => b.status === 'pending');
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const completed = bookings.filter(b => b.status === 'completed');

  // Today's sessions (today's confirmed bookings)
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = confirmed.filter(b => b.slot_date === today);
  const upcomingConfirmed = confirmed
    .filter(b => b.slot_date >= today)
    .sort((a, b) => a.slot_date.localeCompare(b.slot_date))
    .slice(0, 5);

  // Earnings calculation
  const thisMonth = new Date();
  const currentMonthEarnings = completed.filter(b => {
    const d = new Date(b.slot_date);
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear();
  }).reduce((sum, b) => sum + parseFloat(b.price || 0), 0);

  // Weekly earnings — last 7 days
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const amount = completed
      .filter(b => b.slot_date === key)
      .reduce((sum, b) => sum + parseFloat(b.price || 0), 0);
    weeklyData.push({ day, amount });
  }
  const maxWeekly = Math.max(...weeklyData.map(d => d.amount), 1);

  const avgRating = user?.tutor_profile?.average_rating || 0;
  const totalReviews = user?.tutor_profile?.total_reviews || 0;
  const totalSessions = user?.tutor_profile?.total_sessions || 0;

  const stats = [
    {
      label: 'Earnings This Month',
      value: `£${currentMonthEarnings.toFixed(0)}`,
      icon: <Payments />, color: 'success.main',
      subtitle: completed.length + ' sessions completed',
    },
    {
      label: 'Sessions Completed',
      value: totalSessions,
      icon: <CheckCircle />, color: 'primary.main',
      subtitle: 'All time',
    },
    {
      label: 'Average Rating',
      value: avgRating > 0 ? avgRating.toFixed(1) : '—',
      icon: <Star />, color: 'warning.main',
      subtitle: `From ${totalReviews} reviews`,
    },
    {
      label: 'Pending Requests',
      value: pending.length,
      icon: <AccessTime />, color: 'info.main',
      subtitle: pending.length > 0 ? 'Action needed' : 'Nothing pending',
    },
  ];

  const handleAction = async (id, action) => {
    try {
      await api.post(`/tutoring/bookings/${id}/${action}/`);
      fetchData();
    } catch {}
  };

  const sessionIcon = (type) => {
    if (type === 'video') return <VideoCall sx={{ fontSize: 16, color: 'info.main' }} />;
    if (type === 'in_person') return <PersonIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
    return <Chat sx={{ fontSize: 16, color: 'primary.main' }} />;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h2">Welcome back, {user?.first_name}!</Typography>
          <Typography color="text.secondary">Here's what's happening with your tutoring today.</Typography>
        </Box>
      </Box>

      {user?.tutor_profile?.verification_status === 'approved' && (
        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 3 }}>
          Your tutor profile is <strong>approved and live</strong>. Students can find and book you.
        </Alert>
      )}

      {/* Stats cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map(s => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {s.label}
                  </Typography>
                  <Box sx={{ color: s.color }}>{s.icon}</Box>
                </Box>
                <Typography variant="h2" sx={{ fontSize: 32, fontWeight: 700, mb: 0.5 }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.subtitle}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* LEFT: Today's sessions + Weekly earnings */}
        <Grid item xs={12} md={7}>
          {/* Today's Sessions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Today's Sessions</Typography>
                <Chip label={`${todaySessions.length} today`} size="small" color="primary" variant="outlined" />
              </Box>
              {todaySessions.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography color="text.secondary">No sessions scheduled for today.</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {todaySessions.map(b => (
                    <Box key={b.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1.5, borderRadius: 1,
                      border: '1px solid', borderColor: 'divider',
                    }}>
                      <Avatar
                        src={b.student_avatar || undefined}
                        sx={{ bgcolor: 'info.main' }}
                      >
                        {b.student_first_name?.[0] || b.student_name?.[0]}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body1" fontWeight={500} noWrap>
                          {b.student_first_name} {b.student_last_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {b.subject} · {formatTime(b.slot_start)} – {formatTime(b.slot_end)}
                          {sessionIcon(b.session_type) && (
                            <Box component="span" sx={{ ml: 1, display: 'inline-flex', verticalAlign: 'middle' }}>
                              {sessionIcon(b.session_type)}
                            </Box>
                          )}
                        </Typography>
                      </Box>
                      <Chip label="Confirmed" size="small" color="success" sx={{ height: 22 }} />
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* Weekly earnings chart */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Weekly Earnings</Typography>
                <Chip icon={<TrendingUp sx={{ fontSize: 14 }} />} label={`£${weeklyData.reduce((s, d) => s + d.amount, 0).toFixed(0)}`}
                  size="small" color="success" variant="outlined" />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 1, pt: 2 }}>
                {weeklyData.map((d, i) => (
                  <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                      <Tooltip title={`£${d.amount.toFixed(0)}`}>
                        <Box sx={{
                          width: '80%', mx: 'auto',
                          height: `${Math.max((d.amount / maxWeekly) * 100, 4)}%`,
                          bgcolor: d.amount > 0 ? 'primary.main' : 'grey.200',
                          borderRadius: '4px 4px 0 0',
                          transition: 'all 300ms ease-out',
                          '&:hover': { bgcolor: 'primary.dark' },
                        }} />
                      </Tooltip>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{d.day}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Upcoming sessions */}
          {upcomingConfirmed.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 2 }}>Upcoming Sessions</Typography>
                <Stack spacing={1}>
                  {upcomingConfirmed.map(b => (
                    <Box key={b.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, py: 1,
                      borderBottom: '1px solid', borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                    }}>
                      <Avatar src={b.student_avatar || undefined} sx={{ bgcolor: 'info.main', width: 32, height: 32, fontSize: 14 }}>
                        {b.student_first_name?.[0]}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {b.student_first_name} {b.student_last_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {b.subject} · {formatDate(b.slot_date)} at {formatTime(b.slot_start)}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={600} color="primary">
                        £{b.price}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* RIGHT: Student Requests + Recent Reviews */}
        <Grid item xs={12} md={5}>
          {/* Student Requests */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Student Requests</Typography>
                {pending.length > 0 && (
                  <Chip label={`${pending.length} pending`} size="small" color="warning" />
                )}
              </Box>
              {pending.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography color="text.secondary" variant="body2">No pending requests right now.</Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {pending.map(b => (
                    <Box key={b.id} sx={{
                      p: 1.5, borderRadius: 1,
                      border: '1px solid', borderColor: 'divider',
                    }}>
                      <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                        <Avatar src={b.student_avatar || undefined} sx={{ bgcolor: 'info.main' }}>
                          {b.student_first_name?.[0]}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body1" fontWeight={500} noWrap>
                            {b.student_first_name} {b.student_last_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {b.subject}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(b.slot_date)} · {formatTime(b.slot_start)} – {formatTime(b.slot_end)}
                          </Typography>
                        </Box>
                      </Box>
                      {b.student_note && (
                        <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 0.5, mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            "{b.student_note}"
                          </Typography>
                        </Box>
                      )}
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" onClick={() => handleAction(b.id, 'accept')}>
                          Accept
                        </Button>
                        <Button size="small" variant="outlined" color="error" onClick={() => handleAction(b.id, 'cancel')}>
                          Decline
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* Recent Reviews */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Recent Reviews</Typography>
                {avgRating > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Star sx={{ fontSize: 16, color: 'warning.main' }} />
                    <Typography variant="body2" fontWeight={600}>{avgRating.toFixed(1)}</Typography>
                  </Box>
                )}
              </Box>
              {reviews.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography color="text.secondary" variant="body2">No reviews yet.</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {reviews.slice(0, 3).map(r => (
                    <Box key={r.id} sx={{
                      p: 1.5, borderRadius: 1,
                      border: '1px solid', borderColor: 'divider',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Avatar src={r.student_avatar || undefined} sx={{ width: 24, height: 24, bgcolor: 'info.main', fontSize: 12 }}>
                          {r.student_name?.[0]}
                        </Avatar>
                        <Typography variant="body2" fontWeight={500}>{r.student_name}</Typography>
                        <Rating value={r.rating} size="small" readOnly sx={{ ml: 'auto' }} />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {r.comment}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
