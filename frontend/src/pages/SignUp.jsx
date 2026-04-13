import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Card, CardContent, Typography, TextField, Button, Box, Alert, Stepper, Step,
  StepLabel, ToggleButtonGroup, ToggleButton, Divider, Stack, LinearProgress,
  IconButton, InputAdornment, Checkbox, FormControlLabel, MenuItem,
} from '@mui/material';
import { Visibility, VisibilityOff, Google, Microsoft, School, Person } from '@mui/icons-material';

function PasswordStrength({ password }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) score++;
  const pct = (score / 6) * 100;
  const color = pct < 34 ? 'error' : pct < 67 ? 'warning' : 'success';
  const label = pct < 34 ? 'Weak' : pct < 67 ? 'Fair' : 'Strong';
  if (!password) return null;
  return (
    <Box sx={{ mt: 0.5 }}>
      <LinearProgress variant="determinate" value={pct} color={color} sx={{ height: 6, borderRadius: 3 }} />
      <Typography variant="caption" color={`${color}.main`}>{label}</Typography>
    </Box>
  );
}

const studentSteps = ['Account', 'Verify Email', 'Personal Info', 'University (Optional)'];
const tutorSteps = ['Account', 'Verify Email', 'Personal Info', 'Verification', 'Rate & Experience', 'Documents'];

const universities = [
  'London South Bank University', 'Kings College London', 'University College London',
  'Imperial College London', 'Queen Mary University', 'City University London',
  'University of Greenwich', 'University of Westminster', 'Other',
];

export default function SignUp() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [role, setRole] = useState('student');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  // Step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Step 1b - verify
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');

  // Step 2
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dob, setDob] = useState('');

  // Step 3 student
  const [university, setUniversity] = useState('');
  const [course, setCourse] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');

  // Tutor steps
  const [companyEmail, setCompanyEmail] = useState('');
  const [subjects, setSubjects] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [experience, setExperience] = useState('');
  const [personalStatement, setPersonalStatement] = useState('');

  const steps = role === 'student' ? studentSteps : tutorSteps;

  const handleStep1 = async () => {
    if (!agreed) { setError('Please agree to the terms.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/step1/', { email, password, confirm_password: confirmPassword, role });
      setUserId(res.data.user_id);
      setDevCode(res.data.dev_code || '');
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.email?.[0] || err.response?.data?.password?.[0] || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register/verify-code/', { email, code });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code.');
    } finally { setLoading(false); }
  };

  const handleStep2 = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register/step2/', { user_id: userId, first_name: firstName, last_name: lastName, display_name: displayName, date_of_birth: dob || undefined });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.display_name?.[0] || 'Please check your details.');
    } finally { setLoading(false); }
  };

  const handleStudentStep3 = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/step3/student/', { user_id: userId, university, course, year_of_study: yearOfStudy || undefined });
      localStorage.setItem('tokens', JSON.stringify(res.data.tokens));
      updateUser(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError('Something went wrong.');
    } finally { setLoading(false); }
  };

  const handleTutorStep3 = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register/step3/tutor/', { user_id: userId, company_email: companyEmail, subjects: subjects.split(',').map(s => s.trim()) });
      setStep(4);
    } catch (err) {
      setError('Please check your details.');
    } finally { setLoading(false); }
  };

  const handleTutorStep4 = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register/step4/tutor/', { user_id: userId, hourly_rate: hourlyRate, experience_years: experience, personal_statement: personalStatement });
      setStep(5);
    } catch (err) {
      setError('Please check your details.');
    } finally { setLoading(false); }
  };

  const handleTutorStep5 = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/step5/tutor/', { user_id: userId });
      localStorage.setItem('tokens', JSON.stringify(res.data.tokens));
      updateUser(res.data.user);
      navigate('/tutor-dashboard');
    } catch (err) {
      setError('Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="sm">
        <Card sx={{ p: 1 }}>
          <CardContent>
            <Typography variant="h3" textAlign="center" color="primary" sx={{ mb: 2 }}>Create Account</Typography>

            {/* Role toggle */}
            {step === 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <ToggleButtonGroup value={role} exclusive onChange={(_, v) => v && setRole(v)} size="small">
                  <ToggleButton value="student"><Person sx={{ mr: 1 }} /> Student</ToggleButton>
                  <ToggleButton value="tutor"><School sx={{ mr: 1 }} /> Tutor</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}

            <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
              {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Step 0: Email & Password */}
            {step === 0 && (
              <>
                <TextField fullWidth label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} required />
                <TextField fullWidth label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 0.5 }} required
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} size="small">{showPassword ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> }} />
                <PasswordStrength password={password} />
                <TextField fullWidth label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} sx={{ mb: 2, mt: 1.5 }} required />
                <FormControlLabel control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">I agree to the Terms & Conditions and Privacy Policy</Typography>} sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large" onClick={handleStep1} disabled={loading}>
                  {loading ? 'Creating account...' : 'Continue'}
                </Button>
                <Divider sx={{ my: 2 }}>or sign up with</Divider>
                <Stack direction="row" spacing={2}>
                  <Button variant="outlined" startIcon={<Google />} fullWidth>Google</Button>
                  <Button variant="outlined" startIcon={<Microsoft />} fullWidth>Microsoft</Button>
                </Stack>
                <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
                  Already have an account? <Link to="/login" style={{ color: '#006B3F', fontWeight: 600 }}>Log in</Link>
                </Typography>
              </>
            )}

            {/* Step 1: Verify email */}
            {step === 1 && (
              <>
                <Typography textAlign="center" sx={{ mb: 1 }}>We've sent a 6-digit code to <strong>{email}</strong></Typography>
                {devCode && <Alert severity="info" sx={{ mb: 2 }}>Dev mode — your code is: <strong>{devCode}</strong></Alert>}
                <TextField fullWidth label="Verification code" value={code} onChange={(e) => setCode(e.target.value)} sx={{ mb: 2 }} inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: 24, letterSpacing: 8 } }} />
                <Button fullWidth variant="contained" size="large" onClick={handleVerify} disabled={loading}>Verify</Button>
                <Button fullWidth sx={{ mt: 1 }} onClick={() => api.post('/auth/register/resend-code/', { email }).then(r => setDevCode(r.data.dev_code || ''))}>
                  Resend code
                </Button>
              </>
            )}

            {/* Step 2: Personal info */}
            {step === 2 && (
              <>
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                  <TextField fullWidth label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  <TextField fullWidth label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </Stack>
                <TextField fullWidth label="Username (public)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} helperText="This will be visible to all users" sx={{ mb: 2 }} required />
                <TextField fullWidth label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large" onClick={handleStep2} disabled={loading}>Continue</Button>
              </>
            )}

            {/* Step 3: Student — university */}
            {step === 3 && role === 'student' && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Verifying your university gives you access to university-specific forums. This step is optional.
                </Typography>
                <TextField fullWidth select label="University" value={university} onChange={(e) => setUniversity(e.target.value)} sx={{ mb: 2 }}>
                  <MenuItem value="">— Skip this step —</MenuItem>
                  {universities.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                </TextField>
                <TextField fullWidth label="Course name" value={course} onChange={(e) => setCourse(e.target.value)} sx={{ mb: 2 }} />
                <TextField fullWidth select label="Year of study" value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} sx={{ mb: 2 }}>
                  {[1,2,3,4].map(y => <MenuItem key={y} value={y}>Year {y}</MenuItem>)}
                  <MenuItem value={5}>Postgraduate</MenuItem>
                </TextField>
                <Button fullWidth variant="contained" size="large" onClick={handleStudentStep3} disabled={loading}>
                  {loading ? 'Finishing...' : 'Complete Registration'}
                </Button>
                <Button fullWidth sx={{ mt: 1 }} onClick={handleStudentStep3}>Skip for now</Button>
              </>
            )}

            {/* Tutor Step 3: Subjects + company email */}
            {step === 3 && role === 'tutor' && (
              <>
                <TextField fullWidth label="University / Company email" type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} helperText="Required for tutor verification" sx={{ mb: 2 }} required />
                <TextField fullWidth label="Subjects you teach" value={subjects} onChange={(e) => setSubjects(e.target.value)} helperText="Comma separated, e.g. Mathematics, Physics, Calculus" sx={{ mb: 2 }} required />
                <Button fullWidth variant="contained" size="large" onClick={handleTutorStep3} disabled={loading}>Continue</Button>
              </>
            )}

            {/* Tutor Step 4: Rate & experience */}
            {step === 4 && role === 'tutor' && (
              <>
                <TextField fullWidth label="Hourly rate (£)" type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} sx={{ mb: 2 }} required />
                <TextField fullWidth label="Years of experience" type="number" value={experience} onChange={(e) => setExperience(e.target.value)} sx={{ mb: 2 }} required />
                <TextField fullWidth label="Personal statement / motivation" multiline rows={4} value={personalStatement} onChange={(e) => setPersonalStatement(e.target.value)} helperText="Tell students why they should choose you" sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large" onClick={handleTutorStep4} disabled={loading}>Continue</Button>
              </>
            )}

            {/* Tutor Step 5: Documents */}
            {step === 5 && role === 'tutor' && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Upload your verification documents. Your profile will be reviewed by our admin team before going live.
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>Document upload will be available after registration. You can add documents from your dashboard.</Alert>
                <Button fullWidth variant="contained" size="large" onClick={handleTutorStep5} disabled={loading}>
                  {loading ? 'Finishing...' : 'Complete Registration'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
