import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Box, Card, CardContent, Button, IconButton, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  FormControlLabel, Switch, Alert, Snackbar, Paper, Chip, Tooltip,
} from '@mui/material';
import {
  ChevronLeft, ChevronRight, Add, Delete, Today as TodayIcon,
  EventAvailable, EventBusy,
} from '@mui/icons-material';

/**
 * Tutor Schedule — weekly grid to manage availability.
 *
 * Added in Update 6. Previously the backend had availability endpoints but no
 * UI, so tutors had to use Django admin or curl.
 *
 * Features:
 *  - Week navigation (prev / next / today)
 *  - Add slot: click a day → pick time → optional repeat weekly for 8 weeks
 *  - Delete slot: click an unbooked slot → confirm
 *  - Booked slots are visually distinct and not deletable
 */
export default function TutorSchedule() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  const fetchSlots = useCallback(() => {
    const from = ymd(weekStart);
    const toDate = new Date(weekStart);
    toDate.setDate(toDate.getDate() + 6);
    const to = ymd(toDate);
    setLoading(true);
    api.get('/tutoring/availability/', { params: { from, to } })
      .then(r => setSlots(r.data.results || r.data || []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [weekStart]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const openAdd = (date) => {
    setAddDate(ymd(date));
    setStartTime('09:00');
    setEndTime('10:00');
    setRepeatWeekly(false);
    setError('');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/tutoring/availability/', {
        date: addDate,
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        repeat_weekly: repeatWeekly,
      });
      const created = res.data.created_count || 1;
      const skipped = res.data.skipped || 0;
      setSnackbar(`${created} slot${created === 1 ? '' : 's'} added${skipped ? ` (${skipped} skipped — already exist)` : ''}.`);
      setAddOpen(false);
      fetchSlots();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/tutoring/availability/${deleteTarget.id}/delete/`);
      setSnackbar('Slot removed.');
      setDeleteTarget(null);
      fetchSlots();
    } catch (err) {
      setSnackbar(err.response?.data?.error || 'Failed to remove slot.');
      setDeleteTarget(null);
    }
  };

  // Group slots by date for fast lookup
  const slotsByDate = {};
  slots.forEach(s => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = [];
    slotsByDate[s.date].push(s);
  });

  // Stat summary
  const totalSlots = slots.length;
  const bookedSlots = slots.filter(s => s.is_booked).length;
  const freeSlots = totalSlots - bookedSlots;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2">My Schedule</Typography>
          <Typography color="text.secondary">
            Manage when you're available for tutoring sessions.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip icon={<EventAvailable />} label={`${freeSlots} available`} color="success" variant="outlined" />
          <Chip icon={<EventBusy />} label={`${bookedSlots} booked`} color="info" variant="outlined" />
        </Stack>
      </Box>

      {/* Week navigator */}
      <Paper sx={{ mb: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderRadius: 2 }}>
        <IconButton onClick={() => shiftWeek(-7, setWeekStart)} size="small">
          <ChevronLeft />
        </IconButton>
        <Button startIcon={<TodayIcon />} size="small" onClick={() => setWeekStart(getMonday(new Date()))}>
          This Week
        </Button>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography variant="h5">
            {formatWeekRange(weekStart)}
          </Typography>
        </Box>
        <IconButton onClick={() => shiftWeek(7, setWeekStart)} size="small">
          <ChevronRight />
        </IconButton>
      </Paper>

      {/* Weekly grid */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {weekDays.map(d => {
              const isToday = ymd(d) === ymd(new Date());
              const daySlots = slotsByDate[ymd(d)] || [];
              daySlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
              return (
                <Box key={ymd(d)} sx={{ minHeight: 400 }}>
                  <Box sx={{ textAlign: 'center', mb: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </Typography>
                    <Typography variant="h5" color={isToday ? 'primary' : 'text.primary'}
                      sx={{ fontWeight: isToday ? 700 : 400 }}>
                      {d.getDate()}
                    </Typography>
                  </Box>
                  <Stack spacing={0.5}>
                    {daySlots.map(slot => (
                      <Tooltip
                        key={slot.id}
                        title={slot.is_booked ? 'Booked — cannot delete' : 'Click to remove'}
                        arrow
                      >
                        <Chip
                          label={`${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`}
                          color={slot.is_booked ? 'info' : 'success'}
                          variant={slot.is_booked ? 'filled' : 'outlined'}
                          onClick={slot.is_booked ? undefined : () => setDeleteTarget(slot)}
                          onDelete={slot.is_booked ? undefined : () => setDeleteTarget(slot)}
                          deleteIcon={<Delete />}
                          size="small"
                          sx={{ justifyContent: 'space-between', fontSize: '0.75rem' }}
                        />
                      </Tooltip>
                    ))}
                    <Button
                      size="small" variant="text" startIcon={<Add />}
                      onClick={() => openAdd(d)}
                      sx={{ mt: 0.5, fontSize: '0.75rem' }}
                    >
                      Add
                    </Button>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {loading && (
        <Alert severity="info" sx={{ mt: 2 }}>Loading slots...</Alert>
      )}

      {/* Add slot dialog */}
      <Dialog open={addOpen} onClose={() => !submitting && setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Availability Slot</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <TextField
            fullWidth type="date" label="Date"
            value={addDate}
            onChange={(e) => setAddDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              select fullWidth label="Start time" value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            >
              {hours.map(h => (
                <MenuItem key={h} value={`${String(h).padStart(2, '0')}:00`}>
                  {String(h).padStart(2, '0')}:00
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select fullWidth label="End time" value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            >
              {hours.map(h => (
                <MenuItem key={h} value={`${String(h).padStart(2, '0')}:00`}>
                  {String(h).padStart(2, '0')}:00
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <FormControlLabel
            control={<Switch checked={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.checked)} />}
            label={
              <Box>
                <Typography>Repeat weekly (8 weeks)</Typography>
                <Typography variant="caption" color="text.secondary">
                  Creates this slot on the same weekday for the next 8 weeks.
                </Typography>
              </Box>
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Slot'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove Slot?</DialogTitle>
        <DialogContent>
          <Typography>
            {deleteTarget && (
              <>Remove the slot on <strong>{deleteTarget.date}</strong> from{' '}
              <strong>{deleteTarget.start_time?.slice(0, 5)}–{deleteTarget.end_time?.slice(0, 5)}</strong>?</>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Remove</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar('')}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}

// --- helpers ---

function getMonday(d) {
  const out = new Date(d);
  const day = out.getDay();
  const diff = out.getDate() - day + (day === 0 ? -6 : 1); // Mon as first day
  out.setDate(diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function shiftWeek(days, setter) {
  setter(prev => {
    const n = new Date(prev);
    n.setDate(n.getDate() + days);
    return n;
  });
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}
