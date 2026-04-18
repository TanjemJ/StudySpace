import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Box, Container, Card, CardContent, Typography, TextField, Button, Alert,
  Stepper, Step, StepLabel, ToggleButtonGroup, ToggleButton, FormControlLabel,
  Checkbox, IconButton, InputAdornment, MenuItem, LinearProgress, Stack, Select,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Person, School, CloudUpload, InsertDriveFile, Close,
} from '@mui/icons-material';

function PasswordStrength({ password }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
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

// --- Document upload config ---
const MAX_DOCS = 5;
const MAX_SIZE_MB = 10;
const ALLOWED_EXTS = /\.(pdf|jpg|jpeg|png)$/i;

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

  // Tutor step 5 — documents (NEW)
  const [documents, setDocuments] = useState([]); // [{ file, type }]
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const steps = role === 'student' ? studentSteps : tutorSteps;

  // ---------- step handlers ----------

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

  const handleVerifyCode = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register/verify-code/', { email, code });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed.');
    } finally { setLoading(false); }
  };

  const handleResendCode = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/resend-code/', { email });
      setDevCode(res.data.dev_code || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code.');
    } finally { setLoading(false); }
  };

  const handleStep2 = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register/step2/', {
        user_id: userId, first_name: firstName, last_name: lastName,
        display_name: displayName, date_of_birth: dob || null,
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.display_name?.[0] || 'Failed to save details.');
    } finally { setLoading(false); }
  };

  const handleStudentStep3 = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/step3/student/', {
        user_id: userId, university, course,
        year_of_study: yearOfStudy ? parseInt(yearOfStudy, 10) : null,
      });
      localStorage.setItem('tokens', JSON.stringify(res.data.tokens));
      updateUser(res.data.user);
      navigate('/dashboard');
    } catch {
      setError('Something went wrong.');
    } finally { setLoading(false); }
  };

  const handleTutorStep3 = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register/step3/tutor/', {
        user_id: userId, company_email: companyEmail,
        subjects: subjects.split(',').map(s => s.trim()).filter(Boolean),
      });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.company_email?.[0] || 'Failed to save subjects.');
    } finally { setLoading(false); }
  };

  const handleTutorStep4 = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register/step4/tutor/', {
        user_id: userId,
        hourly_rate: parseFloat(hourlyRate),
        experience_years: parseInt(experience, 10),
        personal_statement: personalStatement,
      });
      setStep(5);
    } catch {
      setError('Failed to save rate.');
    } finally { setLoading(false); }
  };

  // ---------- document handlers (NEW for step 5) ----------

  const addFiles = (files) => {
    setError('');
    if (documents.length + files.length > MAX_DOCS) {
      setError(`Maximum ${MAX_DOCS} documents allowed (${documents.length} already added).`);
      return;
    }
    const valid = [];
    for (const f of files) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${f.name} exceeds the ${MAX_SIZE_MB}MB limit.`);
        return;
      }
      if (!ALLOWED_EXTS.test(f.name)) {
        setError(`${f.name} must be PDF, JPG, or PNG.`);
        return;
      }
      valid.push({ file: f, type: 'qualification' });
    }
    setDocuments(prev => [...prev, ...valid]);
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) addFiles(files);
    // Reset so picking the same file twice still fires onChange
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const updateDocType = (i, type) => {
    setDocuments(prev => prev.map((d, idx) => idx === i ? { ...d, type } : d));
  };

  const removeDoc = (i) => {
    setDocuments(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleTutorStep5 = async () => {
    if (documents.length === 0) {
      setError('Please upload at least one verification document.');
      return;
    }
    setError(''); setLoading(true);
    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('document_count', documents.length.toString());
      documents.forEach((d, i) => {
        formData.append(`document_${i}`, d.file);
        formData.append(`document_${i}_type`, d.type);
      });
      const res = await api.post('/auth/register/step5/tutor/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      localStorage.setItem('tokens', JSON.stringify(res.data.tokens));
      updateUser(res.data.user);
      navigate('/tutor-dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally { setLoading(false); }
  };

  // ---------- render ----------

  return (
    <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="sm">
        <Card sx={{ p: 1 }}>
          <CardContent>
            <Typography variant="h3" textAlign="center" color="primary" sx={{ mb: 2 }}>
              Create Account
            </Typography>

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

            {/* Step 0 */}
            {step === 0 && (
              <>
                <TextField fullWidth label="Email address" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} required />
                <TextField fullWidth label="Password" type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  sx={{ mb: 0.5 }} required
                  InputProps={{ endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ) }} />
                <PasswordStrength password={password} />
                <TextField fullWidth label="Confirm password" type="password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} sx={{ mb: 2, mt: 1.5 }} required />
                <FormControlLabel control={<Checkbox checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">I agree to the Terms & Conditions and Privacy Policy</Typography>}
                  sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large" onClick={handleStep1} disabled={loading}>
                  {loading ? 'Creating...' : 'Continue'}
                </Button>
              </>
            )}

            {/* Step 1: Verify */}
            {step === 1 && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  We sent a 6-digit code to {email}. Enter it below to verify your email.
                </Typography>
                {devCode && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Development mode — your code is: <strong>{devCode}</strong>
                  </Alert>
                )}
                <TextField fullWidth label="Verification code" value={code}
                  onChange={(e) => setCode(e.target.value)} sx={{ mb: 2 }} required
                  inputProps={{ maxLength: 6 }} />
                <Button fullWidth variant="contained" size="large" onClick={handleVerifyCode} disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify'}
                </Button>
                <Button fullWidth sx={{ mt: 1 }} onClick={handleResendCode} disabled={loading}>
                  Resend code
                </Button>
              </>
            )}

            {/* Step 2: personal info */}
            {step === 2 && (
              <>
                <TextField fullWidth label="First name" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} sx={{ mb: 2 }} required />
                <TextField fullWidth label="Last name" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} sx={{ mb: 2 }} required />
                <TextField fullWidth label="Display name (username)" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  helperText="This is what other users will see. Changeable every 90 days."
                  sx={{ mb: 2 }} required />
                <TextField fullWidth label="Date of birth" type="date" value={dob}
                  onChange={(e) => setDob(e.target.value)} InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large" onClick={handleStep2} disabled={loading}>
                  Continue
                </Button>
              </>
            )}

            {/* Student Step 3 */}
            {step === 3 && role === 'student' && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  University details are optional — you can add them later in Settings.
                </Typography>
                <TextField fullWidth select label="University" value={university}
                  onChange={(e) => setUniversity(e.target.value)} sx={{ mb: 2 }}>
                  <MenuItem value="">— Skip this step —</MenuItem>
                  {universities.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                </TextField>
                <TextField fullWidth label="Course name" value={course}
                  onChange={(e) => setCourse(e.target.value)} sx={{ mb: 2 }} />
                <TextField fullWidth select label="Year of study" value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)} sx={{ mb: 2 }}>
                  {[1,2,3,4].map(y => <MenuItem key={y} value={y}>Year {y}</MenuItem>)}
                  <MenuItem value={5}>Postgraduate</MenuItem>
                </TextField>
                <Button fullWidth variant="contained" size="large" onClick={handleStudentStep3} disabled={loading}>
                  {loading ? 'Finishing...' : 'Complete Registration'}
                </Button>
                <Button fullWidth sx={{ mt: 1 }} onClick={handleStudentStep3}>Skip for now</Button>
              </>
            )}

            {/* Tutor Step 3 */}
            {step === 3 && role === 'tutor' && (
              <>
                <TextField fullWidth label="University / Company email" type="email" value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  helperText="Required for tutor verification" sx={{ mb: 2 }} required />
                <TextField fullWidth label="Subjects you teach" value={subjects}
                  onChange={(e) => setSubjects(e.target.value)}
                  helperText="Comma separated, e.g. Mathematics, Physics, Calculus" sx={{ mb: 2 }} required />
                <Button fullWidth variant="contained" size="large" onClick={handleTutorStep3} disabled={loading}>
                  Continue
                </Button>
              </>
            )}

            {/* Tutor Step 4 */}
            {step === 4 && role === 'tutor' && (
              <>
                <TextField fullWidth label="Hourly rate (£)" type="number" value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)} sx={{ mb: 2 }} required />
                <TextField fullWidth label="Years of experience" type="number" value={experience}
                  onChange={(e) => setExperience(e.target.value)} sx={{ mb: 2 }} required />
                <TextField fullWidth label="Personal statement / motivation" multiline rows={4}
                  value={personalStatement} onChange={(e) => setPersonalStatement(e.target.value)}
                  helperText="Tell students why they should choose you" sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large" onClick={handleTutorStep4} disabled={loading}>
                  Continue
                </Button>
              </>
            )}

            {/* Tutor Step 5: Documents (REPLACED — no more "upload later" placeholder) */}
            {step === 5 && role === 'tutor' && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Upload up to {MAX_DOCS} verification documents (qualifications, DBS check, photo ID, etc.).
                  Max {MAX_SIZE_MB}MB per file. PDF, JPG, or PNG only.
                </Typography>

                {/* Drop zone */}
                <Box
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  sx={{
                    border: '2px dashed',
                    borderColor: dragActive ? 'primary.main' : 'divider',
                    bgcolor: dragActive ? 'action.hover' : 'background.default',
                    borderRadius: 2,
                    p: 4,
                    textAlign: 'center',
                    cursor: 'pointer',
                    mb: 2,
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  }}
                >
                  <CloudUpload sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                  <Typography>Click to browse or drag files here</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {documents.length} / {MAX_DOCS} uploaded
                  </Typography>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                  />
                </Box>

                {/* File list */}
                {documents.length > 0 && (
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    {documents.map((d, i) => (
                      <Card key={i} variant="outlined">
                        <CardContent sx={{ py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                          '&:last-child': { pb: 1.5 } }}>
                          <InsertDriveFile color="primary" />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" noWrap>{d.file.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(d.file.size / 1024 / 1024).toFixed(2)} MB
                            </Typography>
                          </Box>
                          <Select
                            size="small"
                            value={d.type}
                            onChange={(e) => updateDocType(i, e.target.value)}
                            sx={{ minWidth: 140 }}
                          >
                            <MenuItem value="qualification">Qualification</MenuItem>
                            <MenuItem value="photo_id">Photo ID</MenuItem>
                            <MenuItem value="dbs">DBS Certificate</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </Select>
                          <IconButton size="small" onClick={() => removeDoc(i)}>
                            <Close fontSize="small" />
                          </IconButton>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}

                <Alert severity="info" sx={{ mb: 2 }}>
                  Your profile will be reviewed by our admin team. You'll receive a notification when it's approved.
                </Alert>

                <Button
                  fullWidth variant="contained" size="large"
                  onClick={handleTutorStep5}
                  disabled={loading || documents.length === 0}
                >
                  {loading ? 'Submitting...' : 'Submit for Review'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
