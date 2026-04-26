import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import {
  AppBar, Toolbar, Typography, Button, Box, IconButton, Menu, MenuItem,
  Avatar, Chip, useMediaQuery, Drawer, List, ListItem, ListItemText, ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon, Forum, SmartToy, Search,
  Logout, Dashboard, BookOnline, Message, Settings, 
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const mainTabs = [
    { label: 'Find a Tutor', path: '/tutors', icon: <Search /> },
    { label: 'Forum', path: '/forum', icon: <Forum /> },
    { label: 'AI Assistant', path: '/ai-assistant', icon: <SmartToy /> },
  ];

  const isActive = (path) => location.pathname.startsWith(path);

  const handleNav = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const dashboardPath = user?.role === 'tutor' ? '/tutor-dashboard'
    : user?.role === 'admin' ? '/admin-dashboard' : '/dashboard';

  return (
    <AppBar position="sticky" sx={{ bgcolor: 'white', color: 'text.primary', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto', px: { xs: 2, md: 3 } }}>
        <Typography
          variant="h4" onClick={() => navigate('/')}
          sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 700, mr: 4, fontFamily: "'Plus Jakarta Sans'" }}
        >
          StudySpace
        </Typography>

        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, justifyContent: 'center' }}>
            {mainTabs.map((tab) => (
              <Button
                key={tab.path} startIcon={tab.icon}
                onClick={() => handleNav(tab.path)}
                sx={{
                  color: isActive(tab.path) ? 'primary.main' : 'text.secondary',
                  fontWeight: isActive(tab.path) ? 600 : 400,
                  borderBottom: isActive(tab.path) ? '2px solid' : '2px solid transparent',
                  borderColor: isActive(tab.path) ? 'primary.main' : 'transparent',
                  borderRadius: 0, px: 2, py: 1,
                }}
              >
                {tab.label}
              </Button>
            ))}
          </Box>
        )}

        <Box sx={{ flexGrow: isMobile ? 1 : 0 }} />

        {user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Dashboard button — visible for ALL roles on desktop */}
            {!isMobile && (
              <>
                <Button size="small" onClick={() => navigate(dashboardPath)} startIcon={<Dashboard />}>
                  Dashboard
                </Button>
              </>
            )}
            <NotificationDropdown />
            <Chip
              avatar={<Avatar src={user.avatar || undefined} sx={{ bgcolor: 'primary.main' }}>{user.display_name?.[0]?.toUpperCase()}</Avatar>}
              label={user.display_name}
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ cursor: 'pointer' }}
            />
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              <MenuItem disabled>
                <Typography variant="caption" color="text.secondary">
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Typography>
              </MenuItem>
              <MenuItem onClick={() => { handleNav('/bookings'); setAnchorEl(null); }}>
                <BookOnline sx={{ mr: 1, fontSize: 18 }} /> My Bookings
              </MenuItem>
              <MenuItem onClick={() => { handleNav('/messages'); setAnchorEl(null); }}>
                <Message sx={{ mr: 1, fontSize: 18 }} /> Messages
              </MenuItem>
              <MenuItem onClick={() => { handleNav('/settings'); setAnchorEl(null); }}>
                <Settings sx={{ mr: 1, fontSize: 18 }} /> Settings
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { logout(); navigate('/'); setAnchorEl(null); }}>
                <Logout sx={{ mr: 1, fontSize: 18 }} /> Log out
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" onClick={() => navigate('/login')}>Log in</Button>
            <Button variant="contained" size="small" onClick={() => navigate('/signup')}>Sign up</Button>
          </Box>
        )}

        {isMobile && (
          <IconButton onClick={() => setMobileOpen(true)} sx={{ ml: 1 }}>
            <MenuIcon />
          </IconButton>
        )}

        <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}>
          <Box sx={{ width: 260, pt: 2 }}>
            <List>
              {mainTabs.map((tab) => (
                <ListItem key={tab.path} button onClick={() => handleNav(tab.path)}>
                  <ListItemIcon>{tab.icon}</ListItemIcon>
                  <ListItemText primary={tab.label} />
                </ListItem>
              ))}
              {user && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <ListItem button onClick={() => handleNav(dashboardPath)}>
                    <ListItemIcon><Dashboard /></ListItemIcon>
                    <ListItemText primary="Dashboard" />
                  </ListItem>
                  <ListItem button onClick={() => handleNav('/messages')}>
                    <ListItemIcon><Message /></ListItemIcon>
                    <ListItemText primary="Messages" />
                  </ListItem>
                  <ListItem button onClick={() => handleNav('/settings')}>
                    <ListItemIcon><Settings /></ListItemIcon>
                    <ListItemText primary="Settings" />
                  </ListItem>
                </>
              )}
            </List>
          </Box>
        </Drawer>
      </Toolbar>
    </AppBar>
  );
}
