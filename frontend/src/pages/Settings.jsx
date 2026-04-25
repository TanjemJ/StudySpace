import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { evaluatePassword, noPasteProps } from '../utils/passwordRules';
import { useAccessibility } from '../contexts/AccessibilityContext';
import {
  Container, Typography, Box, Card, CardContent, TextField, Button, Stack,
  Avatar, Tabs, Tab, Switch, FormControlLabel, Alert, Divider, IconButton,
  Chip, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButtonGroup, ToggleButton, LinearProgress, InputAdornment,
  Radio, RadioGroup, FormControl, FormLabel,
} from '@mui/material';
import {
  Person, Lock, Notifications, Accessibility, Shield, PhotoCamera,
  Delete, Save, Visibility, VisibilityOff, School, Warning,
  CheckCircle, Cancel as CancelIcon,
} from '@mui/icons-material';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ py: 3 }}>{children}</Box> : null;
}

export default function Settings() {
  const { user, fetchFullProfile, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState(0);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [university, setUniversity] = useState('');
  const [course, setCourse] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  // Tutor fields
  const [bio, setBio] = useState('');
  const [subjects, setSubjects] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [experience, setExperience] = useState('');

  // Tutor approximate location (added 2026-04-25)
  const [locationCity, setLocationCity] = useState('');
  const [locationPostcodeArea, setLocationPostcodeArea] = useState('');

  // University verification
  const [universityEmail, setUniversityEmail] = useState('');
  const [universityCode, setUniversityCode] = useState('');
  const [sendingUniversityCode, setSendingUniversityCode] = useState(false);
  const [verifyingUniversityCode, setVerifyingUniversityCode] = useState(false);
  const [universityCodeSent, setUniversityCodeSent] = useState(false);

  // Display name
  const [newDisplayName, setNewDisplayName] = useState('');
  const [canChangeName, setCanChangeName] = useState(true);
  const [nameAvailableAt, setNameAvailableAt] = useState(null);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Notifications
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifBooking, setNotifBooking] = useState(true);
  const [notifForum, setNotifForum] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  // Accessibility (available to ALL roles)
  const [textSize, setTextSize] = useState('medium');
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // New accessibility prefs (added 2026-04-24)
  const [underlineLinks, setUnderlineLinks] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [focusRingBoost, setFocusRingBoost] = useState(false);
  // Live preview while the user toggles — applied without saving to the server.
  const { applyPreview, clearPreview } = useAccessibility();

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteReasonOther, setDeleteReasonOther] = useState('');

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name || '');
    setLastName(user.last_name || '');
    setDob(user.date_of_birth || '');
    setNewDisplayName(user.display_name || '');
    setCanChangeName(user.can_change_display_name !== false);
    setNameAvailableAt(user.display_name_change_available_at || null);

    // Accessibility from User model (all roles)
    setTextSize(user.text_size || 'medium');
    setHighContrast(user.high_contrast || false);
    setReducedMotion(user.reduced_motion || false);

    setUnderlineLinks(user.underline_links || false);
    setDyslexiaFont(user.dyslexia_font || false);
    setFocusRingBoost(user.focus_ring_boost || false);

    if (user.student_profile) {
      setUniversity(user.student_profile.university || '');
      setCourse(user.student_profile.course || '');
      setYearOfStudy(user.student_profile.year_of_study || '');
      setUniversityEmail(user.student_profile.university_email || '');

    }
    if (user.tutor_profile) {
      setBio(user.tutor_profile.bio || '');
      setSubjects((user.tutor_profile.subjects || []).join(', '));
      setHourlyRate(user.tutor_profile.hourly_rate || '');
      setExperience(user.tutor_profile.experience_years || '');
      if (!university) setUniversity(user.tutor_profile.university || '');
      setUniversityEmail(user.tutor_profile.company_email || '');
      setLocationCity(user.tutor_profile.location_city || '');
      setLocationPostcodeArea(user.tutor_profile.location_postcode_area || '');
    }
  }, [user]);

  const showMsg = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setSuccess(''); setError(''); }, 4000);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const data = { first_name: firstName, last_name: lastName, date_of_birth: dob || null };
      if (user.role === 'student') {
        data.university = university;
        data.course = course;
        data.year_of_study = yearOfStudy || null;
      }
      if (user.role === 'tutor') {
        data.bio = bio;
        data.subjects = subjects;
        data.hourly_rate = hourlyRate;
        data.experience_years = experience;
        data.university = university;
        data.location_city = locationCity.trim();
        data.location_postcode_area = locationPostcodeArea.trim().toUpperCase();
      }
      await api.patch('/auth/settings/profile/', data);
      await fetchFullProfile();
      showMsg('Profile updated successfully.');
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to update profile.', true);
    } finally { setLoading(false); }
  };

  const handleSendUniversityCode = async () => {
    if (!universityEmail.trim()) {
      showMsg('Please enter a university email first.', true);
      return;
    }

    setSendingUniversityCode(true);
    try {
      const res = await api.post('/auth/settings/university-email/send/', {
        email: universityEmail,
      });

      if (res.data.auto_verified || res.data.already_verified) {
        await fetchFullProfile();
        setUniversityCode('');
        setUniversityCodeSent(false);
        showMsg(res.data.message || 'University email verified automatically.');
      } else {
        setUniversityCodeSent(true);
        showMsg(res.data.message || 'University verification code sent.');
      }
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to send university verification code.', true);
    } finally {
      setSendingUniversityCode(false);
    }
  };


  const handleVerifyUniversityCode = async () => {
    if (!universityCode.trim()) {
      showMsg('Please enter the verification code.', true);
      return;
    }

    setVerifyingUniversityCode(true);
    try {
      const res = await api.post('/auth/settings/university-email/verify/', {
        code: universityCode,
      });
      await fetchFullProfile();
      setUniversityCode('');
      setUniversityCodeSent(false);
      showMsg(res.data.message || 'University email verified successfully.');
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to verify university email.', true);
    } finally {
      setVerifyingUniversityCode(false);
    }
  };


  const handleChangeDisplayName = async () => {
    if (newDisplayName === user.display_name) return;
    setLoading(true);
    try {
      await api.post('/auth/settings/display-name/', { display_name: newDisplayName });
      await fetchFullProfile();
      showMsg('Username changed successfully.');
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to change username.', true);
    } finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    setLoading(true);
    try {
      await api.post('/auth/settings/password/', {
        current_password: currentPw, new_password: newPw, confirm_password: confirmPw,
      });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showMsg('Password changed successfully.');
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to change password.', true);
    } finally { setLoading(false); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      await api.post('/auth/settings/avatar/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await fetchFullProfile();
      showMsg('Profile picture updated.');
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to upload image.', true);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await api.delete('/auth/settings/avatar/');
      await fetchFullProfile();
      showMsg('Profile picture removed.');
    } catch { showMsg('Failed to remove image.', true); }
  };

  const handleSaveAccessibility = async () => {
    try {
      await api.post('/auth/settings/accessibility/', {
        text_size: textSize,
        high_contrast: highContrast,
        reduced_motion: reducedMotion,
        underline_links: underlineLinks,
        dyslexia_font: dyslexiaFont,
        focus_ring_boost: focusRingBoost,
      });
      clearPreview();           
      await fetchFullProfile();
      showMsg('Accessibility settings updated.');
    } catch { showMsg('Failed to save.', true); }
  };

  const handleDeleteAccount = async () => {
    const reason = deleteReason === 'other' ? deleteReasonOther : deleteReason;
    try {
      await api.post('/auth/settings/delete-account/', { password: deletePassword, reason });
      logout();
      navigate('/');
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to delete account.', true);
      setDeleteOpen(false);
    }
  };

  if (!user) return null;

  const tabs = [
    { label: 'Profile', icon: <Person sx={{ fontSize: 18 }} /> },
    { label: 'Account', icon: <Lock sx={{ fontSize: 18 }} /> },
    { label: 'Notifications', icon: <Notifications sx={{ fontSize: 18 }} /> },
    { label: 'Accessibility', icon: <Accessibility sx={{ fontSize: 18 }} /> },
    { label: 'Privacy', icon: <Shield sx={{ fontSize: 18 }} /> },
  ];

  const universityProfile = user.student_profile || user.tutor_profile || null;
  const universityVerified = Boolean(universityProfile?.university_verified);
  const universityVerificationActive = Boolean(universityProfile?.university_verification_active);
  const universityEmailCanChange = universityProfile?.university_email_can_change !== false;
  const universityVerifiedAt = universityProfile?.university_verified_at
    ? new Date(universityProfile.university_verified_at)
    : null;


  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ mb: 3 }}>Settings</Typography>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', minHeight: 48 } }}>
          {tabs.map((t, i) => <Tab key={i} icon={t.icon} iconPosition="start" label={t.label} />)}
        </Tabs>

        <CardContent sx={{ p: 3 }}>

          {/* ===== PROFILE TAB ===== */}
          <TabPanel value={tab} index={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={user.avatar || undefined}
                  sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 32 }}
                >
                  {user.display_name?.[0]?.toUpperCase()}
                </Avatar>
                <IconButton
                  size="small" onClick={() => fileInputRef.current?.click()}
                  sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: 'white', border: 1, borderColor: 'divider', '&:hover': { bgcolor: 'grey.100' } }}
                >
                  <PhotoCamera sx={{ fontSize: 16 }} />
                </IconButton>
                <input ref={fileInputRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} />
              </Box>
              <Box>
                <Typography variant="h4">{user.display_name}</Typography>
                <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                <Chip label={user.role.charAt(0).toUpperCase() + user.role.slice(1)} size="small" color="primary" variant="outlined" sx={{ mt: 0.5 }} />
                {user.avatar && (
                  <Button size="small" color="error" onClick={handleRemoveAvatar} sx={{ ml: 1 }}>Remove photo</Button>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField fullWidth label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <TextField fullWidth label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Stack>
            <TextField fullWidth label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)}
              InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />

            {user.role === 'student' && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h5" sx={{ mb: 1.5 }}>
                  <School sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                  University Details
                </Typography>
                <TextField
                  fullWidth
                  label="University"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  disabled={universityVerificationActive}
                  sx={{ mb: 2 }}

                  InputProps={{
                    endAdornment: universityVerificationActive ? (
                      <Chip label="Verified" size="small" color="success" />
                    ) : null,
                  }}

                />
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Course"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                  />
                  <TextField
                    fullWidth
                    select
                    label="Year"
                    value={yearOfStudy}
                    onChange={(e) => setYearOfStudy(e.target.value)}
                  >
                    {[1, 2, 3, 4].map((y) => (
                      <MenuItem key={y} value={y}>
                        Year {y}
                      </MenuItem>
                    ))}
                    <MenuItem value={5}>Postgraduate</MenuItem>
                  </TextField>
                </Stack>

                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  University Email Verification
                </Typography>

                <Alert
                  severity={
                    universityVerificationActive
                      ? 'success'
                      : universityVerified
                        ? 'warning'
                        : 'info'
                  }
                  sx={{ mb: 2 }}
                >
                  {universityVerificationActive
                    ? `Verified for ${university || 'your university'}.`
                    : universityVerified
                      ? 'Your previous university verification has expired. Please verify again.'
                      : 'Verify your university email to unlock university-only forum spaces.'}
                </Alert>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    label="University email"
                    value={universityEmail}
                    onChange={(e) => setUniversityEmail(e.target.value)}
                    disabled={universityVerificationActive && !universityEmailCanChange}
                    helperText={
                      universityVerificationActive && !universityEmailCanChange
                        ? 'This verified email is locked for 30 days after verification.'
                        : 'Use your university email ending in a recognised domain.'
                    }
                  />
                  <Button
                    variant="outlined"
                    onClick={handleSendUniversityCode}
                    disabled={
                      !universityEmail.trim() ||
                      sendingUniversityCode ||
                      (universityVerificationActive && !universityEmailCanChange)
                    }
                    sx={{ minWidth: 140, height: 56, whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {sendingUniversityCode
                      ? 'Sending...'
                      : universityCodeSent
                        ? 'Resend Code'
                        : 'Send Code'}
                  </Button>
                </Stack>

                {(universityCodeSent || !universityVerificationActive) && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      fullWidth
                      label="Verification code"
                      value={universityCode}
                      onChange={(e) => setUniversityCode(e.target.value)}
                      inputProps={{ maxLength: 6 }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleVerifyUniversityCode}
                      disabled={!universityCode.trim() || verifyingUniversityCode}
                      sx={{ minWidth: 140, height: 56, whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {verifyingUniversityCode ? 'Verifying...' : 'Verify'}
                    </Button>
                  </Stack>
                )}

                {universityVerifiedAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    Last verified: {universityVerifiedAt.toLocaleDateString('en-GB')}
                  </Typography>
                )}
              </>
            )}


            {user.role === 'tutor' && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h5" sx={{ mb: 1.5 }}>
                  <School sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                  Tutor Profile
                </Typography>
                <TextField
                  fullWidth
                  label="University"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  disabled={universityVerificationActive}
                  sx={{ mb: 2 }}

                  InputProps={{
                    endAdornment: universityVerificationActive ? (
                      <Chip label="Verified" size="small" color="success" />
                    ) : null,
                  }}

                />
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  helperText={`${bio.length}/2000`}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Subjects (comma separated)"
                  value={subjects}
                  onChange={(e) => setSubjects(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Hourly rate (£)"
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                  />
                  <TextField
                    fullWidth
                    label="Years of experience"
                    type="number"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                  />
                </Stack>

                <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>Approximate location</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Shown on your public tutor profile so students can see roughly where you're
                  based. This is approximate only — never share your full address.
                </Typography>

                <TextField
                  fullWidth label="City / town"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="e.g. London"
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth label="Postcode area (optional)"
                  value={locationPostcodeArea}
                  onChange={(e) => setLocationPostcodeArea(e.target.value)}
                  placeholder="e.g. SE1"
                  helperText="Just the first part of your UK postcode (1–4 chars). Leave blank if you're not in the UK."
                  inputProps={{ maxLength: 10 }}
                  sx={{ mb: 2 }}
                />

                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  University or Company Email Verification
                </Typography>

                <Alert
                  severity={
                    universityVerificationActive
                      ? 'success'
                      : universityVerified
                        ? 'warning'
                        : 'info'
                  }
                  sx={{ mb: 2 }}
                >
                  {universityVerificationActive
                    ? `Verified for ${university || 'your institution'}.`
                    : universityVerified
                      ? 'Your previous verification has expired. Please verify again.'
                      : 'Verify your university or company email to strengthen your verified tutor profile.'}
                </Alert>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    label="University or company email"
                    value={universityEmail}
                    onChange={(e) => setUniversityEmail(e.target.value)}
                    disabled={universityVerificationActive && !universityEmailCanChange}
                    helperText={
                      universityVerificationActive && !universityEmailCanChange
                        ? 'This verified email is locked for 30 days after verification.'
                        : 'Use a recognised academic or organisation email.'
                    }
                  />
                  <Button
                    variant="outlined"
                    onClick={handleSendUniversityCode}
                    disabled={
                      !universityEmail.trim() ||
                      sendingUniversityCode ||
                      (universityVerificationActive && !universityEmailCanChange)
                    }
                    sx={{ minWidth: 140, height: 56, whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {sendingUniversityCode
                      ? 'Sending...'
                      : universityCodeSent
                        ? 'Resend Code'
                        : 'Send Code'}
                  </Button>
                </Stack>

                {(universityCodeSent || !universityVerificationActive) && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      fullWidth
                      label="Verification code"
                      value={universityCode}
                      onChange={(e) => setUniversityCode(e.target.value)}
                      inputProps={{ maxLength: 6 }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleVerifyUniversityCode}
                      disabled={!universityCode.trim() || verifyingUniversityCode}
                      sx={{ minWidth: 140, height: 56, whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {verifyingUniversityCode ? 'Verifying...' : 'Verify'}
                    </Button>
                  </Stack>
                )}

                {universityVerifiedAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    Last verified: {universityVerifiedAt.toLocaleDateString('en-GB')}
                  </Typography>
                )}
              </>
            )}

            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSaveProfile}
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>

          </TabPanel>

          {/* ===== ACCOUNT TAB ===== */}
          <TabPanel value={tab} index={1}>
            <Typography variant="h4" sx={{ mb: 1 }}>Username</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your public username. Can be changed once every 90 days.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
              <TextField fullWidth label="Username" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)}
                disabled={!canChangeName} />
              <Button variant="outlined" onClick={handleChangeDisplayName}
                disabled={!canChangeName || newDisplayName === user.display_name || loading}>
                Change
              </Button>
            </Stack>
            {!canChangeName && nameAvailableAt && (
              <Typography variant="caption" color="text.secondary">
                Next change available: {new Date(nameAvailableAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Typography>
            )}

            <Divider sx={{ my: 3 }} />

            <Typography variant="h4" sx={{ mb: 1 }}>Email</Typography>
            <TextField fullWidth label="Email address" value={user.email} disabled sx={{ mb: 1 }}
              InputProps={{ endAdornment: user.is_email_verified ? <Chip label="Verified" size="small" color="success" /> : <Chip label="Unverified" size="small" color="warning" /> }} />
            <Typography variant="caption" color="text.secondary">Email cannot be changed. Contact support if needed.</Typography>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h4" sx={{ mb: 2 }}>Change Password</Typography>

            <TextField
              fullWidth
              label="Current password"
              type={showCurrentPw ? 'text' : 'password'}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                      {showCurrentPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="New password"
              type={showNewPw ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              sx={{ mb: 0.5 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowNewPw(!showNewPw)}>
                      {showNewPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Live rule checklist + strength meter (same logic as SignUp). */}
            {newPw && (() => {
              const ev = evaluatePassword(newPw, {
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                displayName: user.display_name,
              });
              return (
                <Box sx={{ mb: 1.5, mt: 0.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.round((ev.score / 7) * 100))}
                    color={ev.color}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                  <Typography variant="caption" sx={{ color: `${ev.color}.main`, fontWeight: 600 }}>
                    {ev.label}
                  </Typography>
                  <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                    {ev.results.map((r) => (
                      <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {r.pass
                          ? <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
                          : <CancelIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
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
            })()}

            <TextField
              fullWidth
              label="Confirm new password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              sx={{ mb: 2, mt: 1.5 }}
              helperText="Please re-type your new password — paste is disabled on this field."
              {...noPasteProps()}
            />

            <Button
              variant="contained"
              onClick={handleChangePassword}
              disabled={
                !currentPw ||
                !newPw ||
                newPw !== confirmPw ||
                !evaluatePassword(newPw, {
                  email: user.email,
                  firstName: user.first_name,
                  lastName: user.last_name,
                  displayName: user.display_name,
                }).allPass ||
                loading
              }
            >
              Change Password
            </Button>

          </TabPanel>

          {/* ===== NOTIFICATIONS TAB ===== */}
          <TabPanel value={tab} index={2}>
            <Typography variant="h4" sx={{ mb: 2 }}>Email Notifications</Typography>
            <Stack spacing={1}>
              <FormControlLabel control={<Switch checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />} label="Email notifications" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 6, mt: -1 }}>Receive important updates via email.</Typography>
              <FormControlLabel control={<Switch checked={notifBooking} onChange={(e) => setNotifBooking(e.target.checked)} />} label="Booking reminders" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 6, mt: -1 }}>Get reminded before upcoming sessions.</Typography>
              <FormControlLabel control={<Switch checked={notifForum} onChange={(e) => setNotifForum(e.target.checked)} />} label="Forum reply notifications" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 6, mt: -1 }}>Notified when someone replies to your posts.</Typography>
              <FormControlLabel control={<Switch checked={notifMarketing} onChange={(e) => setNotifMarketing(e.target.checked)} />} label="Marketing & updates" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 6, mt: -1 }}>News about StudySpace features and tips.</Typography>
            </Stack>
            <Button variant="contained" sx={{ mt: 3 }} onClick={() => showMsg('Notification preferences saved.')}>
              Save Preferences
            </Button>
          </TabPanel>

          {/* ===== ACCESSIBILITY TAB — ALL ROLES ===== */}
          <TabPanel value={tab} index={3}>
            <Typography variant="h4" sx={{ mb: 2 }}>Accessibility Preferences</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Customise your StudySpace experience. Changes preview live as you toggle —
              click <strong>Save</strong> to keep them.
            </Typography>

            <Typography variant="h5" sx={{ mb: 1 }}>Text Size</Typography>
            <ToggleButtonGroup
              value={textSize}
              exclusive
              onChange={(_, v) => {
                if (!v) return;
                setTextSize(v);
                applyPreview({ textSize: v });
              }}
              sx={{ mb: 3 }}
            >
              <ToggleButton value="small"><Typography sx={{ fontSize: 12 }}>Small</Typography></ToggleButton>
              <ToggleButton value="medium"><Typography sx={{ fontSize: 14 }}>Medium</Typography></ToggleButton>
              <ToggleButton value="large"><Typography sx={{ fontSize: 18 }}>Large</Typography></ToggleButton>
              <ToggleButton value="xl"><Typography sx={{ fontSize: 22 }}>Extra Large</Typography></ToggleButton>
            </ToggleButtonGroup>

            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={highContrast}
                    onChange={(e) => {
                      setHighContrast(e.target.checked);
                      applyPreview({ highContrast: e.target.checked });
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography>High contrast mode</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Increases contrast for better readability.
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={reducedMotion}
                    onChange={(e) => {
                      setReducedMotion(e.target.checked);
                      applyPreview({ reducedMotion: e.target.checked });
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography>Reduced motion</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Disables animations and transitions.
                    </Typography>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={underlineLinks}
                    onChange={(e) => {
                      setUnderlineLinks(e.target.checked);
                      applyPreview({ underlineLinks: e.target.checked });
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography>Underline all links</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Makes links easier to spot in text.
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={dyslexiaFont}
                    onChange={(e) => {
                      setDyslexiaFont(e.target.checked);
                      applyPreview({ dyslexiaFont: e.target.checked });
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography>Dyslexia-friendly font</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Switches to a font designed for readers with dyslexia.
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={focusRingBoost}
                    onChange={(e) => {
                      setFocusRingBoost(e.target.checked);
                      applyPreview({ focusRingBoost: e.target.checked });
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography>Stronger focus outlines</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Thicker, higher-contrast outline when navigating with the keyboard.
                    </Typography>
                  </Box>
                }
              />
            </Stack>

            <Button variant="contained" sx={{ mt: 3 }} onClick={handleSaveAccessibility}>
              Save Accessibility Settings
            </Button>
          </TabPanel>

          {/* ===== PRIVACY TAB ===== */}
          <TabPanel value={tab} index={4}>
            <Typography variant="h4" sx={{ mb: 2 }}>Privacy & Data</Typography>

            <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
              <Typography variant="h5" sx={{ mb: 1 }}>Download My Data</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Request a copy of all your StudySpace data including profile, bookings, forum posts, and AI conversations.
              </Typography>
              <Button variant="outlined" disabled>Download Data (Coming Soon)</Button>
            </Card>

            <Card variant="outlined" sx={{ p: 2, borderColor: 'error.light' }}>
              <Typography variant="h5" color="error" sx={{ mb: 1 }}>
                <Warning sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                Delete Account
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Permanently delete your account. Your forum posts will remain but your profile will show as "[Deleted User]". This action cannot be undone.
              </Typography>
              <Button variant="outlined" color="error" startIcon={<Delete />} onClick={() => setDeleteOpen(true)}>
                Delete My Account
              </Button>
            </Card>
          </TabPanel>

        </CardContent>
      </Card>

      {/* Delete account dialog with reason */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle color="error">Delete Account</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            This will permanently deactivate your account. Your forum posts will remain visible but your name will be replaced with "[Deleted User]". This cannot be undone.
          </Typography>

          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 500 }}>
              We're sorry to see you go. May we ask why you're leaving?
            </FormLabel>
            <RadioGroup value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
              <FormControlLabel value="not_useful" control={<Radio size="small" />} label="The platform isn't useful for me" />
              <FormControlLabel value="found_alternative" control={<Radio size="small" />} label="I found a better alternative" />
              <FormControlLabel value="privacy" control={<Radio size="small" />} label="Privacy concerns" />
              <FormControlLabel value="too_complex" control={<Radio size="small" />} label="The platform is too complex" />
              <FormControlLabel value="graduated" control={<Radio size="small" />} label="I have graduated / no longer studying" />
              <FormControlLabel value="other" control={<Radio size="small" />} label="Other" />
            </RadioGroup>
          </FormControl>

          {deleteReason === 'other' && (
            <TextField
              fullWidth multiline rows={2} label="Please tell us more (optional)"
              value={deleteReasonOther} onChange={(e) => setDeleteReasonOther(e.target.value)}
              sx={{ mb: 2 }}
            />
          )}

          <Divider sx={{ my: 2 }} />

          <TextField
            fullWidth label="Enter your password to confirm" type="password"
            value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)}
            helperText="This is required to verify your identity."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteAccount}
            disabled={!deletePassword || !deleteReason}>
            Permanently Delete Account
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
