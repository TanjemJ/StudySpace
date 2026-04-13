import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Grid, Card, CardContent, Button, Box, Chip, Stack,
  Avatar, TextField, InputAdornment, Tabs, Tab, Divider, Badge, ToggleButtonGroup,
  ToggleButton, Paper, Alert, Tooltip,
} from '@mui/material';
import {
  Add, ThumbUp, ChatBubble, PushPin, Search, School, Public, Lock,
  TrendingUp, Schedule, QuestionAnswer, Forum as ForumIcon, Whatshot,
  FilterList, SortByAlpha,
} from '@mui/icons-material';

export default function Forum() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedUni, setSelectedUni] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');

  // User's university
  const userUniversity = user?.student_profile?.university || '';

  useEffect(() => {
    api.get('/forum/universities/').then(r => setUniversities(r.data.universities || [])).catch(() => {});
    api.get('/forum/stats/').then(r => setStats(r.data)).catch(() => {});
    fetchCategories();
    fetchPosts();
  }, []);

  const fetchCategories = (uni = null) => {
    const params = {};
    if (uni && uni !== 'all') params.university = uni;
    api.get('/forum/categories/', { params }).then(r => setCategories(r.data.results || r.data || []));
  };

  const fetchPosts = (overrides = {}) => {
    setLoading(true);
    const params = {
      sort: overrides.sort || sortBy,
    };
    if (overrides.category || selectedCat) params.category = overrides.category || selectedCat;
    if (overrides.university !== undefined ? overrides.university : selectedUni) {
      params.university = overrides.university !== undefined ? overrides.university : selectedUni;
    }
    if (overrides.search || searchQuery) params.search = overrides.search || searchQuery;

    api.get('/forum/posts/', { params })
      .then(r => setPosts(r.data.results || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleUniversityChange = (uni) => {
    setSelectedUni(uni);
    setSelectedCat(null);
    fetchCategories(uni);
    fetchPosts({ university: uni, category: null });
  };

  const handleCategorySelect = (catId) => {
    const newCat = catId === selectedCat ? null : catId;
    setSelectedCat(newCat);
    fetchPosts({ category: newCat });
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    fetchPosts({ sort: newSort });
  };

  const handleSearch = () => {
    fetchPosts({ search: searchQuery });
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // Separate global and university categories
  const globalCategories = categories.filter(c => !c.university);
  const uniCategories = categories.filter(c => c.university);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '80vh' }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h2" sx={{ mb: 0.5 }}>Community Forum</Typography>
            <Typography color="text.secondary">
              Ask questions, share tips, and connect with students across universities.
            </Typography>
          </Box>
          {user ? (
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/forum/new')} size="large">
              New Post
            </Button>
          ) : (
            <Button variant="outlined" onClick={() => navigate('/login')}>Log in to post</Button>
          )}
        </Box>

        <Grid container spacing={3}>
          {/* Main content */}
          <Grid item xs={12} md={8}>
            {/* University Tabs */}
            <Paper sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
              <Tabs
                value={selectedUni}
                onChange={(_, v) => handleUniversityChange(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', minHeight: 48 } }}
              >
                <Tab icon={<Public sx={{ fontSize: 18 }} />} iconPosition="start" label="All Posts" value="all" />
                <Tab icon={<ForumIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Global" value="global" />
                {userUniversity && (
                  <Tab
                    icon={<School sx={{ fontSize: 18 }} />} iconPosition="start"
                    label={`My University`}
                    value={userUniversity}
                  />
                )}
                {universities.filter(u => u !== userUniversity).map(u => {
                  const short = u.includes('South Bank') ? 'LSBU' : u.includes('Kings') ? 'KCL' : u.includes('College London') && u.includes('University') ? 'UCL' : u.includes('Imperial') ? 'Imperial' : u.includes('Queen') ? 'QMUL' : u.substring(0, 15);
                  return (
                    <Tab
                      key={u} icon={<School sx={{ fontSize: 18 }} />} iconPosition="start"
                      label={short} value={u}
                      sx={{ opacity: user ? 1 : 0.5 }}
                    />
                  );
                })}
              </Tabs>
            </Paper>

            {/* University-only notice */}
            {selectedUni && selectedUni !== 'all' && selectedUni !== 'global' && (
              <Alert
                severity={userUniversity === selectedUni ? 'success' : 'info'}
                icon={userUniversity === selectedUni ? <School /> : <Lock />}
                sx={{ mb: 2 }}
              >
                {userUniversity === selectedUni
                  ? `You are viewing your university's private forum. Only verified ${selectedUni} students can post here.`
                  : `This is a private forum for ${selectedUni} students. Verify your university email to access.`
                }
              </Alert>
            )}

            {/* Search + Sort bar */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small" placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                sx={{ flex: 1, minWidth: 200 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 20 }} /></InputAdornment> }}
              />
              <ToggleButtonGroup
                value={sortBy} exclusive
                onChange={(_, v) => v && handleSortChange(v)}
                size="small"
              >
                <ToggleButton value="latest">
                  <Tooltip title="Latest"><Schedule sx={{ fontSize: 18 }} /></Tooltip>
                </ToggleButton>
                <ToggleButton value="popular">
                  <Tooltip title="Most Popular"><Whatshot sx={{ fontSize: 18 }} /></Tooltip>
                </ToggleButton>
                <ToggleButton value="most_discussed">
                  <Tooltip title="Most Discussed"><ChatBubble sx={{ fontSize: 18 }} /></Tooltip>
                </ToggleButton>
                <ToggleButton value="unanswered">
                  <Tooltip title="Unanswered"><QuestionAnswer sx={{ fontSize: 18 }} /></Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Category chips */}
            <Stack direction="row" spacing={0.5} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 0.5 }}>
              <Chip
                label="All Topics"
                onClick={() => handleCategorySelect(null)}
                color={!selectedCat ? 'primary' : 'default'}
                variant={!selectedCat ? 'filled' : 'outlined'}
                size="small"
              />
              {(selectedUni && selectedUni !== 'all' && selectedUni !== 'global' ? uniCategories : globalCategories).map(c => (
                <Chip
                  key={c.id}
                  label={`${c.name} (${c.post_count})`}
                  onClick={() => handleCategorySelect(c.id)}
                  color={selectedCat === c.id ? 'primary' : 'default'}
                  variant={selectedCat === c.id ? 'filled' : 'outlined'}
                  size="small"
                  icon={c.is_university_only ? <Lock sx={{ fontSize: 14 }} /> : undefined}
                />
              ))}
            </Stack>

            {/* Posts list */}
            <Stack spacing={1.5}>
              {posts.map(p => (
                <Card
                  key={p.id}
                  sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', borderWidth: 1 } }}
                  onClick={() => navigate('/forum/post/' + p.id)}
                  variant="outlined"
                >
                  <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      {/* Vote column */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44, pt: 0.5 }}>
                        <ThumbUp sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" fontWeight={600} color="primary.main">{p.upvotes}</Typography>
                      </Box>

                      {/* Content */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                          {p.is_pinned && (
                            <Chip icon={<PushPin sx={{ fontSize: 12 }} />} label="Pinned" size="small"
                              sx={{ height: 20, fontSize: 11, bgcolor: 'primary.light', color: 'white' }} />
                          )}
                          <Chip label={p.category_name} size="small" variant="outlined"
                            sx={{ height: 20, fontSize: 11 }} />
                          {p.university && (
                            <Chip icon={<School sx={{ fontSize: 12 }} />} label={
                              p.university.includes('South Bank') ? 'LSBU' :
                              p.university.includes('Kings') ? 'KCL' :
                              p.university.includes('College London') ? 'UCL' :
                              p.university.includes('Imperial') ? 'Imperial' :
                              p.university.includes('Queen') ? 'QMUL' : p.university.substring(0, 12)
                            } size="small" color="success" variant="outlined"
                              sx={{ height: 20, fontSize: 11 }} />
                          )}
                        </Box>

                        <Typography variant="h5" sx={{ mb: 0.5, lineHeight: 1.3 }}>{p.title}</Typography>

                        <Typography variant="body2" color="text.secondary"
                          sx={{ mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {p.content}
                        </Typography>

                        {/* Tags */}
                        {p.tags && p.tags.length > 0 && (
                          <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.3 }}>
                            {p.tags.slice(0, 4).map(tag => (
                              <Chip key={tag} label={`#${tag}`} size="small"
                                sx={{ height: 18, fontSize: 10, bgcolor: '#F0FDF4', color: 'primary.main' }} />
                            ))}
                          </Stack>
                        )}

                        {/* Meta row */}
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: p.is_anonymous ? 'grey.400' : 'primary.main' }}>
                              {p.is_anonymous ? '?' : p.author_name?.[0]?.toUpperCase()}
                            </Avatar>
                            <Typography variant="caption" color="text.secondary">{p.author_name}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">{timeAgo(p.created_at)}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <ChatBubble sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">{p.reply_count} replies</Typography>
                          </Box>
                        </Stack>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            {/* Empty state */}
            {posts.length === 0 && !loading && (
              <Paper sx={{ textAlign: 'center', py: 6, mt: 2 }}>
                <ForumIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="h4" color="text.secondary" sx={{ mb: 1 }}>No posts found</Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {searchQuery ? 'Try different search terms.' : 'Be the first to start a discussion!'}
                </Typography>
                {user && (
                  <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/forum/new')}>
                    Create Post
                  </Button>
                )}
              </Paper>
            )}
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            {/* Forum Stats */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 1.5 }}>Forum Stats</Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Total Posts</Typography>
                    <Typography variant="body2" fontWeight={600}>{stats.total_posts || 0}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Total Replies</Typography>
                    <Typography variant="body2" fontWeight={600}>{stats.total_replies || 0}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Categories</Typography>
                    <Typography variant="body2" fontWeight={600}>{stats.total_categories || 0}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* University Groups */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 1.5 }}>
                  <School sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                  University Groups
                </Typography>
                <Stack spacing={0.5}>
                  {universities.map(uni => {
                    const short = uni.includes('South Bank') ? 'LSBU' : uni.includes('Kings') ? 'KCL' : uni.includes('College London') && uni.includes('University') ? 'UCL' : uni.includes('Imperial') ? 'Imperial' : uni.includes('Queen') ? 'QMUL' : uni;
                    const isUserUni = uni === userUniversity;
                    return (
                      <Chip
                        key={uni}
                        label={short}
                        onClick={() => handleUniversityChange(uni)}
                        color={selectedUni === uni ? 'primary' : 'default'}
                        variant={selectedUni === uni ? 'filled' : 'outlined'}
                        size="small"
                        icon={isUserUni ? <School sx={{ fontSize: 14 }} /> : <Lock sx={{ fontSize: 14 }} />}
                        sx={{ justifyContent: 'flex-start' }}
                      />
                    );
                  })}
                </Stack>
                {!user && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Log in and verify your university email to access private forums.
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Popular Tags */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 1.5 }}>Popular Tags</Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {['study-tips', 'cs', 'career', 'deadlines', 'mental-health', 'maths', 'coding', 'internship',
                    'dissertation', 'referencing', 'react', 'productivity'].map(tag => (
                    <Chip
                      key={tag} label={`#${tag}`} size="small"
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F0FDF4' } }}
                      variant="outlined"
                      onClick={() => { setSearchQuery(tag); fetchPosts({ search: tag }); }}
                    />
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* Forum Guidelines */}
            <Card>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 1 }}>Forum Guidelines</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Be respectful and supportive. This is a learning community.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  No spam, hate speech, or academic dishonesty.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Anonymous posting is available — use it responsibly.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
