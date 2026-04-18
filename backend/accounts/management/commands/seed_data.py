"""
Seed sample data for StudySpace development.

Run: python manage.py seed_data

Creates:
- Admin user
- 8 students across different universities
- 6 tutors (with university + university_verified set — fixes the DrJaneDoe bug)
- Availability slots for each tutor over the next 14 days
- ~10 sample bookings with payments and reviews
- 12 forum categories (7 global + 5 university-specific)
- 17 forum posts with replies
- Starter notifications
"""

import random
from datetime import datetime, date, time, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User, StudentProfile, TutorProfile, Notification
from tutoring.models import AvailabilitySlot, Booking, PaymentRecord, Review
from forum.models import ForumCategory, ForumPost, ForumReply


# Map university email domains to their canonical names. Used to set
# `tutor_profile.university` / `student_profile.university` consistently.
UNIVERSITY_BY_DOMAIN = {
    'lsbu.ac.uk': 'London South Bank University',
    'kcl.ac.uk': 'Kings College London',
    'ucl.ac.uk': 'University College London',
    'imperial.ac.uk': 'Imperial College London',
    'qmul.ac.uk': 'Queen Mary University of London',
}


def uni_from_email(email: str) -> str:
    domain = email.split('@')[-1].lower() if '@' in email else ''
    return UNIVERSITY_BY_DOMAIN.get(domain, '')


class Command(BaseCommand):
    help = 'Seed sample data for StudySpace development.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Seeding StudySpace database...'))

        # --- Admin ---
        if not User.objects.filter(email='admin@studyspace.com').exists():
            User.objects.create_superuser(
                email='admin@studyspace.com', username='admin@studyspace.com',
                password='Admin123!', display_name='Admin',
                first_name='Site', last_name='Admin', role='admin',
                is_email_verified=True,
            )
            self.stdout.write(self.style.SUCCESS('  Admin created: admin@studyspace.com / Admin123!'))

        # --- Students ---
        students_data = [
            {'email': 'alice@lsbu.ac.uk', 'display_name': 'alice_cs', 'first': 'Alice', 'last': 'Smith',
             'uni': 'London South Bank University', 'course': 'BSc Computer Science', 'year': 2},
            {'email': 'bob@kcl.ac.uk', 'display_name': 'bob_maths', 'first': 'Bob', 'last': 'Jones',
             'uni': 'Kings College London', 'course': 'BSc Mathematics', 'year': 3},
            {'email': 'charlie@ucl.ac.uk', 'display_name': 'charlie_eng', 'first': 'Charlie', 'last': 'Brown',
             'uni': 'University College London', 'course': 'BA English Literature', 'year': 1},
            {'email': 'diana@imperial.ac.uk', 'display_name': 'diana_ai', 'first': 'Diana', 'last': 'Patel',
             'uni': 'Imperial College London', 'course': 'MSc Artificial Intelligence', 'year': 5},
            {'email': 'edward@qmul.ac.uk', 'display_name': 'edward_bio', 'first': 'Edward', 'last': 'Wilson',
             'uni': 'Queen Mary University of London', 'course': 'BSc Biology', 'year': 2},
            {'email': 'fatima@lsbu.ac.uk', 'display_name': 'fatima_eng', 'first': 'Fatima', 'last': 'Khan',
             'uni': 'London South Bank University', 'course': 'BEng Software Engineering', 'year': 3},
            {'email': 'george@kcl.ac.uk', 'display_name': 'george_cs', 'first': 'George', 'last': 'Taylor',
             'uni': 'Kings College London', 'course': 'BSc Computer Science', 'year': 1},
            {'email': 'hannah@ucl.ac.uk', 'display_name': 'hannah_phys', 'first': 'Hannah', 'last': 'Lee',
             'uni': 'University College London', 'course': 'BSc Physics', 'year': 2},
        ]

        students = []
        for s in students_data:
            user, created = User.objects.get_or_create(
                email=s['email'],
                defaults={
                    'username': s['email'],
                    'display_name': s['display_name'],
                    'first_name': s['first'],
                    'last_name': s['last'],
                    'role': 'student',
                    'is_email_verified': True,
                },
            )
            if created:
                user.set_password('Student123!')
                user.save()
                StudentProfile.objects.create(
                    user=user, university=s['uni'], university_email=s['email'],
                    university_verified=True, course=s['course'], year_of_study=s['year'],
                )
            students.append(user)
        self.stdout.write(self.style.SUCCESS(f'  {len(students)} students created'))

        # --- Tutors ---
        # NOTE: Each tutor now gets `university` set (derived from their email
        # domain) and `university_verified=True`. This is the fix for the
        # DrJaneDoe forum bug — without these fields, the frontend thought she
        # was unverified even though her tutor profile was approved.
        tutors_data = [
            {'email': 'dr.jane@lsbu.ac.uk', 'display_name': 'DrJaneDoe', 'first': 'Jane', 'last': 'Doe',
             'subjects': ['Mathematics', 'Physics'], 'rate': 35, 'exp': 8, 'rating': 4.9, 'sessions': 127,
             'bio': 'PhD in Applied Mathematics from Imperial College. 8 years of tutoring experience with '
                    'university students. Specialising in calculus, linear algebra, and mathematical physics.'},
            {'email': 'prof.ahmed@kcl.ac.uk', 'display_name': 'ProfAhmed', 'first': 'Ahmed', 'last': 'Hassan',
             'subjects': ['Computer Science', 'Data Structures', 'Algorithms'],
             'rate': 40, 'exp': 10, 'rating': 4.8, 'sessions': 203,
             'bio': 'Senior lecturer in Computer Science. Expert in data structures, algorithms, and software '
                    'engineering. Love helping students understand complex concepts through practical examples.'},
            {'email': 'sarah.t@ucl.ac.uk', 'display_name': 'SarahTeaches', 'first': 'Sarah', 'last': 'Williams',
             'subjects': ['English Literature', 'Academic Writing', 'Essay Skills'],
             'rate': 30, 'exp': 5, 'rating': 4.7, 'sessions': 89,
             'bio': 'MA in English Literature from UCL. Passionate about helping students improve their academic '
                    'writing, critical analysis, and essay structure.'},
            {'email': 'mike.r@imperial.ac.uk', 'display_name': 'MikeRobotics', 'first': 'Mike', 'last': 'Chen',
             'subjects': ['Python', 'Machine Learning', 'AI'],
             'rate': 45, 'exp': 6, 'rating': 4.9, 'sessions': 156,
             'bio': 'AI researcher and Python specialist. Working on robotics and machine learning. I make '
                    'complex AI concepts accessible and practical for students at all levels.'},
            {'email': 'emma.b@qmul.ac.uk', 'display_name': 'EmmaBiology', 'first': 'Emma', 'last': 'Baker',
             'subjects': ['Biology', 'Chemistry', 'Biochemistry'],
             'rate': 32, 'exp': 4, 'rating': 4.6, 'sessions': 67,
             'bio': 'MSc in Biochemistry. Currently doing PhD research in molecular biology. I enjoy breaking '
                    'down complex biological processes into simple, understandable steps.'},
            {'email': 'james.p@lsbu.ac.uk', 'display_name': 'JamesDesign', 'first': 'James', 'last': 'Park',
             'subjects': ['Web Development', 'UI/UX Design', 'JavaScript', 'React'],
             'rate': 38, 'exp': 7, 'rating': 4.8, 'sessions': 142,
             'bio': 'Full-stack developer and UX designer with 7 years of industry experience. '
                    'Specialising in React, JavaScript, and modern web development practices.'},
        ]

        tutors = []
        for t in tutors_data:
            user, created = User.objects.get_or_create(
                email=t['email'],
                defaults={
                    'username': t['email'],
                    'display_name': t['display_name'],
                    'first_name': t['first'],
                    'last_name': t['last'],
                    'role': 'tutor',
                    'is_email_verified': True,
                },
            )
            if created:
                user.set_password('Tutor123!')
                user.save()

            # Determine university from email domain (LSBU, KCL, UCL, Imperial, QMUL)
            university_name = uni_from_email(t['email'])

            profile, _ = TutorProfile.objects.get_or_create(
                user=user,
                defaults={
                    'bio': t['bio'],
                    'subjects': t['subjects'],
                    'hourly_rate': t['rate'],
                    'experience_years': t['exp'],
                    'company_email': t['email'],
                    'company_email_verified': True,
                    'university': university_name,  # <<< previously missing
                    'university_verified': True,     # <<< previously missing
                    'verification_status': 'approved',
                    'average_rating': t['rating'],
                    'total_sessions': t['sessions'],
                    'total_reviews': int(t['sessions'] * 0.6),
                },
            )
            # If the profile already existed from an earlier seed run, backfill
            # the university fields so the bug fix applies without needing to
            # wipe the DB.
            if not profile.university or not profile.university_verified:
                profile.university = university_name
                profile.university_verified = True
                profile.save()
            tutors.append(profile)
        self.stdout.write(self.style.SUCCESS(f'  {len(tutors)} tutors created (with university_verified=True)'))

        # --- Availability Slots (next 14 weekdays, 6 slots each) ---
        today = date.today()
        slot_count = 0
        for tutor in tutors:
            for day_offset in range(1, 15):
                d = today + timedelta(days=day_offset)
                if d.weekday() < 5:  # Mon-Fri
                    for hour in [9, 10, 11, 14, 15, 16]:
                        _, was_new = AvailabilitySlot.objects.get_or_create(
                            tutor=tutor, date=d,
                            start_time=time(hour, 0),
                            defaults={'end_time': time(hour + 1, 0)},
                        )
                        if was_new:
                            slot_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {slot_count} availability slots created'))

        # --- Sample Bookings ---
        # Mix of pending / confirmed / completed to demo the new status flow.
        # Note: `pending` bookings will show up in tutor dashboards for them
        # to accept, reject or request a change.
        slots = list(AvailabilitySlot.objects.filter(is_booked=False).order_by('date', 'start_time')[:12])
        booking_count = 0
        statuses = ['completed', 'completed', 'confirmed', 'confirmed', 'pending', 'pending',
                    'completed', 'completed', 'confirmed', 'pending', 'completed', 'confirmed']
        for i, slot in enumerate(slots):
            student = students[i % len(students)]
            if student.id == slot.tutor.user.id:  # avoid self-booking
                continue
            chosen_status = statuses[i] if i < len(statuses) else 'confirmed'
            booking, created = Booking.objects.get_or_create(
                slot=slot,
                defaults={
                    'student': student,
                    'tutor': slot.tutor,
                    'subject': slot.tutor.subjects[0] if slot.tutor.subjects else 'General',
                    'status': chosen_status,
                    'price': slot.tutor.hourly_rate,
                    'student_note': random.choice([
                        'Looking forward to the session — keen to work through last week\'s problem sheet.',
                        'I\'m preparing for an exam next month, could we focus on past papers?',
                        'Beginner here, please go slow with me!',
                        '',
                        'Need help with a specific topic from lecture 5.',
                    ]),
                },
            )
            if created:
                # Only mark slot booked for confirmed/completed, not pending.
                if chosen_status in ('confirmed', 'completed'):
                    slot.is_booked = True
                    slot.save()
                    PaymentRecord.objects.create(
                        booking=booking, amount=booking.price,
                        transaction_id=f'test_txn_{booking.id}', status='completed',
                    )
                if chosen_status == 'completed':
                    Review.objects.create(
                        booking=booking, student=student, tutor=slot.tutor,
                        rating=random.choice([4, 4, 5, 5, 5]),
                        comment=random.choice([
                            'Excellent session! Really helped me understand the topic.',
                            'Very patient and knowledgeable tutor. Highly recommended.',
                            'Great at explaining complex concepts in simple terms.',
                            'Helped me prepare for my exam. Feeling much more confident now.',
                            'Brilliant tutor, made the subject come alive for me.',
                        ]),
                    )
                booking_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {booking_count} bookings created (pending/confirmed/completed mix)'))

        # --- Forum categories (skipped if already created) ---
        global_cats_data = [
            ('General Discussion', 'Chat about anything related to university life.', 'chat', 1),
            ('Study Tips & Techniques', 'Share effective study methods and time management strategies.', 'lightbulb', 2),
            ('Career & Internships', 'CVs, cover letters, interview prep, graduate schemes.', 'work', 3),
            ('Academic Writing', 'Essay structure, referencing, dissertation tips.', 'edit', 4),
            ('Tech & Programming', 'Programming help, project ideas, debugging.', 'code', 5),
            ('Maths & Science', 'Mathematics, physics, chemistry, biology.', 'functions', 6),
            ('Mental Health & Wellbeing', 'Supportive space for stress, motivation, self-care.', 'favorite', 7),
        ]
        categories = {}
        for name, desc, icon, order in global_cats_data:
            cat, _ = ForumCategory.objects.get_or_create(
                name=name, university='',
                defaults={'description': desc, 'icon': icon, 'order': order, 'is_university_only': False},
            )
            categories[name] = cat

        uni_cats_data = [
            ('LSBU Discussion', 'London South Bank University', 'LSBU'),
            ('KCL Students', 'Kings College London', 'KCL'),
            ('UCL Students', 'University College London', 'UCL'),
            ('Imperial Students', 'Imperial College London', 'Imperial'),
            ('QMUL Students', 'Queen Mary University of London', 'QMUL'),
        ]
        uni_cats = {}
        for name, uni, short in uni_cats_data:
            cat, _ = ForumCategory.objects.get_or_create(
                name=name, university=uni,
                defaults={
                    'description': f'Private forum for verified {short} students and tutors.',
                    'icon': 'school', 'order': 10, 'is_university_only': True,
                },
            )
            uni_cats[short] = cat
        self.stdout.write(self.style.SUCCESS(f'  {ForumCategory.objects.count()} forum categories'))

        # --- Forum posts (only if none exist) ---
        if ForumPost.objects.count() == 0:
            posts_data = [
                {'student': 0, 'cat': 'Tech & Programming',
                 'title': 'Best resources for learning Data Structures?',
                 'content': 'I\'m starting my second year and want to get a solid grip on DS. What worked for you?',
                 'upvotes': 12, 'replies_count': 4, 'tags': ['learning', 'dsa']},
                {'student': 2, 'cat': 'Mental Health & Wellbeing', 'anon': True,
                 'title': 'Struggling to manage deadlines — any advice?',
                 'content': 'Three deadlines in one week and I\'m drowning. How do you cope?',
                 'upvotes': 28, 'replies_count': 7, 'tags': ['stress']},
                {'student': 1, 'cat': 'Maths & Science',
                 'title': 'Tips for second-year linear algebra',
                 'content': 'Finding the jump from year 1 to year 2 tough. What concepts should I nail first?',
                 'upvotes': 15, 'replies_count': 5, 'tags': ['maths']},
                {'student': 3, 'cat': 'Career & Internships',
                 'title': 'Got my first ML internship — AMA',
                 'content': 'Happy to share how I applied and prepared. Ask me anything.',
                 'upvotes': 42, 'replies_count': 9, 'tags': ['career', 'ml']},
                {'student': 0, 'cat_uni': 'LSBU',
                 'title': 'LSBU library extended hours during exams?',
                 'content': 'Has anyone heard whether Perry Library is opening 24 hours during May exams?',
                 'uni': 'London South Bank University',
                 'upvotes': 8, 'replies_count': 3, 'tags': ['lsbu', 'exams']},
                {'student': 5, 'cat_uni': 'LSBU',
                 'title': 'Software Engineering group project advice',
                 'content': 'Starting the year 3 group project this week — any tips from people who\'ve done it?',
                 'uni': 'London South Bank University',
                 'upvotes': 6, 'replies_count': 4, 'tags': ['lsbu', 'group-project']},
            ]

            sample_replies = [
                'Have you tried the Anki flashcards for this? It uses spaced repetition and has been a game changer.',
                'I would also recommend the StudySpace AI assistant for working through problems step by step.',
                'Totally relate to this. University can feel isolating but most people feel the same.',
                'Great post! Consistency beats intensity — 2 hours a day beats 12 hours in one night.',
            ]

            post_count = 0
            for p in posts_data:
                if 'cat_uni' in p:
                    category = uni_cats.get(p['cat_uni'])
                else:
                    category = categories.get(p['cat'])
                if not category:
                    continue

                post = ForumPost.objects.create(
                    author=students[p['student']], category=category,
                    title=p['title'], content=p['content'],
                    university=p.get('uni', ''),
                    is_anonymous=p.get('anon', False),
                    is_pinned=p.get('pinned', False),
                    upvotes=p['upvotes'],
                    reply_count=p['replies_count'],
                    tags=p.get('tags', []),
                )
                for j in range(min(p['replies_count'], random.randint(3, 5))):
                    reply_author_idx = (p['student'] + j + 1) % len(students)
                    ForumReply.objects.create(
                        post=post, author=students[reply_author_idx],
                        content=random.choice(sample_replies),
                        upvotes=random.randint(0, 15),
                    )
                post_count += 1

            for cat in ForumCategory.objects.all():
                cat.post_count = ForumPost.objects.filter(category=cat, is_flagged=False).count()
                cat.save()
            self.stdout.write(self.style.SUCCESS(f'  {post_count} forum posts with replies created'))

        # --- Starter notifications ---
        if Notification.objects.count() == 0:
            Notification.objects.create(
                user=students[0], notification_type='booking_confirmed',
                title='Session Confirmed',
                message='Your session with Dr. Jane Doe has been confirmed.',
            )
            Notification.objects.create(
                user=students[0], notification_type='forum_reply',
                title='New reply to your post',
                message='Someone replied to "Best resources for learning Data Structures?"',
            )

        self.stdout.write(self.style.SUCCESS('\nDatabase seeded successfully!'))
        self.stdout.write(self.style.SUCCESS('\nLog in with any of:'))
        self.stdout.write('  admin@studyspace.com / Admin123!')
        self.stdout.write('  alice@lsbu.ac.uk / Student123!')
        self.stdout.write('  dr.jane@lsbu.ac.uk / Tutor123!')
