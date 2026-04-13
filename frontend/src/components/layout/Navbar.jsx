import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  AppBar, Toolbar, Typography, Button, Box, IconButton, Menu, MenuItem,
  Avatar, Chip, useMediaQuery, Drawer, List, ListItem, ListItemText, ListItemIcon,
} from '@mui/material';
import {
  Menu as MenuIcon, School, Forum, SmartToy, Search, Notifications,
  Person, Logout, Dashboard, BookOnline,
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

  return (
    <AppBar position="sticky" sx={{ bgcolor: 'white', color: 'text.primary', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto', px: { xs: 2, md: 3 } }}>
        {/* Logo */}
        <Typography
          variant="h4" onClick={() => navigate('/')}
          sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 700, mr: 4, fontFamily: "'Plus Jakarta Sans'" }}
        >
          StudySpace
        </Typography>

        {/* Center tabs — desktop */}
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, justifyContent: 'center' }}>
            {mainTabs.map((tab) => (
              <Button
                key={tab.path}
                startIcon={tab.icon}
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

        {/* Right side */}
        {user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!isMobile && user.role === 'student' && (
              <Button size="small" onClick={() => navigate('/dashboard')} startIcon={<Dashboard />}>
                Dashboard
              </Button>
            )}
            <IconButton size="small">
              <Notifications />
            </IconButton>
            <Chip
              avatar={<Avatar sx={{ bgcolor: 'primary.main' }}>{user.display_name?.[0]?.toUpperCase()}</Avatar>}
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
              {user.role === 'student' && <MenuItem onClick={() => { handleNav('/dashboard'); setAnchorEl(null); }}>Dashboard</MenuItem>}
              {user.role === 'tutor' && <MenuItem onClick={() => { handleNav('/tutor-dashboard'); setAnchorEl(null); }}>Dashboard</MenuItem>}
              {user.role === 'admin' && <MenuItem onClick={() => { handleNav('/admin-dashboard'); setAnchorEl(null); }}>Admin Panel</MenuItem>}
              <MenuItem onClick={() => { handleNav('/bookings'); setAnchorEl(null); }}>My Bookings</MenuItem>
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

        {/* Mobile hamburger */}
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
            </List>
          </Box>
        </Drawer>
      </Toolbar>
    </AppBar>
  );
}
