import { useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Card, CardContent, Typography, TextField, Button, Box, Alert,
  Divider, Stack, IconButton, InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff, Google, Microsoft } from '@mui/icons-material';

function GoogleSignInButton({ disabled, onSuccess, onError }) {
  const startGoogleLogin = useGoogleLogin({
    onSuccess,
    onError,
    scope: 'openid email profile',
  });

  return (
    <Button
      variant="outlined"
      startIcon={<Google />}
      onClick={() => startGoogleLogin()}
      disabled={disabled}
      sx={{ flex: 1 }}
    >
      Google
    </Button>
  );
}


export default function Login() {
  const navigate = useNavigate();
  const { login, updateUser, fetchFullProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/google/', {
        access_token: tokenResponse.access_token,
      });

      localStorage.setItem('tokens', JSON.stringify(res.data.tokens));
      localStorage.setItem('user', JSON.stringify(res.data.user));
      updateUser(res.data.user);
      await fetchFullProfile();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
      <Container maxWidth="xs">
        <Card sx={{ p: 1 }}>
          <CardContent>
            <Typography variant="h3" textAlign="center" color="primary" sx={{ mb: 0.5 }}>StudySpace</Typography>
            <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
              Welcome back! Log in to continue.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <form onSubmit={handleSubmit}>
              <TextField fullWidth label="Email address" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} required />
              <TextField fullWidth label="Password" type={showPassword ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 1 }} required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button size="small" sx={{ textTransform: 'none' }}>Forgot password?</Button>
              </Box>
              <Button fullWidth variant="contained" size="large" type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Log in'}
              </Button>
            </form>

            <Divider sx={{ my: 3 }}>or continue with</Divider>
            <Stack direction="row" spacing={2} justifyContent="center">
              {googleClientId ? (
                <GoogleOAuthProvider clientId={googleClientId}>
                  <GoogleSignInButton
                    disabled={loading}
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google login failed. Please try again.')}
                  />
                </GoogleOAuthProvider>
              ) : (
                <Button variant="outlined" startIcon={<Google />} sx={{ flex: 1 }} disabled>
                  Google
                </Button>
              )}
              <Button variant="outlined" startIcon={<Microsoft />} sx={{ flex: 1 }}>Microsoft</Button>
            </Stack>

            <Typography variant="body2" textAlign="center" sx={{ mt: 3 }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: '#006B3F', fontWeight: 600 }}>Sign up</Link>
            </Typography>
          </CardContent>
        </Card>

        <Typography variant="caption" textAlign="center" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Demo: alice@lsbu.ac.uk / Student123! or dr.jane@lsbu.ac.uk / Tutor123!
        </Typography>
      </Container>
    </Box>
  );
}
