import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Card, CardContent, Typography, TextField, Button, Box, Alert,
  Divider, Stack, IconButton, InputAdornment, CircularProgress, Fade,
} from '@mui/material';
import { Visibility, VisibilityOff, Google, Microsoft } from '@mui/icons-material';
import { PublicClientApplication } from '@azure/msal-browser';


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

function getDashboardRoute(profile) {
  if (profile?.role === 'admin') return '/admin-dashboard';
  if (profile?.role === 'tutor') return '/tutor-dashboard';
  return '/dashboard';
}


export default function Login() {
  const navigate = useNavigate();
  const { login, updateUser, fetchFullProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const microsoftClientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  const authBusy = loading || redirecting;

  const navigateToDashboard = useCallback((profile) => {
    setRedirecting(true);
    window.setTimeout(() => {
      navigate(getDashboardRoute(profile), { replace: true });
    }, 350);
  }, [navigate]);

  const microsoftMsalInstance = useMemo(() => {
    if (!microsoftClientId) return null;

    return new PublicClientApplication({
      auth: {
        clientId: microsoftClientId,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: `${window.location.origin}/login`,
        navigateToLoginRequestUrl: false,
      },
      cache: {
        cacheLocation: 'sessionStorage',
      },
    });
  }, [microsoftClientId]);


  useEffect(() => {
    if (!microsoftMsalInstance) return;

    let cancelled = false;

    const completeMicrosoftRedirect = async () => {
      try {
        await microsoftMsalInstance.initialize();
        const loginResponse = await microsoftMsalInstance.handleRedirectPromise();

        if (!loginResponse || cancelled) return;

        setLoading(true);

        const res = await api.post('/auth/microsoft/', {
          id_token: loginResponse.idToken,
        });

        localStorage.setItem('tokens', JSON.stringify(res.data.tokens));
        localStorage.setItem('user', JSON.stringify(res.data.user));
        updateUser(res.data.user);
        const profile = await fetchFullProfile();
        if (!cancelled) navigateToDashboard(profile || res.data.user);
      } catch (err) {
        console.error('Microsoft redirect login error:', err);
        setError(
          err.response?.data?.error ||
          err.errorMessage ||
          err.message ||
          'Microsoft login failed.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    completeMicrosoftRedirect();

    return () => {
      cancelled = true;
    };
  }, [microsoftMsalInstance, updateUser, fetchFullProfile, navigateToDashboard]);



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const profile = await login(email, password);
      navigateToDashboard(profile);
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
      const profile = await fetchFullProfile();
      navigateToDashboard(profile || res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (!microsoftMsalInstance) return;

    setError('');
    setLoading(true);

    try {
      await microsoftMsalInstance.initialize();

      await microsoftMsalInstance.loginRedirect({
        scopes: ['openid', 'profile', 'email'],
        prompt: 'select_account',
      });
    } catch (err) {
      console.error('Microsoft login error:', err);
      setError(
        err.errorMessage ||
        err.message ||
        'Microsoft login failed.'
      );
      setLoading(false);
    }
  };


  return (
    <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
      <Fade in={authBusy}>
        <Box
          aria-live="polite"
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: (theme) => theme.zIndex.modal + 1,
            display: authBusy ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.76)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Card
            elevation={6}
            sx={{
              width: 'min(320px, calc(100vw - 48px))',
              borderRadius: 3,
              p: 3,
              textAlign: 'center',
            }}
          >
            <Stack spacing={2} alignItems="center">
              <CircularProgress size={36} thickness={4} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {redirecting ? 'Taking you to your dashboard' : 'Signing you in'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Preparing your workspace...
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Box>
      </Fade>
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
              <Button fullWidth variant="contained" size="large" type="submit" disabled={authBusy}>
                {loading ? 'Logging in...' : 'Log in'}
              </Button>
            </form>

            <Divider sx={{ my: 3 }}>or continue with</Divider>
            <Stack direction="row" spacing={2} justifyContent="center">
              {googleClientId ? (
                <GoogleOAuthProvider clientId={googleClientId}>
                  <GoogleSignInButton
                    disabled={authBusy}
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google login failed. Please try again.')}
                  />
                </GoogleOAuthProvider>
              ) : (
                <Button variant="outlined" startIcon={<Google />} sx={{ flex: 1 }} disabled>
                  Google
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<Microsoft />}
                sx={{ flex: 1 }}
                disabled={!microsoftClientId || authBusy}
                onClick={handleMicrosoftLogin}
              >
                Microsoft
              </Button>
            </Stack>

            <Typography variant="body2" textAlign="center" sx={{ mt: 3 }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: '#006B3F', fontWeight: 600 }}>Sign up</Link>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
