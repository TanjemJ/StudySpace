import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box, Fade } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import { useEffect, useState } from 'react';

import Navbar from './components/layout/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import StudentDashboard from './pages/StudentDashboard';
import TutorDashboard from './pages/TutorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TutorSearch from './pages/TutorSearch';
import TutorProfile from './pages/TutorProfile';
import Forum from './pages/Forum';
import ForumThread from './pages/ForumThread';
import CreatePost from './pages/CreatePost';
import AIChat from './pages/AIChat';
import Bookings from './pages/Bookings';
import Settings from './pages/Settings';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function PageTransition({ children }) {
  const location = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(false);
    const t = setTimeout(() => setShow(true), 30);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <Fade in={show} timeout={250}>
      <Box>{children}</Box>
    </Fade>
  );
}

export default function App() {
  const { user } = useAuth();

  const getDashboardRoute = () => {
    if (!user) return '/';
    if (user.role === 'student') return '/dashboard';
    if (user.role === 'tutor') return '/tutor-dashboard';
    if (user.role === 'admin') return '/admin-dashboard';
    return '/';
  };

  return (
    <>
      <Navbar />
      <PageTransition>
        <Routes>
          <Route path="/" element={user ? <Navigate to={getDashboardRoute()} /> : <Landing />} />
          <Route path="/login" element={user ? <Navigate to={getDashboardRoute()} /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to={getDashboardRoute()} /> : <SignUp />} />

          {/* Student */}
          <Route path="/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute roles={['student']}><Bookings /></ProtectedRoute>} />

          {/* Tutor */}
          <Route path="/tutor-dashboard" element={<ProtectedRoute roles={['tutor']}><TutorDashboard /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin-dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />

          {/* Public / Shared */}
          <Route path="/tutors" element={<TutorSearch />} />
          <Route path="/tutors/:id" element={<TutorProfile />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/forum/post/:id" element={<ForumThread />} />
          <Route path="/forum/new" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
          <Route path="/ai-assistant" element={<AIChat />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </PageTransition>
    </>
  );
}
