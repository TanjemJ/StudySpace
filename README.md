# StudySpace — University Learning Platform

## Tech Stack
- **Frontend:** React 18 + Vite + Material UI 6
- **Backend:** Django 5.1 + Django REST Framework
- **Database:** PostgreSQL
- **AI:** Google Gemini API (with mock fallback for dev)
- **Auth:** JWT (SimpleJWT)

---

## Quick Start Guide

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ (or use SQLite for quick testing)

### 1. Set Up PostgreSQL Database

```bash
# Open psql
psql -U postgres

# Create database and user
CREATE DATABASE studyspace_db;
CREATE USER studyspace_user WITH PASSWORD 'studyspace_pass';
GRANT ALL PRIVILEGES ON DATABASE studyspace_db TO studyspace_user;
ALTER USER studyspace_user CREATEDB;
\q
```

**Or use SQLite for quick testing** — change `DATABASES` in `backend/studyspace/settings.py`:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
```

### 2. Set Up Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py makemigrations accounts tutoring forum ai_assistant
python manage.py migrate

# Seed sample data (students, tutors, forum posts, bookings)
python manage.py seed_data

# Start Django server
python manage.py runserver
```

The backend runs at **http://127.0.0.1:8000**

### 3. Set Up Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The frontend runs at **http://localhost:5173**

### 4. Open in Browser

Go to **http://localhost:5173** — you should see the StudySpace landing page.

---

## Demo Login Credentials

| Role    | Email                    | Password     |
|---------|--------------------------|--------------|
| Admin   | admin@studyspace.com     | Admin123!    |
| Student | alice@lsbu.ac.uk         | Student123!  |
| Student | bob@kcl.ac.uk            | Student123!  |
| Tutor   | dr.jane@lsbu.ac.uk      | Tutor123!    |
| Tutor   | prof.ahmed@kcl.ac.uk     | Tutor123!    |

Django Admin panel: **http://127.0.0.1:8000/admin/**

---

## Project Structure

```
StudySpace/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── studyspace/          # Django project settings
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── ...
│   ├── accounts/            # Users, profiles, auth, notifications
│   │   ├── models.py        # User, StudentProfile, TutorProfile
│   │   ├── serializers.py   # Multi-step registration serializers
│   │   ├── views.py         # Registration, login, tutor search
│   │   └── management/commands/seed_data.py
│   ├── tutoring/            # Bookings, availability, payments, reviews
│   ├── forum/               # Categories, posts, replies, voting, moderation
│   └── ai_assistant/        # AI conversations, Gemini API integration
├── frontend/
│   ├── package.json
│   ├── vite.config.js       # Proxy /api to Django
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # Routing + protected routes
│       ├── theme.js          # MUI theme (StudySpace design system)
│       ├── contexts/
│       │   └── AuthContext.jsx
│       ├── utils/
│       │   └── api.js        # Axios instance with JWT interceptor
│       ├── components/
│       │   └── layout/
│       │       └── Navbar.jsx
│       └── pages/
│           ├── Landing.jsx
│           ├── Login.jsx
│           ├── SignUp.jsx          # Multi-step (3 student / 5 tutor)
│           ├── StudentDashboard.jsx
│           ├── TutorDashboard.jsx
│           ├── AdminDashboard.jsx
│           ├── TutorSearch.jsx
│           ├── TutorProfile.jsx
│           ├── Forum.jsx
│           ├── ForumThread.jsx
│           ├── CreatePost.jsx
│           ├── AIChat.jsx
│           └── Bookings.jsx
└── README.md
```

---

## API Endpoints

### Auth (`/api/auth/`)
- `POST /register/step1/` — Create account + send verification code
- `POST /register/verify-code/` — Verify 6-digit email code
- `POST /register/step2/` — Set name + username
- `POST /register/step3/student/` — Student university info (optional)
- `POST /register/step3/tutor/` — Tutor subjects + company email
- `POST /register/step4/tutor/` — Tutor rate + experience
- `POST /register/step5/tutor/` — Tutor documents + finish
- `POST /login/` — Returns JWT tokens
- `GET /me/` — Current user profile
- `GET /tutors/` — Search/filter tutors
- `GET /tutors/:id/` — Tutor detail

### Tutoring (`/api/tutoring/`)
- `GET/POST /availability/` — Tutor availability slots
- `POST /bookings/create/` — Book a session
- `GET /bookings/` — List user's bookings
- `POST /bookings/:id/:action/` — Accept/cancel/complete
- `POST /reviews/create/` — Leave a review

### Forum (`/api/forum/`)
- `GET /categories/` — List forum categories
- `GET /posts/` — List posts (filter by category)
- `POST /posts/create/` — Create post
- `GET /posts/:id/` — Post detail
- `GET/POST /posts/:id/replies/` — Replies
- `POST /posts/:id/vote/` — Upvote/downvote

### AI (`/api/ai/`)
- `GET /conversations/` — List user's conversations
- `POST /send/` — Send message (creates or continues conversation)

---

## AI Integration

The AI assistant uses Google Gemini API by default. Set `GEMINI_API_KEY` environment variable:

```bash
export GEMINI_API_KEY=your-api-key-here
```

Without an API key, the AI returns mock guided responses for testing.

---

## Design System

The frontend uses the StudySpace design system with:
- **Primary:** Green (#006B3F)
- **Secondary:** Amber/Gold (#FBBF24)
- **Typography:** Plus Jakarta Sans (headings) + Inter (body)
- **Spacing:** 4px base unit
- **Border Radius:** 8px default, 12px cards

See `frontend/src/theme.js` for the full MUI theme configuration.
