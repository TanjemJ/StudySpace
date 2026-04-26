import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Fade } from '@mui/material';
import { useAuth } from './contexts/AuthContext';

import Navbar from './components/layout/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import StudentDashboard from './pages/StudentDashboard';
import TutorDashboard from './pages/TutorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TutorSearch from './pages/TutorSearch';
import TutorProfile from './pages/TutorProfile';
import TutorSchedule from './pages/TutorSchedule';
import UserProfile from './pages/UserProfile';
import Forum from './pages/Forum';
import ForumThread from './pages/ForumThread';
import CreatePost from './pages/CreatePost';
import AIChat from './pages/AIChat';
import Bookings from './pages/Bookings';
import Settings from './pages/Settings';
import ContactUs from './pages/ContactUs';
import Messages from './pages/Messages';


function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function PageTransition({ children }) {
  const location = useLocation();
  const [key, setKey] = useState(location.key);
  useEffect(() => {
    setKey(location.key);
  }, [location.key]);
  return (
    <Fade in key={key} timeout={250}>
      <div>{children}</div>
    </Fade>
  );
}

export default function App() {
  const { user } = useAuth();

  const getDashboardRoute = () => {
    if (!user) return '/';
    if (user.role === 'admin') return '/admin-dashboard';
    if (user.role === 'tutor') return '/tutor-dashboard';
    return '/dashboard';
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

          {/* Shared (students + tutors) */}
          <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />

          {/* Tutor */}
          <Route path="/tutor-dashboard" element={<ProtectedRoute roles={['tutor']}><TutorDashboard /></ProtectedRoute>} />
          <Route path="/tutor-schedule" element={<ProtectedRoute roles={['tutor']}><TutorSchedule /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin-dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />

          {/* Public */}
          <Route path="/tutors" element={<TutorSearch />} />
          <Route path="/tutors/:id" element={<TutorProfile />} />
          <Route path="/users/:id" element={<UserProfile />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/forum/post/:id" element={<ForumThread />} />
          <Route path="/forum/new" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
          <Route path="/ai-assistant" element={<AIChat />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/messages/:conversationId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/contact" element={<ContactUs />} />
        </Routes>
      </PageTransition>
    </>
  );
}
