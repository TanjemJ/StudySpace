import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Box, Container, Card, CardContent, Typography, TextField, Button, Alert,
  Stepper, Step, StepLabel, ToggleButtonGroup, ToggleButton, FormControlLabel,
  Checkbox, IconButton, InputAdornment, MenuItem, Stack, LinearProgress,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Person, School, CloudUpload, InsertDriveFile, Close,
  CheckCircle, Cancel as CancelIcon,
} from '@mui/icons-material';
import { evaluatePassword, noPasteProps } from '../utils/passwordRules';


const SESSION_KEY = 'studyspace_signup_state';

function loadSessionState() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSessionState(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

function clearSessionState() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// ---- Password strength UI (rule checklist + meter) ----------------------

function PasswordStrengthChecklist({ password, context }) {
  if (!password) return null;
  const { results, score, label, color } = evaluatePassword(password, context);
  const pct = Math.min(100, Math.round((score / 7) * 100));

  return (
    <Box sx={{ mt: 0.5 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ height: 6, borderRadius: 3 }}
      />
      <Typography variant="caption" sx={{ color: `${color}.main`, fontWeight: 600 }}>
        {label}
      </Typography>
      <Stack spacing={0.25} sx={{ mt: 0.5 }}>
        {results.map((r) => (
          <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {r.pass ? (
              <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
            ) : (
              <CancelIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            )}
            <Typography
              variant="caption"
              sx={{ color: r.pass ? 'success.main' : 'text.secondary' }}
            >
              {r.label}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

// ---- Step labels + upload config ----------------------------------------

const studentSteps = ['Account', 'Verify Email', 'Personal Info', 'University (Optional)'];
const tutorSteps = ['Account', 'Verify Email', 'Personal Info', 'Verification', 'Rate, Experience & Location', 'Documents'];

const universities = [
  'London South Bank University', 'Kings College London', 'University College London',
  'Imperial College London', 'Queen Mary University', 'City University London',
  'University of Greenwich', 'University of Westminster', 'Other',
];

const MAX_DOCS = 5;
const MAX_SIZE_MB = 10;
const ALLOWED_EXTS = /\.(pdf|jpg|jpeg|png)$/i;

export default function SignUp() {
  const navigate = useNavigate();
  const { updateUser, fetchFullProfile } = useAuth();

  const [role, setRole] = useState('student');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [registrationId, setRegistrationId] = useState(null);
  const [resumedBanner, setResumedBanner] = useState(false);

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
  const [universityEmail, setUniversityEmail] = useState('');

  // Tutor steps
  const [companyEmail, setCompanyEmail] = useState('');
  const [subjects, setSubjects] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [experience, setExperience] = useState('');
  const [personalStatement, setPersonalStatement] = useState('');
  // New (2026-04-25): tutor approximate location for in-person bookings.
  const [locationCity, setLocationCity] = useState('');
  const [locationPostcodeArea, setLocationPostcodeArea] = useState('');

  // Tutor step 5 — documents
  const [documents, setDocuments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const steps = role === 'student' ? studentSteps : tutorSteps;

  // ---- Session resume on mount ----
  useEffect(() => {
    const saved = loadSessionState();
    if (!saved) return;

    if (saved.registrationId && !saved.userId) {
      setEmail(saved.email || '');
      setRole(saved.role || 'student');
      setRegistrationId(saved.registrationId);
      setStep(1);
      setResumedBanner(true);
      return;
    }

    if (saved.userId) {
      setEmail(saved.email || '');
      setRole(saved.role || 'student');
      setUserId(saved.userId);
      setStep(saved.step || 2);
      setResumedBanner(true);
    }
  }, []);

  useEffect(() => {
    if (step === 0) return;
    saveSessionState({
      email,
      role,
      step,
      registrationId,
      userId,
    });
  }, [email, role, step, registrationId, userId]);

  const finishSignup = async (res) => {
    clearSessionState();
    localStorage.setItem('tokens', JSON.stringify(res.data.tokens));
    updateUser(res.data.user);
    await fetchFullProfile();
    navigate('/dashboard');
  };

  // ---------- step handlers ----------

  const handleStep1 = async () => {
    if (!agreed) { setError('Please agree to the terms.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    const strength = evaluatePassword(password, { email });
    if (!strength.allPass) {
      setError('Please choose a stronger password — see the checklist below.');
      return;
    }

    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/step1/', {
        email, password, confirm_password: confirmPassword, role,
      });
      setRegistrationId(res.data.registration_id || null);
      setDevCode(res.data.dev_code || '');
      setStep(1);
    } catch (err) {
      const data = err.response?.data || {};
      const msg =
        (Array.isArray(data.email) && data.email[0]) ||
        (Array.isArray(data.password) && data.password[0]) ||
        (typeof data.password === 'string' && data.password) ||
        data.error ||
        'Registration failed.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/verify-code/', { email, code });
      if (res.data.user_id) setUserId(res.data.user_id);
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
      const data = err.response?.data || {};
      const msg =
        (Array.isArray(data.display_name) && data.display_name[0]) ||
        data.error ||
        'Failed to save details.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleStudentStep3 = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/step3/student/', {
        user_id: userId,
        university,
        university_email: universityEmail,
        course,
        year_of_study: yearOfStudy ? parseInt(yearOfStudy, 10) : null,
      });
      await finishSignup(res);
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
      const data = err.response?.data || {};
      const msg =
        (Array.isArray(data.company_email) && data.company_email[0]) ||
        data.error ||
        'Failed to save subjects.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleTutorStep4 = async () => {
    if (!locationCity.trim()) {
      setError('Please tell us which city you\'re based in — students need this for in-person bookings.');
      return;
    }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register/step4/tutor/', {
        user_id: userId,
        hourly_rate: parseFloat(hourlyRate),
        experience_years: parseInt(experience, 10),
        personal_statement: personalStatement,
        location_city: locationCity.trim(),
        location_postcode_area: locationPostcodeArea.trim().toUpperCase(),
      });
      setStep(5);
    } catch (err) {
      const data = err.response?.data || {};
      const msg =
        (Array.isArray(data.location_city) && data.location_city[0]) ||
        data.error ||
        'Failed to save rate. Please try again.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleTutorStep5 = async () => {
    if (documents.length === 0) {
      setError('Please upload at least one verification document.');
      return;
    }
    setError(''); setLoading(true);
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('document_count', documents.length);
    documents.forEach((d, i) => {
      formData.append(`document_${i}`, d.file);
      formData.append(`document_${i}_type`, d.type || 'other');
    });
    try {
      const res = await api.post('/auth/register/step5/tutor/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await finishSignup(res);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally { setLoading(false); }
  };

  // ---- file drop/select ----
  const acceptFiles = (files) => {
    const incoming = Array.from(files);
    const next = [...documents];
    for (const f of incoming) {
      if (next.length >= MAX_DOCS) break;
      if (!ALLOWED_EXTS.test(f.name)) continue;
      if (f.size > MAX_SIZE_MB * 1024 * 1024) continue;
      next.push({ file: f, type: 'other' });
    }
    setDocuments(next);
  };
  const onDrop = (e) => {
    e.preventDefault(); setDragActive(false);
    acceptFiles(e.dataTransfer.files);
  };
  const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = () => setDragActive(false);

  const handleStartOver = () => {
    clearSessionState();
    setStep(0);
    setEmail(''); setPassword(''); setConfirmPassword('');
    setUserId(null); setRegistrationId(null);
    setResumedBanner(false);
    setError('');
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

            {resumedBanner && (
              <Alert
                severity="info"
                onClose={() => setResumedBanner(false)}
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={handleStartOver}>
                    Start over
                  </Button>
                }
              >
                We saved your progress — continue where you left off.
              </Alert>
            )}

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
                <PasswordStrengthChecklist password={password} context={{ email }} />

                <TextField
                  fullWidth
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  sx={{ mb: 2, mt: 1.5 }}
                  required
                  helperText="Please re-type your password — paste is disabled on this field."
                  {...noPasteProps()}
                />

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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  The code expires in 30 minutes. If you close the tab, you can return to this page
                  and pick up where you left off.
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
                <TextField
                  fullWidth
                  label="University email (optional)"
                  type="email"
                  value={universityEmail}
                  onChange={(e) => setUniversityEmail(e.target.value)}
                  helperText="If your account email is already a recognised university email, it will be verified automatically. Otherwise, you can verify it later in Settings."
                  sx={{ mb: 2 }}
                />
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
                  helperText="Comma separated, e.g. Mathematics, Physics, Computer Science"
                  sx={{ mb: 2 }} required />
                <Button fullWidth variant="contained" size="large" onClick={handleTutorStep3} disabled={loading}>
                  Continue
                </Button>
              </>
            )}

            {/* Tutor Step 4 — rate, experience, location */}
            {step === 4 && role === 'tutor' && (
              <>
                <TextField fullWidth type="number" label="Hourly rate (£)" value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)} sx={{ mb: 2 }} required
                  inputProps={{ min: 0, step: 0.5 }} />
                <TextField fullWidth type="number" label="Years of experience" value={experience}
                  onChange={(e) => setExperience(e.target.value)} sx={{ mb: 2 }} required
                  inputProps={{ min: 0 }} />
                <TextField fullWidth multiline rows={3} label="Personal statement (optional)"
                  value={personalStatement}
                  onChange={(e) => setPersonalStatement(e.target.value)}
                  helperText="Briefly describe your teaching style and what students can expect."
                  sx={{ mb: 3 }} />

                <Typography variant="h6" sx={{ mb: 1 }}>Approximate location</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Shown on your public profile so students can see roughly where you're based.
                  This is approximate only — never share your full address.
                </Typography>

                <TextField
                  fullWidth label="City / town" value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="e.g. London"
                  sx={{ mb: 2 }} required
                />
                <TextField
                  fullWidth label="Postcode area (optional)" value={locationPostcodeArea}
                  onChange={(e) => setLocationPostcodeArea(e.target.value)}
                  placeholder="e.g. SE1"
                  helperText="Just the first part of your UK postcode (1–4 chars). Leave blank if you're not in the UK."
                  inputProps={{ maxLength: 10 }}
                  sx={{ mb: 2 }}
                />

                <Button fullWidth variant="contained" size="large" onClick={handleTutorStep4} disabled={loading}>
                  {loading ? 'Saving...' : 'Continue'}
                </Button>
              </>
            )}

            {/* Tutor Step 5: Documents */}
            {step === 5 && role === 'tutor' && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Upload up to {MAX_DOCS} verification documents (ID, qualifications, DBS). PDF/JPG/PNG, ≤ {MAX_SIZE_MB}MB each.
                </Typography>
                <Box
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    border: '2px dashed',
                    borderColor: dragActive ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    mb: 2,
                    bgcolor: dragActive ? 'action.hover' : 'transparent',
                  }}
                >
                  <CloudUpload sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                  <Typography>Drag & drop files or click to browse</Typography>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => acceptFiles(e.target.files)}
                  />
                </Box>

                <Stack spacing={1} sx={{ mb: 2 }}>
                  {documents.map((d, i) => (
                    <Card variant="outlined" key={i}>
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <InsertDriveFile sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ flex: 1 }}>{d.file.name}</Typography>
                        <TextField
                          select size="small" value={d.type}
                          onChange={(e) => {
                            const next = [...documents];
                            next[i] = { ...next[i], type: e.target.value };
                            setDocuments(next);
                          }}
                        >
                          <MenuItem value="photo_id">Photo ID</MenuItem>
                          <MenuItem value="qualification">Qualification</MenuItem>
                          <MenuItem value="dbs">DBS</MenuItem>
                          <MenuItem value="other">Other</MenuItem>
                        </TextField>
                        <IconButton size="small" onClick={() => {
                          setDocuments(documents.filter((_, j) => j !== i));
                        }}>
                          <Close fontSize="small" />
                        </IconButton>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>

                <Button fullWidth variant="contained" size="large" onClick={handleTutorStep5} disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit for Verification'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
