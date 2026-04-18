import { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Grid, Card, CardContent, Box, Tabs, Tab, Paper,
  CircularProgress,
} from '@mui/material';
import {
  VerifiedUser, Flag, People, Payments, Dashboard as DashboardIcon,
  AdminPanelSettings, Gavel,
} from '@mui/icons-material';
import api from '../utils/api';
import VerificationQueue from '../components/admin/VerificationQueue';
import ForumModeration from '../components/admin/ForumModeration';

/**
 * Admin Dashboard.
 *
 * Replaces the previous placeholder dashboard (which had hardcoded mock stats
 * and pointed users to Django admin). Now shows:
 *   - Tab 0 Overview: real stats from /auth/dashboard-stats/admin/
 *   - Tab 1 Verification Queue: pending tutor verifications with actions
 *   - Tab 2 Forum Moderation: flagged posts/replies with delete actions
 */
export default function AdminDashboard() {
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(() => {
    setLoading(true);
    api.get('/auth/dashboard-stats/admin/')
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = stats ? [
    {
      label: 'Pending Verifications',
      value: stats.pending_verifications,
      icon: <VerifiedUser />,
      color: 'warning.main',
    },
    {
      label: 'Flagged Posts',
      value: stats.flagged_posts,
      icon: <Flag />,
      color: 'error.main',
    },
    {
      label: 'Total Users',
      value: stats.total_users,
      icon: <People />,
      color: 'primary.main',
      subtitle: `${stats.total_students} students • ${stats.total_tutors} tutors`,
    },
    {
      label: 'Revenue This Month',
      value: `£${stats.revenue_this_month.toFixed(0)}`,
      icon: <Payments />,
      color: 'success.main',
    },
  ] : [];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <AdminPanelSettings sx={{ fontSize: 36, color: 'primary.main' }} />
        <Typography variant="h2">Admin Dashboard</Typography>
      </Box>

      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', minHeight: 48 } }}
        >
          <Tab icon={<DashboardIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Overview" />
          <Tab icon={<VerifiedUser sx={{ fontSize: 18 }} />} iconPosition="start"
               label={`Verification Queue${stats?.pending_verifications ? ` (${stats.pending_verifications})` : ''}`} />
          <Tab icon={<Gavel sx={{ fontSize: 18 }} />} iconPosition="start"
               label={`Forum Moderation${stats?.flagged_posts ? ` (${stats.flagged_posts})` : ''}`} />
        </Tabs>
      </Paper>

      {/* ===== OVERVIEW TAB ===== */}
      {tab === 0 && (
        <>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : (
            <>
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {statCards.map(s => (
                  <Grid item xs={12} sm={6} md={3} key={s.label}>
                    <Card>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Box sx={{ color: s.color, mb: 1 }}>{s.icon}</Box>
                        <Typography variant="h3">{s.value}</Typography>
                        <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                        {s.subtitle && (
                          <Typography variant="caption" color="text.secondary"
                                      sx={{ display: 'block', mt: 0.5 }}>
                            {s.subtitle}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Typography variant="h4" sx={{ mb: 2 }}>Quick Actions</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Card sx={{ cursor: 'pointer' }} onClick={() => setTab(1)}>
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      <VerifiedUser sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                      <Typography variant="h5">Review Tutors</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {stats?.pending_verifications || 0} waiting
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card sx={{ cursor: 'pointer' }} onClick={() => setTab(2)}>
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      <Flag sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                      <Typography variant="h5">Moderate Forum</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {stats?.flagged_posts || 0} flagged
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card
                    sx={{ cursor: 'pointer' }}
                    onClick={() => window.open('/admin/', '_blank')}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      <AdminPanelSettings sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="h5">Django Admin</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Full data access
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </>
          )}
        </>
      )}

      {/* ===== VERIFICATION QUEUE TAB ===== */}
      {tab === 1 && <VerificationQueue onChange={fetchStats} />}

      {/* ===== FORUM MODERATION TAB ===== */}
      {tab === 2 && <ForumModeration onChange={fetchStats} />}
    </Container>
  );
}
