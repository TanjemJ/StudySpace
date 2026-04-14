import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const fetchFullProfile = async () => {
    try {
      const res = await api.get('/auth/me/');
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      return res.data;
    } catch {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('tokens');
      return null;
    }
  };

  useEffect(() => {
    const tokens = JSON.parse(localStorage.getItem('tokens') || '{}');
    if (tokens.access) {
      fetchFullProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login/', { email, password });
    localStorage.setItem('tokens', JSON.stringify(res.data.tokens));
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    // Fetch full profile including student_profile / tutor_profile
    await fetchFullProfile();
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('tokens');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, fetchFullProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
