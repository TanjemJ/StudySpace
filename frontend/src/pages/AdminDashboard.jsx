import { Container, Typography, Grid, Card, CardContent, Box } from '@mui/material';
import { VerifiedUser, Flag, People, Payments } from '@mui/icons-material';

export default function AdminDashboard() {
  const stats = [
    { label: 'Pending Verifications', value: 2, icon: <VerifiedUser />, color: 'warning.main' },
    { label: 'Flagged Posts', value: 1, icon: <Flag />, color: 'error.main' },
    { label: 'Total Users', value: 11, icon: <People />, color: 'primary.main' },
    { label: 'Revenue (Month)', value: '£285', icon: <Payments />, color: 'success.main' },
  ];
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 4 }}>Admin Dashboard</Typography>
      <Grid container spacing={3}>
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
      <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
        Full admin panel with verification queue, moderation tools, and analytics coming soon. Use Django Admin at /admin/ for now.
      </Typography>
    </Container>
  );
}
