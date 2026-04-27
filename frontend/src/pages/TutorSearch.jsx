import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Container, Typography, Grid, Card, CardContent, TextField, Box, Chip, Stack,
  Avatar, Button, Rating, InputAdornment, Checkbox, FormControlLabel, Slider,
  RadioGroup, Radio, Divider, Paper,
} from '@mui/material';
import { Search, VerifiedUser, FilterList, LocationOn } from '@mui/icons-material';

const SUBJECTS = [
  'Mathematics', 'Computer Science', 'Physics', 'Chemistry', 'Biology',
  'Engineering', 'English Literature', 'Academic Writing', 'Data Structures',
  'Algorithms', 'Python', 'Machine Learning', 'Web Development', 'JavaScript',
  'React', 'Biochemistry', 'Business',
];

const AVAILABILITY_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'evenings', label: 'Evenings' },
];

const SESSION_TYPES = [
  { value: 'video', label: 'Online' },
  { value: 'in_person', label: 'In-person' },
  { value: 'both', label: 'Both' },
];

const PRICE_MIN = 10;

function roundPriceMax(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return PRICE_MIN + 10;
  return Math.max(PRICE_MIN + 10, Math.ceil(numeric / 10) * 10);
}

function getPriceBoundsFromTutors(list) {
  const highestRate = list.reduce((highest, tutor) => {
    const rate = Number(tutor.hourly_rate);
    return Number.isFinite(rate) ? Math.max(highest, rate) : highest;
  }, PRICE_MIN);

  return {
    min: PRICE_MIN,
    max: roundPriceMax(highestRate),
  };
}

export default function TutorSearch() {
  const navigate = useNavigate();
  const [tutors, setTutors] = useState([]);
  const [allTutors, setAllTutors] = useState([]);
  const [search, setSearch] = useState('');

  // Filters
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [priceBounds, setPriceBounds] = useState({ min: PRICE_MIN, max: 50 });
  const [priceRange, setPriceRange] = useState([PRICE_MIN, 50]);
  const [minRating, setMinRating] = useState(0);
  const [availability, setAvailability] = useState([]);
  const [sessionType, setSessionType] = useState('');

  useEffect(() => {
    api.get('/auth/tutors/').then(r => {
      const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
      const bounds = r.data.price_bounds
        ? { min: PRICE_MIN, max: roundPriceMax(r.data.price_bounds.max) }
        : getPriceBoundsFromTutors(list);

      setAllTutors(list);
      setTutors(list);
      setPriceBounds(bounds);
      setPriceRange([bounds.min, bounds.max]);
    });
  }, []);

  // Apply filters on change
  useEffect(() => {
    let filtered = [...allTutors];

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.user.first_name?.toLowerCase().includes(q) ||
        t.user.last_name?.toLowerCase().includes(q) ||
        t.user.display_name?.toLowerCase().includes(q) ||
        (t.subjects || []).some(s => s.toLowerCase().includes(q)) ||
        t.bio?.toLowerCase().includes(q)
      );
    }

    if (selectedSubjects.length > 0) {
      filtered = filtered.filter(t =>
        (t.subjects || []).some(s => selectedSubjects.includes(s))
      );
    }

    filtered = filtered.filter(t => {
      const rate = parseFloat(t.hourly_rate);
      return rate >= priceRange[0] && rate <= priceRange[1];
    });

    if (minRating > 0) {
      filtered = filtered.filter(t => (t.average_rating || 0) >= minRating);
    }

    if (locationFilter.trim()) {
      const q = locationFilter.toLowerCase().trim();
      filtered = filtered.filter(t =>
        (t.location_city || '').toLowerCase().includes(q) ||
        (t.location_postcode_area || '').toLowerCase().includes(q)
      );
    }

    setTutors(filtered);
  }, [search, selectedSubjects, priceRange, minRating, availability, sessionType, locationFilter, allTutors]);

  const toggleSubject = (s) => {
    setSelectedSubjects(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const toggleAvailability = (v) => {
    setAvailability(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  };

  const resetFilters = () => {
    setSelectedSubjects([]);
    setPriceRange([priceBounds.min, priceBounds.max]);
    setMinRating(0);
    setAvailability([]);
    setSessionType('');
    setSearch('');
    setLocationFilter('');
  };

  const activeFilterCount =
    selectedSubjects.length + availability.length +
    (minRating > 0 ? 1 : 0) +
    (sessionType ? 1 : 0) +
    (priceRange[0] !== priceBounds.min || priceRange[1] !== priceBounds.max ? 1 : 0);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 1 }}>Find a Tutor</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Browse verified tutors by subject, price, and rating.</Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search by subject, name, or keyword..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
        />
      </Box>

      <Grid container spacing={3}>
        {/* Filters sidebar */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, position: { md: 'sticky' }, top: { md: 80 } }} variant="outlined">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FilterList sx={{ fontSize: 20 }} />
                Filters
                {activeFilterCount > 0 && (
                  <Chip label={activeFilterCount} size="small" color="primary" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />
                )}
              </Typography>
              {activeFilterCount > 0 && (
                <Button size="small" onClick={resetFilters}>Reset</Button>
              )}
            </Box>

            {/* Subject */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Subject</Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {SUBJECTS.map(s => (
                  <FormControlLabel
                    key={s}
                    control={<Checkbox size="small" checked={selectedSubjects.includes(s)} onChange={() => toggleSubject(s)} />}
                    label={<Typography variant="body2">{s}</Typography>}
                    sx={{ display: 'flex', m: 0 }}
                  />
                ))}
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Price */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Price Range (per hour)</Typography>
              <Box sx={{ px: 1 }}>
                <Slider
                  value={priceRange}
                  onChange={(_, v) => setPriceRange(v)}
                  min={priceBounds.min}
                  max={priceBounds.max}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `£${value}`}
                  marks={[
                    { value: priceBounds.min, label: `£${priceBounds.min}` },
                    { value: priceBounds.max, label: `£${priceBounds.max}` },
                  ]}
                />
              </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Location</Typography>
              <TextField
                size="small" fullWidth
                placeholder="City or postcode area"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><LocationOn fontSize="small" /></InputAdornment>
                  ),
                }}
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Min Rating */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Minimum Rating</Typography>
              <RadioGroup value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                {[0, 3, 4, 5].map(n => (
                  <FormControlLabel
                    key={n} value={n}
                    control={<Radio size="small" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {n === 0 ? (
                          <Typography variant="body2">Any rating</Typography>
                        ) : (
                          <>
                            <Rating value={n} size="small" readOnly />
                            <Typography variant="body2" color="text.secondary">({n}.0+)</Typography>
                          </>
                        )}
                      </Box>
                    }
                    sx={{ m: 0 }}
                  />
                ))}
              </RadioGroup>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Availability */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Availability</Typography>
              {AVAILABILITY_OPTIONS.map(a => (
                <FormControlLabel
                  key={a.value}
                  control={<Checkbox size="small" checked={availability.includes(a.value)} onChange={() => toggleAvailability(a.value)} />}
                  label={<Typography variant="body2">{a.label}</Typography>}
                  sx={{ display: 'flex', m: 0 }}
                />
              ))}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Session Type */}
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Session Type</Typography>
              <RadioGroup value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
                <FormControlLabel value="" control={<Radio size="small" />} label={<Typography variant="body2">Any</Typography>} sx={{ m: 0 }} />
                {SESSION_TYPES.map(t => (
                  <FormControlLabel
                    key={t.value} value={t.value}
                    control={<Radio size="small" />}
                    label={<Typography variant="body2">{t.label}</Typography>}
                    sx={{ m: 0 }}
                  />
                ))}
              </RadioGroup>
            </Box>
          </Paper>
        </Grid>

        {/* Results */}
        <Grid item xs={12} md={9}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tutors.length} tutors found
          </Typography>

          <Grid container spacing={2}>
            {tutors.map(t => (
              <Grid item xs={12} sm={6} lg={4} key={t.user.id}>
                <Card sx={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
                  onClick={() => navigate('/tutors/' + t.user.id)}>
                  <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <Avatar src={t.user.avatar || undefined} sx={{ bgcolor: 'primary.main', width: 48, height: 48, fontSize: 20 }}>
                        {t.user.display_name?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="h5" noWrap>{t.user.first_name} {t.user.last_name}</Typography>
                          {t.verification_status === 'approved' && (
                            <VerifiedUser sx={{ fontSize: 14, color: 'primary.main', flexShrink: 0 }} />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          @{t.user.display_name}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                      {(t.subjects || []).slice(0, 3).map(s => (
                        <Chip key={s} label={s} size="small" variant="outlined" color="primary" sx={{ height: 22, fontSize: 11 }} />
                      ))}
                      {(t.subjects || []).length > 3 && (
                        <Chip label={`+${t.subjects.length - 3}`} size="small" sx={{ height: 22, fontSize: 11 }} />
                      )}
                    </Box>

                    {t.location_city && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" noWrap>
                          Based in {t.location_city}
                          {t.location_postcode_area ? ` (${t.location_postcode_area})` : ''}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <Rating value={t.average_rating} precision={0.1} size="small" readOnly />
                      <Typography variant="caption" color="text.secondary">({t.total_reviews})</Typography>
                    </Box>

                    <Typography variant="h4" color="primary">£{t.hourly_rate}/hr</Typography>

                    <Typography variant="body2" color="text.secondary" sx={{
                      mt: 1, flex: 1,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {t.bio}
                    </Typography>

                    <Button variant="contained" fullWidth sx={{ mt: 2 }}>View Profile</Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {tutors.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h4" color="text.secondary">No tutors match your filters</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>Try adjusting or resetting them.</Typography>
              {activeFilterCount > 0 && <Button variant="contained" onClick={resetFilters}>Reset Filters</Button>}
            </Box>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
