# 🎓 StudySpace

**StudySpace** is a full-stack university learning platform built for UK students. It brings together verified tutoring, university-only forums, guided AI study support, role-based dashboards, messaging, booking management, accessibility settings, and admin moderation in one connected experience.

[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-22c55e?style=for-the-badge)](#-tech-stack)
[![Backend](https://img.shields.io/badge/Backend-Django%20REST-0f766e?style=for-the-badge)](#-tech-stack)
[![Hosting](https://img.shields.io/badge/Hosting-Firebase%20%2B%20Cloud%20Run-f59e0b?style=for-the-badge)](#-deployment)

---

## 🌍 Live Project

| Area | URL |
| --- | --- |
| Production frontend | [https://study-space.org.uk](https://study-space.org.uk) |
| Firebase default URL | [https://gen-lang-client-0155671514.web.app](https://gen-lang-client-0155671514.web.app) |
| Backend service | Google Cloud Run, proxied through `/api` |
| Django admin | `/admin/` through the deployed domain |

> The frontend uses Firebase Hosting. API and Django admin traffic are routed to the Cloud Run backend through Firebase rewrites.

---

## ✨ Key Features

### 👩‍🎓 Students

- Register with email verification.
- Verify a university email to unlock campus-specific forum spaces.
- Search tutors by subject, price, rating, availability, and location.
- Book tutoring sessions and manage bookings from a student dashboard.
- Use the AI Academic Assistant for guided, Socratic-style study support.
- Send messages and participate in moderated forums.
- Save accessibility preferences across the platform.

### 👨‍🏫 Tutors

- Complete a multi-step tutor onboarding flow.
- Upload verification documents for admin review.
- Set subjects, rates, availability, and teaching details.
- Accept, manage, or complete tutoring bookings.
- View tutor dashboard stats and upcoming sessions.

### 🛡️ Admin

- Access a Django admin dashboard.
- Review users, tutor profiles, verification documents, university domains, forum reports, bookings, AI conversations, and contact messages.
- Manage seeded university domains and platform data.
- Keep moderation and verification workflows centralized.

### 🤖 AI Assistant

- Uses Google Gemini when configured.
- Falls back safely for development when no API key is available.
- Designed to guide learning rather than write assignments for users.

### ♿ Accessibility

- Text size controls.
- High contrast mode.
- Reduced motion.
- Underlined links.
- Dyslexia-friendly font.
- Stronger focus indicators.

---

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Material UI 6 |
| Backend | Django 5.1, Django REST Framework |
| Auth | JWT with SimpleJWT, Google OAuth, Microsoft Entra OAuth |
| Database | PostgreSQL locally and Cloud SQL in production |
| AI | Google Gemini API |
| Media | Google Cloud Storage |
| Hosting | Firebase Hosting, Google Cloud Run |
| CI/CD | GitHub Actions for frontend, Google Cloud Build for backend |

---

## 📁 Project Structure

```text
StudySpace/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── Procfile
│   ├── studyspace/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── asgi.py
│   ├── accounts/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── management/commands/
│   ├── tutoring/
│   ├── forum/
│   ├── messaging/
│   └── ai_assistant/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── firebase.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── theme.js
│   │   ├── contexts/
│   │   ├── utils/
│   │   ├── components/
│   │   └── pages/
│   └── dist/
├── .github/workflows/
└── README.md
```

---

## 🚀 Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Git
- Optional: Firebase CLI and Google Cloud CLI for deployment work

### 1. Clone the Repository

```bash
git clone https://github.com/TanjemJ/StudySpace.git
cd StudySpace
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a backend `.env` file with your local values:

```env
DEBUG=True
SECRET_KEY=your-local-secret-key
DB_NAME=studyspace_db
DB_USER=studyspace_user
DB_PASSWORD=your-local-db-password
DB_HOST=localhost
DB_PORT=5432
GEMINI_API_KEY=your-gemini-key
```

Run the database setup:

```bash
python manage.py migrate
python manage.py sync_university_domains
python manage.py ensure_admin_user
python manage.py runserver
```

Backend local URL:

```text
http://127.0.0.1:8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend local URL:

```text
http://localhost:5173
```

Create a frontend `.env` file when running locally:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_WS_BASE_URL=ws://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_MICROSOFT_CLIENT_ID=your-microsoft-client-id
```

---

## 🧪 Useful Commands

### Backend

```bash
cd backend
python manage.py runserver
python manage.py migrate
python manage.py makemigrations
python manage.py createsuperuser
python manage.py sync_university_domains
python manage.py ensure_admin_user
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

### Git

```bash
git status
git add .
git commit -m "Describe your change"
git push origin main
```

---

## 🏗️ Build and Deployment

### Do I need to run `npm run build` after every frontend change?

**For local development:** no.

When you run:

```bash
npm run dev
```

Vite updates the browser automatically as you edit files.

**For production deployment:** the project must be built, but you usually do not need to do it manually if you are pushing to GitHub.

Current deployment flow:

1. You edit the frontend locally.
2. You commit and push to `main`.
3. GitHub Actions installs dependencies, runs the frontend build, and deploys Firebase Hosting.
4. The live site updates at [https://study-space.org.uk](https://study-space.org.uk).

Run `npm run build` locally when you want to check that the frontend will compile before pushing.

### Manual Firebase Deploy

Use this only if you want to deploy manually instead of relying on GitHub Actions:

```bash
cd frontend
npm run build
firebase deploy --only hosting --project gen-lang-client-0155671514
```

### Backend Deployment

Backend deployment is handled through Google Cloud Build and Cloud Run:

- Cloud Build watches the GitHub repository.
- The backend is built from the `backend/` directory.
- The deployed service is `studyspace-backend` in `europe-west2`.
- Firebase Hosting rewrites `/api/**`, `/admin/**`, and `/static/**` to Cloud Run.

---

## 🔐 Environment and Secrets

Never commit real secrets to the repository.

Production secrets are stored in Google Secret Manager and GitHub repository secrets.

Important production values include:

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Django production secret key |
| `DB_PASSWORD` | Cloud SQL database password |
| `STUDYSPACE_ADMIN_PASSWORD` | Initial/admin management password |
| `GEMINI_API_KEY` | Google Gemini API access |
| `VITE_GOOGLE_CLIENT_ID` | Google browser OAuth client |
| `VITE_MICROSOFT_CLIENT_ID` | Microsoft Entra SPA client |
| `FIREBASE_TOKEN` | Firebase deploy token for GitHub Actions |

---

## 🔌 Main API Areas

| Area | Base Path | Purpose |
| --- | --- | --- |
| Auth | `/api/auth/` | Registration, login, profiles, OAuth, dashboards |
| Tutoring | `/api/tutoring/` | Tutor search, availability, bookings, reviews |
| Forum | `/api/forum/` | Categories, posts, replies, votes, reports |
| Messaging | `/api/messaging/` | Conversations and chat messages |
| AI Assistant | `/api/ai/` | AI conversations and study support |
| Contact | `/api/contact/` | Contact form messages |

---

## 🧭 User Flow Summary

```text
Visitor
  -> Landing page
  -> Sign up or log in
  -> Student, tutor, or admin role detected
  -> Redirected to the correct dashboard
  -> Uses tutoring, forums, AI assistant, messaging, and settings
```

Role redirects:

| Role | Destination |
| --- | --- |
| Student | `/dashboard` |
| Tutor | `/tutor-dashboard` |
| Admin | `/admin-dashboard` |

---

## 🎨 Design System

StudySpace uses a calm academic interface with a green and gold identity.

| Token | Value |
| --- | --- |
| Primary | `#006B3F` |
| Secondary | `#FBBF24` |
| UI framework | Material UI |
| Radius | 8px default, 12px for larger surfaces |
| Layout | Responsive, mobile-first |

The theme lives in:

```text
frontend/src/theme.js
```

---

## ✅ Current Production Checklist

- [x] Firebase Hosting connected to custom domain.
- [x] Cloud Run backend deployed.
- [x] Firebase rewrites configured for API, admin, and static files.
- [x] Cloud SQL connected.
- [x] Google Cloud Storage media bucket configured.
- [x] Secret Manager values configured.
- [x] Django migrations completed.
- [x] Admin user created.
- [x] University domains synced.
- [x] Google OAuth configured.
- [x] Microsoft Entra OAuth configured.
- [x] Frontend GitHub Actions deployment enabled.
- [x] Backend Cloud Build deployment enabled.

---

## 🤝 Contributing Workflow

For normal project changes:

```bash
git pull origin main

# make changes

cd frontend
npm run build

cd ..
git status
git add .
git commit -m "Your clear commit message"
git push origin main
```

After pushing to `main`, check:

1. GitHub Actions for frontend deployment.
2. Google Cloud Build for backend deployment when backend files changed.
3. The live site at [https://study-space.org.uk](https://study-space.org.uk).

---

## 📌 Project Status

StudySpace is deployed and live. The main remaining work is product polish, landing page refinement, final testing, dissertation/demo preparation, and any final feature changes required for the honours project submission.
