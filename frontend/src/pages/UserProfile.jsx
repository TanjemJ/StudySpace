import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Container, Box, Typography, Card, CardContent, Avatar, Chip, Stack,
  Grid, Button, Divider, Rating, Paper,
} from '@mui/material';
import {
  School, VerifiedUser, Forum, ChatBubble, CalendarMonth,
  PersonOff, ArrowBack, Star,
} from '@mui/icons-material';


function uniShort(uni) {
  if (!uni) return '';
  if (uni.includes('South Bank')) return 'LSBU';
  if (uni.includes('Kings')) return 'KCL';
  if (uni.includes('College London')) return 'UCL';
  if (uni.includes('Imperial')) return 'Imperial';
  if (uni.includes('Queen')) return 'QMUL';
  return uni;
}

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/auth/users/${id}/`)
      .then(r => { setProfile(r.data); setLoading(false); })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;
  }

  // Deleted user or not found
  if (notFound || profile?.deleted) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PersonOff sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h2" sx={{ mb: 1 }}>User not found</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {profile?.deleted
              ? 'This user has deleted their account. Their forum posts may still be visible, but their profile is no longer available.'
              : "This user doesn't exist anymore."}
          </Typography>
          <Button variant="contained" startIcon={<ArrowBack />} onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </Paper>
      </Container>
    );
  }

  if (!profile) return null;

  const isTutor = profile.role === 'tutor';
  const isStudent = profile.role === 'student';
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>

      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Avatar
              src={profile.avatar || undefined}
              sx={{ bgcolor: 'primary.main', width: 96, height: 96, fontSize: 40 }}
            >
              {profile.display_name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <Typography variant="h2">
                  {profile.first_name} {profile.last_name}
                </Typography>
                <Chip
                  label={profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  size="small" color="primary"
                  variant="outlined"
                />
                {isTutor && profile.tutor_info?.verification_status === 'approved' && (
                  <Chip icon={<VerifiedUser sx={{ fontSize: 14 }} />} label="Verified Tutor" size="small" color="success" />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                @{profile.display_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Member since {memberSince}
              </Typography>

              {isTutor && profile.tutor_info && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Rating value={profile.tutor_info.average_rating || 0} precision={0.1} size="small" readOnly />
                  <Typography variant="body2" color="text.secondary">
                    ({profile.tutor_info.total_reviews} reviews · {profile.tutor_info.total_sessions} sessions)
                  </Typography>
                </Box>
              )}

              {isTutor && profile.tutor_info?.verification_status === 'approved' && (
                <Button
                  variant="contained" size="small" sx={{ mt: 2 }}
                  onClick={() => navigate(`/tutors/${profile.id}`)}
                >
                  View Full Tutor Profile
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Left: About / Tutor info */}
        <Grid item xs={12} md={7}>
          {isTutor && profile.tutor_info?.bio && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 2 }}>About</Typography>
                <Typography sx={{ lineHeight: 1.7 }}>{profile.tutor_info.bio}</Typography>
              </CardContent>
            </Card>
          )}

          {isStudent && profile.student_info?.university && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  <School sx={{ fontSize: 20, mr: 0.5, verticalAlign: 'text-bottom' }} />
                  Education
                </Typography>
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">University</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>{profile.student_info.university}</Typography>
                      {profile.student_info.university_verified && (
                        <Chip icon={<VerifiedUser sx={{ fontSize: 12 }} />} label="Verified" size="small" color="success" />
                      )}
                    </Box>
                  </Box>
                  {profile.student_info.course && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Course</Typography>
                      <Typography>{profile.student_info.course}</Typography>
                    </Box>
                  )}
                  {profile.student_info.year_of_study && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Year of Study</Typography>
                      <Typography>{profile.student_info.year_of_study === 5 ? 'Postgraduate' : `Year ${profile.student_info.year_of_study}`}</Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 2 }}>Forum Activity</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Forum sx={{ fontSize: 28, color: 'primary.main', mb: 0.5 }} />
                    <Typography variant="h3">{profile.forum_stats?.posts_count || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Posts</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <ChatBubble sx={{ fontSize: 28, color: 'info.main', mb: 0.5 }} />
                    <Typography variant="h3">{profile.forum_stats?.replies_count || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Replies</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Tutor details / Quick stats */}
        <Grid item xs={12} md={5}>
          {isTutor && profile.tutor_info && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 2 }}>Tutor Details</Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Hourly Rate</Typography>
                    <Typography variant="h4" color="primary">£{profile.tutor_info.hourly_rate}/hr</Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Subjects</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {(profile.tutor_info.subjects || []).map(s => (
                        <Chip key={s} label={s} size="small" color="primary" />
                      ))}
                    </Box>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Experience</Typography>
                    <Typography>{profile.tutor_info.experience_years} years</Typography>
                  </Box>
                  {profile.tutor_info.university && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="caption" color="text.secondary">University</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography>{uniShort(profile.tutor_info.university)}</Typography>
                          {profile.tutor_info.university_verified && (
                            <VerifiedUser sx={{ fontSize: 14, color: 'primary.main' }} />
                          )}
                        </Box>
                      </Box>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {isStudent && (
            <Card>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 2 }}>Quick Info</Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Role</Typography>
                    <Typography variant="body2">Student</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Joined</Typography>
                    <Typography variant="body2">{memberSince}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
