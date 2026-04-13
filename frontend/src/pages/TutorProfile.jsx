import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { Container, Typography, Card, CardContent, Box, Chip, Stack, Avatar, Button, Rating, Grid, Divider } from '@mui/material';
import { VerifiedUser, CalendarMonth, School } from '@mui/icons-material';

export default function TutorProfile() {
  const { id } = useParams();
  const [tutor, setTutor] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    api.get("/auth/tutors/" + id + "/").then(r => setTutor(r.data)).catch(() => {});
    api.get("/tutoring/reviews/" + id + "/").then(r => setReviews(r.data.results || r.data || [])).catch(() => {});
  }, [id]);

  if (!tutor) return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card sx={{ mb: 3 }}><CardContent>
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 80, height: 80, fontSize: 36 }}>
            {tutor.user?.display_name?.[0]?.toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h2">{tutor.user?.first_name} {tutor.user?.last_name}</Typography>
              {tutor.verification_status === 'approved' && <Chip icon={<VerifiedUser />} label="Verified" color="success" size="small" />}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Rating value={tutor.average_rating} precision={0.1} readOnly />
              <Typography variant="body2" color="text.secondary">({tutor.total_reviews} reviews)</Typography>
            </Box>
            <Typography variant="h3" color="primary" sx={{ mb: 2 }}>£{tutor.hourly_rate}/hr</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="large">Book a Session</Button>
              <Button variant="outlined" size="large">Message</Button>
            </Stack>
          </Box>
        </Box>
      </CardContent></Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}><CardContent>
            <Typography variant="h4" sx={{ mb: 2 }}>About</Typography>
            <Typography>{tutor.bio}</Typography>
          </CardContent></Card>
          <Card><CardContent>
            <Typography variant="h4" sx={{ mb: 2 }}>Reviews</Typography>
            {reviews.length === 0 ? <Typography color="text.secondary">No reviews yet.</Typography> : (
              <Stack spacing={2}>
                {reviews.map(r => (
                  <Box key={r.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'info.main' }}>{r.student_name?.[0]}</Avatar>
                      <Typography variant="h6">{r.student_name}</Typography>
                      <Rating value={r.rating} size="small" readOnly />
                    </Box>
                    <Typography variant="body2">{r.comment}</Typography>
                    <Divider sx={{ mt: 2 }} />
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card><CardContent>
            <Typography variant="h4" sx={{ mb: 2 }}>Subjects</Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {(tutor.subjects || []).map(s => <Chip key={s} label={s} color="primary" />)}
            </Stack>
            <Typography variant="h4" sx={{ mt: 3, mb: 1 }}>Experience</Typography>
            <Typography>{tutor.experience_years} years</Typography>
            <Typography variant="h4" sx={{ mt: 3, mb: 1 }}>Sessions</Typography>
            <Typography>{tutor.total_sessions} completed</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>
    </Container>
  );
}
