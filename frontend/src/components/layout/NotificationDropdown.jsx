import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import {
  IconButton, Badge, Popover, Box, Typography, List, ListItemButton,
  ListItemText, Divider, Button, Chip,
} from '@mui/material';
import {
  Notifications as NotifIcon, CalendarMonth, Forum, Message,
  VerifiedUser, Info, DoneAll,
} from '@mui/icons-material';

const ICON_MAP = {
  booking_confirmed: <CalendarMonth sx={{ fontSize: 18, color: 'success.main' }} />,
  booking_cancelled: <CalendarMonth sx={{ fontSize: 18, color: 'error.main' }} />,
  booking_reminder: <CalendarMonth sx={{ fontSize: 18, color: 'warning.main' }} />,
  forum_reply: <Forum sx={{ fontSize: 18, color: 'info.main' }} />,
  forum_upvote: <Forum sx={{ fontSize: 18, color: 'primary.main' }} />,
  message: <Message sx={{ fontSize: 18, color: 'primary.main' }} />,
  verification_update: <VerifiedUser sx={{ fontSize: 18, color: 'success.main' }} />,
  moderation_action: <Info sx={{ fontSize: 18, color: 'warning.main' }} />,
  system: <Info sx={{ fontSize: 18, color: 'text.secondary' }} />,
};

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = () => {
    api.get('/auth/notifications/').then(r => {
      const data = r.data.results || r.data || [];
      setNotifications(data.slice(0, 10));
    }).catch(() => {});
  };

  const fetchUnreadCount = () => {
    api.get('/auth/notifications/unread-count/').then(r => {
      setUnreadCount(r.data.count || 0);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    fetchNotifications();
  };

  const handleClose = () => setAnchorEl(null);

  const handleClick = async (notif) => {
    if (!notif.is_read) {
      await api.post(`/auth/notifications/${notif.id}/read/`);
      setUnreadCount(Math.max(0, unreadCount - 1));
    }
    handleClose();
    if (notif.link) navigate(notif.link);
  };

  const handleMarkAllRead = async () => {
    await api.post('/auth/notifications/mark-all-read/');
    setUnreadCount(0);
    fetchNotifications();
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <>
      <IconButton size="small" onClick={handleOpen}>
        <Badge badgeContent={unreadCount} color="error" max={9}>
          <NotifIcon />
        </Badge>
      </IconButton>

      <Popover
        open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxHeight: 420, borderRadius: 2 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
          <Typography variant="h5">Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<DoneAll sx={{ fontSize: 16 }} />} onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <NotifIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No notifications yet.</Typography>
          </Box>
        ) : (
          <List sx={{ py: 0, maxHeight: 340, overflow: 'auto' }}>
            {notifications.map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => handleClick(n)}
                sx={{
                  py: 1.5, px: 2,
                  bgcolor: n.is_read ? 'transparent' : 'rgba(0, 107, 63, 0.04)',
                  borderLeft: n.is_read ? 'none' : '3px solid',
                  borderColor: 'primary.main',
                }}
              >
                <Box sx={{ mr: 1.5, mt: 0.5 }}>
                  {ICON_MAP[n.notification_type] || ICON_MAP.system}
                </Box>
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={n.is_read ? 400 : 600} sx={{ lineHeight: 1.3 }}>
                      {n.title}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3, mt: 0.25 }}>
                        {n.message.length > 80 ? n.message.substring(0, 80) + '...' : n.message}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block' }}>
                        {timeAgo(n.created_at)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
