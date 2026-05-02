# StudySpace Demo Data Guide

This guide explains the repeatable demo seed used for dissertation testing,
screenshots, admin review flows, forum moderation, tutor search, bookings,
messaging, reviews, and Stripe sandbox payment checks.

## What The Seed Creates

- 12 realistic student accounts across London universities.
- 12 approved tutors with varied subjects, London locations, biography detail,
  hourly prices, reviews, bookings, and availability.
- 4 non-approved tutors for the admin verification queue:
  pending, under review, info requested, and rejected.
- Global forum categories and university-specific forum categories.
- Forum posts with varied activity:
  unanswered posts, busy threads, nested replies, pinned posts, reports, and
  moderation examples.
- Past completed bookings, future confirmed bookings, pending requests,
  change requests, cancellations, and pending-payment holds.
- Payment records for completed/refunded/pending demo scenarios.
- A few realistic message threads between students and tutors.

The command is idempotent. Running it again removes old demo activity and
rebuilds a clean demo scenario.

## Demo Passwords

All student accounts use:

```text
Student123!
```

All tutor accounts use:

```text
Tutor123!
```

The demo admin account uses:

```text
Admin123!
```

## Admin Login

| Role | Email | Password |
| --- | --- | --- |
| Admin | demo.admin@studyspace.example | Admin123! |

## Student Accounts

| Name | Email | University | Password |
| --- | --- | --- | --- |
| Aisha Khan | aisha.khan@studyspace.example | London South Bank University | Student123! |
| Daniel Reed | daniel.reed@studyspace.example | University of Westminster | Student123! |
| Maya Patel | maya.patel@studyspace.example | University College London | Student123! |
| Omar Hassan | omar.hassan@studyspace.example | Kings College London | Student123! |
| Emily Brooks | emily.brooks@studyspace.example | Queen Mary University of London | Student123! |
| Leo Nguyen | leo.nguyen@studyspace.example | Imperial College London | Student123! |
| Sofia Martinez | sofia.martinez@studyspace.example | City, University of London | Student123! |
| Noah Wilson | noah.wilson@studyspace.example | University of Greenwich | Student123! |
| Priya Sharma | priya.sharma@studyspace.example | Brunel University London | Student123! |
| James Taylor | james.taylor@studyspace.example | University of Roehampton | Student123! |
| Chloe Martin | chloe.martin@studyspace.example | London South Bank University | Student123! |
| Yusuf Ahmed | yusuf.ahmed@studyspace.example | University of Westminster | Student123! |

## Tutor Accounts

Approved tutors appear in Find a Tutor only when they are Stripe-ready. The seed
reuses an existing sandbox Stripe Connect account from the database when one is
available, so demo bookings can keep using Stripe sandbox without onboarding
every tutor manually.

| Name | Email | Status | Main Subjects | Area | Hourly Rate | Password |
| --- | --- | --- | --- | --- | --- | --- |
| Hannah Morgan | demo.tutor01@studyspace.example | Approved | Mathematics, Statistics | Westminster W1 | GBP 14.50 | Tutor123! |
| Marcus Chen | demo.tutor02@studyspace.example | Approved | Computer Science, Python | South Bank SE1 | GBP 18.75 | Tutor123! |
| Ella Roberts | ella.roberts@studyspace.example | Approved | Academic Writing | Bloomsbury WC1 | GBP 22.40 | Tutor123! |
| Zain Ali | zain.ali@studyspace.example | Approved | Physics, Engineering | South Kensington SW7 | GBP 25.90 | Tutor123! |
| Grace Evans | grace.evans@studyspace.example | Approved | Biology, Chemistry | Whitechapel E1 | GBP 28.25 | Tutor123! |
| Ibrahim Suleiman | ibrahim.suleiman@studyspace.example | Approved | Economics, Finance | Clerkenwell EC1 | GBP 30.60 | Tutor123! |
| Nina Kowalski | nina.kowalski@studyspace.example | Approved | React, JavaScript | Greenwich SE10 | GBP 34.50 | Tutor123! |
| Theo Bennett | theo.bennett@studyspace.example | Approved | Law | Strand WC2 | GBP 39.25 | Tutor123! |
| Riya Desai | riya.desai@studyspace.example | Approved | AI, Machine Learning | South Kensington SW7 | GBP 42.80 | Tutor123! |
| Amara Lewis | amara.lewis@studyspace.example | Approved | Psychology, SPSS | Lambeth SE11 | GBP 24.75 | Tutor123! |
| Callum Fraser | callum.fraser@studyspace.example | Approved | Accounting, Finance | Canary Wharf E14 | GBP 19.90 | Tutor123! |
| Farah Rahman | farah.rahman@studyspace.example | Approved | Cybersecurity, Linux | Shoreditch E2 | GBP 31.20 | Tutor123! |
| Samira Nasser | samira.nasser@studyspace.example | Under review | English Literature | Camden NW1 | GBP 16.80 | Tutor123! |
| Louis Carter | louis.carter@studyspace.example | Pending | Chemistry | Mile End E3 | GBP 21.30 | Tutor123! |
| Meera Shah | meera.shah@studyspace.example | Info requested | UX Research | Ealing W5 | GBP 27.40 | Tutor123! |
| Patrick O'Neill | patrick.oneill@studyspace.example | Rejected | History | Richmond TW9 | GBP 23.60 | Tutor123! |

## Avatar Workflow

You do not need to log into every account manually to add profile images.

1. Add image files to:

```text
backend/fixtures/demo_avatars/
```

2. Use these exact filenames:

```text
student-aisha-khan.jpg
student-daniel-reed.jpg
student-maya-patel.jpg
student-omar-hassan.jpg
student-emily-brooks.jpg
student-leo-nguyen.jpg
student-sofia-martinez.jpg
student-noah-wilson.jpg
student-priya-sharma.jpg
student-james-taylor.jpg
student-chloe-martin.jpg
student-yusuf-ahmed.jpg
tutor-hannah-morgan.jpg
tutor-marcus-chen.jpg
tutor-ella-roberts.jpg
tutor-zain-ali.jpg
tutor-grace-evans.jpg
tutor-ibrahim-suleiman.jpg
tutor-nina-kowalski.jpg
tutor-theo-bennett.jpg
tutor-riya-desai.jpg
tutor-amara-lewis.jpg
tutor-callum-fraser.jpg
tutor-farah-rahman.jpg
tutor-samira-nasser.jpg
tutor-louis-carter.jpg
tutor-meera-shah.jpg
tutor-patrick-oneill.jpg
```

3. Rerun the seed command. Any matching files are uploaded through the normal
   Django storage backend.

Use images you have permission to use. For dissertation screenshots, generated
or royalty-free headshots are usually the safest option. Keep them neutral and
professional, and avoid using real classmates unless they explicitly consent.

## Local Seed Command

From the backend folder:

```bash
python manage.py seed_demo_data --confirm-demo-data --reset-demo
```

For UI-only screenshots where no sandbox Stripe Connect account exists:

```bash
python manage.py seed_demo_data --confirm-demo-data --reset-demo --fake-stripe-ready
```

Do not use `--fake-stripe-ready` when you want to test real Stripe sandbox
Checkout, because fake `acct_demo_*` account IDs cannot receive transfers.

## Cloud Run Seed Pattern

After pushing the backend change and waiting for Cloud Build to deploy the new
backend image, create a one-off Cloud Run job using the latest service image and
the same Cloud SQL, secret, and environment settings used by the existing
migration job.

The important command inside the job is:

```bash
python manage.py seed_demo_data --confirm-demo-data --reset-demo
```

If your existing migration/maintenance job already has the correct environment
variables and secrets, the easiest route is to create a new job from the latest
`studyspace-backend` image and reuse those same settings.

## Stripe Sandbox Notes

- Keep using Stripe sandbox for the dissertation demo.
- If at least one tutor has completed sandbox Connect onboarding, the seed will
  reuse that real sandbox account for approved demo tutors.
- This keeps the Find a Tutor page populated and allows checkout tests to keep
  working.
- For screenshots that need visibly different tutors but not actual transfers,
  use the normal seed without onboarding every tutor.

## Safe Reset Scope

`--reset-demo` deletes only known demo accounts and accounts ending in:

```text
@studyspace.example
```

It does not target real students, real tutors, or real admin accounts outside
that demo email namespace.
