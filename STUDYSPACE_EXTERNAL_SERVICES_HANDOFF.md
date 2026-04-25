# StudySpace External Services Handoff

Date: 2026-04-25

This document summarises what has been done during the external services setup work for StudySpace, what is currently in progress, what should be checked next, and what external services remain from the external services guidance.

It is written as a handoff file so the project can be continued in a fresh chat without losing context.

## Safety Notes

- Do not commit `backend/.env`.
- Do not paste real API keys into this file, GitHub, screenshots, or chat messages.
- Keep `backend/.env.example` committed with placeholders only.
- If a real key was ever exposed publicly, rotate it in the provider dashboard.
- `backend/.env` should contain real local values. `backend/.env.example` should contain safe example placeholders.
- The current repository has a Git warning about a very long/odd folder name beginning with `{backend...}`. This is unrelated to the external service work, but should be cleaned carefully later because it can cause `git add .` warnings on Windows.

## Repository Context

Local repository path used during this work:

```text
O:\Documents\University\Year 3\Honours Computer Science Project\StudySpace\V1\StudySpace
```

Project overview:

- Backend: Django and Django REST Framework.
- Frontend: React, Vite, Material UI.
- Main backend apps: `accounts`, `ai_assistant`, `forum`, `tutoring`.
- Main user roles: student, tutor, admin.
- Main platform features: account registration, email verification, tutor discovery and bookings, forums, AI assistant, role-based dashboards, user settings.

## External Services Status

Completed or mostly completed:

- Gemini API connection for the AI assistant.
- SendGrid SMTP email sending for registration verification codes.
- Styled HTML/plain-text verification email templates.
- University email verification foundation using a database-backed domain registry plus DNS/MX checks and verification codes.

In progress / needs final verification:

- Student signup step 4 university email logic.
- Settings page university email verification polish.
- Private forum access should rely on active university email verification.
- Final testing of the full university verification flow.

Still remaining from the external services guidance:

- Google OAuth login.
- Live messaging, starting with a safer polling-based implementation before WebSockets.
- Production deployment setup, likely GCP/Firebase based on the guide.
- Custom domain, SSL, SendGrid domain authentication, and final production hardening.

## Gemini API Work Completed

The Gemini API was selected as the first external service because the AI assistant already existed in the app and only needed a real provider connection.

Browser/provider setup completed:

- A Google AI Studio API key was created.
- The key was connected to the StudySpace Google AI Studio project.
- The API key was restricted to Gemini API in Google Cloud/API key settings.
- Billing/trial credits were enabled by the user.

Backend environment setup:

- `backend/.env` should contain:

```env
GEMINI_API_KEY=your-real-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

- `backend/.env.example` should contain safe placeholders, not real keys.
- `backend/studyspace/settings.py` reads:

```python
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
```

Backend logic changed:

- File: `backend/ai_assistant/views.py`
- The hardcoded model was replaced with a configurable model from settings.
- The system prompt is passed as a `system_instruction` instead of being inserted as a normal user message.
- Gemini errors return a user-safe message.
- Debug logging was temporarily used while troubleshooting and should be removed or kept minimal.
- The Python version warning from `google_api_core` was only a warning, not the cause of the Gemini failure.

Frontend AI assistant changes:

- File: `frontend/src/pages/AIChat.jsx`
- Added a ChatGPT/Claude-style typing animation so AI responses appear progressively instead of all at once.
- The typing speed was tuned to a balanced speed after testing.
- Added Markdown rendering so Gemini responses like `**bold text**` render as bold instead of showing raw asterisks.
- The likely package used for this was `react-markdown`.

Testing performed:

- The AI assistant successfully responded through Gemini after the backend block was corrected.
- The text animation successfully worked.
- Markdown formatting rendered correctly after adding Markdown rendering.

## SendGrid Email Sending Work Completed

SendGrid was selected for transactional email because the app needs automated verification-code emails.

Provider setup completed:

- A SendGrid account was created.
- A Single Sender identity was verified using:

```text
studyspaceadmin@gmail.com
```

- The SendGrid API key was created.
- The user discovered and fixed a `.env` typo:

```env
DEFAULT_FROM-EMAIL=wrong
DEFAULT_FROM_EMAIL=correct
```

Important SendGrid note:

- Single Sender is acceptable for local development and university project demos.
- It is not ideal for production deliverability.
- Production should use a real StudySpace-owned domain and SendGrid domain authentication with SPF, DKIM, and DMARC.

Backend email settings:

- File: `backend/studyspace/settings.py`
- Email sending is no longer tied only to `DEBUG`.
- `USE_SENDGRID_EMAIL=True` allows local development to keep `DEBUG=True` while still sending real email through SendGrid.

Expected `.env` values:

```env
SENDGRID_API_KEY=your-real-sendgrid-api-key
DEFAULT_FROM_EMAIL=studyspaceadmin@gmail.com
USE_SENDGRID_EMAIL=True
```

Expected settings shape:

```python
USE_SENDGRID_EMAIL = os.environ.get('USE_SENDGRID_EMAIL', 'False') == 'True'

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'studyspaceadmin@gmail.com')

if USE_SENDGRID_EMAIL:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = 'smtp.sendgrid.net'
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = 'apikey'
    EMAIL_HOST_PASSWORD = os.environ.get('SENDGRID_API_KEY')
```

Email templates created:

- `backend/templates/emails/verification_code.html`
- `backend/templates/emails/verification_code.txt`

Backend email logic changed:

- File: `backend/accounts/views.py`
- Registration and resend verification email now use HTML and plain-text templates.
- `EmailMultiAlternatives` and `render_to_string` are used.
- A reusable helper function was introduced, likely named `send_verification_email`.
- SendGrid error logging was temporarily added for debugging.
- Once `USE_SENDGRID_EMAIL=True`, the frontend should not show the development verification code.

Deliverability findings:

- Gmail received the email, but placed it in spam.
- LSBU/Outlook showed SendGrid status as delivered, but the message was not visible in the inbox. This could be spam/quarantine, institutional filtering, delayed delivery, or Microsoft/tenant policy.
- SendGrid "Delivered" only confirms the recipient server accepted the message. It does not guarantee inbox placement.

Ways to improve deliverability later:

- Use a real domain such as `studyspace.com` or a project-owned domain.
- Authenticate that domain in SendGrid.
- Add SPF, DKIM, and DMARC DNS records.
- Avoid free Gmail sender identity for production.
- Keep email content clean, simple, and transactional.
- Use a consistent sender name and reply-to.

## Verification Email Template Work Completed

The verification email was improved from a plain sentence into a more professional transactional email.

Files:

- `backend/templates/emails/verification_code.html`
- `backend/templates/emails/verification_code.txt`

Design goals:

- Clear StudySpace branding.
- Large readable verification code.
- Short explanation of why the email was sent.
- Plain-text fallback for clients that do not render HTML.
- No remote images required at this stage to avoid deliverability issues.

Important decision:

- Email templates belong in the backend, not the React frontend.
- The backend is the system that sends emails.
- React `.jsx` components are not used by email clients unless a separate email-rendering pipeline is added.
- Plain HTML templates are the correct simple implementation for Django email sending.

## `.env.example` Work

The user asked to update `backend/.env.example` to match the current expected environment variables.

Expected safe version:

```env
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True

DB_NAME=studyspace_db
DB_USER=studyspace_user
DB_PASSWORD=your-database-password-here
DB_HOST=localhost
DB_PORT=5432

GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.5-flash

SENDGRID_API_KEY=your-sendgrid-api-key-here
DEFAULT_FROM_EMAIL=studyspaceadmin@gmail.com
USE_SENDGRID_EMAIL=False
```

Notes:

- Real passwords do not belong in `.env.example`.
- `USE_SENDGRID_EMAIL=False` is safer for the example file.
- Local `.env` can use `USE_SENDGRID_EMAIL=True`.
- The real `DJANGO_SECRET_KEY` should be changed from `your-secret-key-here`.
- Django warned that the JWT signing key was too short. A stronger `DJANGO_SECRET_KEY` is needed before production.

## University Email Verification Feature

This feature was started after SendGrid because the app needs trusted university email verification for private forums.

Original idea:

- Verify all UK university emails dynamically using DNS or an external API instead of manually hardcoding every domain.

Final architecture chosen:

- Hybrid approach:
  - Database-backed approved university domain registry.
  - DNS/MX lookup to check that the email domain can receive mail.
  - Verification code sent to the university email address.
  - Active verification expires after 1 year.
  - Users can change verified university email only after 30 days.

Why not pure DNS only:

- DNS can show that a domain exists and accepts email.
- DNS cannot reliably prove that the domain belongs to a real university.
- DNS cannot map the domain to a specific university name for private forums.
- A database table gives admins control and lets private forum access be based on trusted institution mapping.

Why not static code list only:

- A static Python list is hard to maintain.
- A database-backed list lets the admin add domains without code changes.
- A CSV can still be used for initial bootstrap/import.

## University Verification Backend Files

Models changed:

- File: `backend/accounts/models.py`

Likely additions:

- `EmailVerificationCode.Purpose`
- `purpose`
- `target_email`
- `UniversityDomain`
- `StudentProfile.university_verified_at`
- `TutorProfile.university_verified_at`
- `university_verification_active`
- `university_email_can_change`

Purpose choices:

```python
class Purpose(models.TextChoices):
    ACCOUNT_EMAIL = 'account_email', 'Account email'
    UNIVERSITY_EMAIL = 'university_email', 'University email'
```

University domain model:

```python
class UniversityDomain(models.Model):
    domain = models.CharField(max_length=255, unique=True)
    university_name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['university_name', 'domain']

    def __str__(self):
        return f"{self.university_name} ({self.domain})"
```

Profile verification properties:

```python
@property
def university_verification_active(self):
    return bool(
        self.university_verified
        and self.university_verified_at
        and timezone.now() < self.university_verified_at + timezone.timedelta(days=365)
    )

@property
def university_email_can_change(self):
    if not self.university_verified_at:
        return True
    return timezone.now() >= self.university_verified_at + timezone.timedelta(days=30)
```

Important indentation note:

- These profile properties should be inside `StudentProfile` and `TutorProfile`.
- They should not be inside the `__str__` method.
- In the screenshot, the properties were correctly inside `StudentProfile`.

Requirements changed:

- File: `backend/requirements.txt`

Added:

```text
dnspython==2.7.0
```

Service file created:

- File: `backend/accounts/university_email_service.py`

Purpose:

- Normalize email.
- Extract domain.
- Check `.ac.uk` style domain rules.
- Look up domain in `UniversityDomain`.
- Run MX lookup using `dnspython`.
- Return a structured validation result.

Data file created:

- File: `backend/accounts/data/university_domains_england.csv`

Purpose:

- Initial bootstrap list of England university domains.
- This should seed the database.
- The database should become the source of truth after import.

Management command created:

- File: `backend/accounts/management/commands/sync_university_domains.py`

Purpose:

- Import/update university domains from CSV.
- Let the project seed university domains repeatably.

Command:

```powershell
cd "O:\Documents\University\Year 3\Honours Computer Science Project\StudySpace\V1\StudySpace\backend"
venv\Scripts\activate
python manage.py sync_university_domains
```

Admin changed:

- File: `backend/accounts/admin.py`

Purpose:

- Register `UniversityDomain` in Django admin.
- Allow admin users to add/edit/deactivate university email domains through Django admin.

Potential future improvement:

- Also add university domain management to the custom StudySpace admin dashboard.
- This should use API endpoints and the database.
- Do not make the live app write directly to the CSV. Treat CSV as bootstrap/import only.

## University Verification API Work

Settings views changed:

- File: `backend/accounts/settings_views.py`

Likely additions:

- `_get_university_profile(user)`
- `_apply_verified_university_email(profile, email, university_domain)`
- `SendUniversityVerificationCodeView`
- `VerifyUniversityEmailCodeView`

Expected behavior:

- Send-code endpoint validates university email.
- If the email is valid and already verified for that user, return `already_verified`.
- If not already verified, create an `EmailVerificationCode` with:
  - `purpose=EmailVerificationCode.Purpose.UNIVERSITY_EMAIL`
  - `target_email=university_email`
- Send the code to the university email.
- Verify-code endpoint checks latest matching code for that user, purpose, and target email.
- On success, mark `profile.university_email`, `profile.university`, `profile.university_verified`, and `profile.university_verified_at`.

URLs changed:

- File: `backend/accounts/urls.py`

Expected routes:

```python
path('settings/university-email/send/', SendUniversityVerificationCodeView.as_view(), name='send-university-verification-code')
path('settings/university-email/verify/', VerifyUniversityEmailCodeView.as_view(), name='verify-university-email-code')
```

Serializers changed:

- File: `backend/accounts/serializers.py`

Expected exposed profile fields:

- `university_verification_active`
- `university_email_can_change`

Forum access changed:

- File: `backend/forum/views.py`

Expected behavior:

- Private university forum access should use active verification, not just a typed university name.
- `_get_user_university` should require `profile.university_verification_active`.

## University Verification Frontend Work

Settings page changed:

- File: `frontend/src/pages/Settings.jsx`

Added:

- University email input.
- Send code button.
- Verification code input.
- Verify button.
- Status messages.
- Handling for already verified / auto verified responses.
- Better spacing/button sizing was started after visual feedback.

Known UI issue seen:

- The verification code field and "Save Changes" button were too close.
- Send Code button was much larger than Verify button.
- University details chip could incorrectly show "Verified" based on old `university_verified` instead of active verification.

Desired final UI behavior:

- If active verified:
  - Show verified badge.
  - Lock the university email field unless 30-day change window has passed.
  - Hide the code input unless the user starts a change flow.
- If expired:
  - Show clear "verification expired" warning.
  - Allow sending a new code.
- If never verified:
  - Show input, Send Code, code field after sending, Verify button.
- Buttons should align nicely and not collide with Save Changes.

Signup page likely changed or still needs checking:

- File: `frontend/src/pages/SignUp.jsx`

Desired behavior:

- Student signup has optional university email field in the university step.
- If the student registered using an already-verified `.ac.uk` account email, the final student profile should auto-verify university email.
- If they use a personal account email, they can optionally add university email during signup.
- If they skip it, they can verify later in Settings.

## Important Logic Change: Account Email vs University Email

There are two different email concepts:

- Account email:
  - Used to create/login to the StudySpace account.
  - Always gets a normal account verification code.
  - Can be Gmail, Outlook, university email, etc.

- University email:
  - Used to access university/private forums.
  - Must be in the approved university domain table.
  - Must pass DNS/MX check.
  - Must be verified by code.
  - Expires after 1 year.
  - Can only be changed after 30 days once verified.

Required final behavior:

- If a user signs up using a university email as their account email and verifies that account email, then on student/tutor profile setup the app may auto-verify the same email as the university email if:
  - the account email is verified,
  - the email domain is in `UniversityDomain`,
  - DNS/MX check passes,
  - the submitted or detected university email matches the account email.

- If a user signs up using a personal email, they must separately verify a university email before accessing private university forums.

## Known Issue Found During Testing

During signup testing with `jobabt@lsbu.ac.uk`, the backend returned:

```text
django.db.utils.IntegrityError: duplicate key value violates unique constraint "accounts_user_display_name_key"
DETAIL: Key (display_name)=(user_30) already exists.
```

Meaning:

- This was not caused by SendGrid or university email verification.
- The app attempted to create a user with a generated `display_name` that already existed.

Likely fix:

- Update user creation logic so generated display names are unique.
- Do not rely on a simple predictable value like `user_30`.
- Generate and check candidate values in a loop.

This should be fixed separately if it still exists.

## Current Possible Incomplete Items

These are the most important things to check in the next chat before moving on.

### 1. Confirm `RegisterStep3StudentView`

File:

```text
backend/accounts/views.py
```

Why:

- It was noticed that after `profile.save()`, the student signup final response may have been missing or incomplete.
- A full intended replacement was discussed, but it may not have been applied.

Expected behavior:

- Load pending registration data.
- Create the student user.
- Create/update `StudentProfile`.
- Set normal university fields.
- If `university_email` is submitted, validate it.
- If it matches an already verified account email, auto-verify the university email.
- Return tokens and user data so the frontend can log in the user.

### 2. Confirm `SignUp.jsx` Sends Optional `university_email`

File:

```text
frontend/src/pages/SignUp.jsx
```

Check:

- There should be a `universityEmail` state value.
- The student final registration request should include:

```javascript
university_email: universityEmail
```

- Step 4 of the signup should include an optional university email input.

### 3. Confirm Settings API Already Verified Flow

File:

```text
backend/accounts/settings_views.py
```

Check:

- Sending a code to the same already-active verified university email should not send another email unnecessarily.
- It should return something like:

```json
{
  "message": "This university email is already verified.",
  "already_verified": true,
  "university": "London South Bank University"
}
```

### 4. Confirm Settings UI Active Verification Logic

File:

```text
frontend/src/pages/Settings.jsx
```

Check:

- University badge should use `university_verification_active`, not only `university_verified`.
- Expired verification should not display as fully verified.
- If active verified, inputs/buttons should be locked or hidden appropriately.
- If expired, the user should be prompted to verify again.

### 5. Confirm Private Forum Access

File:

```text
backend/forum/views.py
```

Check:

- A user should not access private university forums simply because they typed a university name.
- A user should access private forums only when `university_verification_active` is true.

## Testing Checklist For University Verification

Before committing the final university verification feature, run these tests.

Backend setup:

```powershell
cd "O:\Documents\University\Year 3\Honours Computer Science Project\StudySpace\V1\StudySpace\backend"
venv\Scripts\activate
python manage.py makemigrations
python manage.py migrate
python manage.py sync_university_domains
python manage.py runserver
```

Frontend setup:

```powershell
cd "O:\Documents\University\Year 3\Honours Computer Science Project\StudySpace\V1\StudySpace\frontend"
npm run dev
```

Test 1 - personal account email:

- Register as a student using a Gmail/personal account email.
- Verify normal account email.
- Complete profile without university email.
- Go to Settings.
- Enter a valid university email such as `name@lsbu.ac.uk`.
- Click Send Code.
- Receive email or check SendGrid logs.
- Enter code.
- Confirm Settings shows active university verification.
- Confirm private forum access works.

Test 2 - university account email:

- Register as a student using a valid university email.
- Verify normal account email.
- Complete student profile.
- Confirm the same university email is auto-verified if the logic has been implemented.
- Confirm Settings does not ask for unnecessary re-verification.

Test 3 - invalid university email:

- Try a non-approved domain.
- Expected: rejected with a clear message.

Test 4 - expired verification:

- In Django admin, manually set `university_verified_at` to more than 365 days ago.
- Refresh Settings.
- Expected: expired warning and re-verify flow.

Test 5 - 30-day change lock:

- Verify a university email.
- Try changing it immediately.
- Expected: blocked until 30 days have passed.

Test 6 - resend:

- Send code.
- Click resend.
- Expected: new code works, old code should not be accepted if the app only accepts the latest unused code.

## Recommended Commit Message For This Chunk

After the university verification flow is tested:

```text
Add university email verification flow
```

If committing only the docs/handoff file:

```text
Add external services handoff documentation
```

## Remaining External Services Roadmap

### 1. Finish University Verification

Priority: highest, because it is already in progress.

Tasks:

- Verify backend signup final response.
- Verify frontend signup optional university email field.
- Polish Settings UI.
- Confirm private forum access uses active verification.
- Test all flows.
- Commit.

Optional enhancement:

- Add university domain management to the custom StudySpace admin dashboard.
- Keep Django admin support too.
- Database should be source of truth.
- CSV should only be bootstrap/import.

### 2. Google OAuth Login

Priority: next recommended external service after university verification.

Why:

- Login buttons already appear to exist in the frontend.
- OAuth is a common external auth feature.
- It improves signup/login convenience.

Expected provider setup:

- Google Cloud Console.
- OAuth consent screen.
- OAuth client ID.
- Authorized JavaScript origins for local frontend.
- Authorized redirect URI for backend callback or frontend callback, depending on chosen flow.

Likely files involved:

- `backend/studyspace/settings.py`
- `backend/accounts/views.py`
- `backend/accounts/urls.py`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/SignUp.jsx`
- Maybe frontend auth context.

Important caution:

- Do not start OAuth until the current email verification logic is stable.
- OAuth affects auth flow and user creation logic, so it can create confusing bugs if mixed into unfinished registration work.

### 3. Live Messaging

Priority: after OAuth, unless the project needs messaging sooner.

Recommended approach from the guide:

- Start with normal REST API polling.
- Do not jump straight to WebSockets unless needed.

Why polling first:

- Easier to implement.
- Easier to debug.
- Safer for a dissertation/project timeline.
- Can be upgraded to Django Channels/WebSockets later.

Likely work:

- Message/conversation models.
- Send/list messages API.
- Frontend chat UI.
- Polling every few seconds.
- Optional unread indicators.

### 4. Production Deployment

Priority: after core integrations work locally.

Likely areas:

- GCP/Firebase setup.
- Production PostgreSQL.
- Static files.
- Media files.
- Environment variables.
- CORS.
- `ALLOWED_HOSTS`.
- `DEBUG=False`.
- Strong `DJANGO_SECRET_KEY`.
- SendGrid and Gemini production keys.

Important:

- Do not deploy with local placeholder secrets.
- Do not deploy with `DEBUG=True`.

### 5. Domain, SSL, And Email Authentication

Priority: near production/demo readiness.

Tasks:

- Buy or configure a project domain.
- Connect domain to hosting.
- Set up HTTPS/SSL.
- Authenticate domain in SendGrid.
- Add SPF, DKIM, and DMARC.
- Change `DEFAULT_FROM_EMAIL` from Gmail to something like:

```text
no-reply@your-studyspace-domain
```

## Useful Local Commands

Backend:

```powershell
cd "O:\Documents\University\Year 3\Honours Computer Science Project\StudySpace\V1\StudySpace\backend"
venv\Scripts\activate
python manage.py runserver
```

Frontend:

```powershell
cd "O:\Documents\University\Year 3\Honours Computer Science Project\StudySpace\V1\StudySpace\frontend"
npm run dev
```

Migrations:

```powershell
cd "O:\Documents\University\Year 3\Honours Computer Science Project\StudySpace\V1\StudySpace\backend"
venv\Scripts\activate
python manage.py makemigrations
python manage.py migrate
```

Sync university domains:

```powershell
cd "O:\Documents\University\Year 3\Honours Computer Science Project\StudySpace\V1\StudySpace\backend"
venv\Scripts\activate
python manage.py sync_university_domains
```

Git commit:

```powershell
git status
git add .
git commit -m "Add university email verification flow"
git push
```

## Next Chat Starting Point

Recommended first message in the next chat:

```text
Please read STUDYSPACE_EXTERNAL_SERVICES_HANDOFF.md and continue from the "Current Possible Incomplete Items" section. First verify the current repository state, then help me finish the university email verification flow without changing unrelated files.
```

Recommended first technical action in the next chat:

- Inspect `backend/accounts/views.py`, especially `RegisterStep3StudentView`.
- Inspect `frontend/src/pages/SignUp.jsx`.
- Inspect `frontend/src/pages/Settings.jsx`.
- Inspect `backend/accounts/settings_views.py`.
- Do not start Google OAuth until university verification has been fully tested and committed.
