import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container, Card, CardContent, Typography, TextField, Button, Box, Alert,
  Divider, Stack, IconButton, InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff, Google, Microsoft } from '@mui/icons-material';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
              <Button variant="outlined" startIcon={<Google />} sx={{ flex: 1 }}>Google</Button>
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
