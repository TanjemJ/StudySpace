import random
from datetime import date, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User, StudentProfile, TutorProfile, Notification
from tutoring.models import AvailabilitySlot, Booking, PaymentRecord, Review
from forum.models import ForumCategory, ForumPost, ForumReply


UNIVERSITY_BY_DOMAIN = {
    'lsbu.ac.uk': 'London South Bank University',
    'kcl.ac.uk': 'Kings College London',
    'ucl.ac.uk': 'University College London',
    'imperial.ac.uk': 'Imperial College London',
    'qmul.ac.uk': 'Queen Mary University of London',
    'city.ac.uk': 'City, University of London',
    'westminster.ac.uk': 'University of Westminster',
    'greenwich.ac.uk': 'University of Greenwich',
    'brunel.ac.uk': 'Brunel University London',
    'roehampton.ac.uk': 'University of Roehampton',
}


def uni_from_email(email: str) -> str:
    domain = email.split('@')[-1].lower() if '@' in email else ''
    return UNIVERSITY_BY_DOMAIN.get(domain, '')


STUDENT_DATA = [
    ('alice@lsbu.ac.uk', 'alice_cs', 'Alice', 'Smith',
     'London South Bank University', 'BSc Computer Science', 2),
    ('bob@kcl.ac.uk', 'bob_maths', 'Bob', 'Jones',
     'Kings College London', 'BSc Mathematics', 3),
    ('charlie@ucl.ac.uk', 'charlie_eng', 'Charlie', 'Brown',
     'University College London', 'BA English Literature', 1),
    ('diana@imperial.ac.uk', 'diana_ai', 'Diana', 'Patel',
     'Imperial College London', 'MSc Artificial Intelligence', 5),
    ('edward@qmul.ac.uk', 'edward_bio', 'Edward', 'Wilson',
     'Queen Mary University of London', 'BSc Biology', 2),
    ('fatima@lsbu.ac.uk', 'fatima_eng', 'Fatima', 'Khan',
     'London South Bank University', 'BEng Software Engineering', 3),
    ('george@kcl.ac.uk', 'george_cs', 'George', 'Taylor',
     'Kings College London', 'BSc Computer Science', 1),
    ('hannah@ucl.ac.uk', 'hannah_phys', 'Hannah', 'Lee',
     'University College London', 'BSc Physics', 2),
]


# 16 tutors: existing 6 + 10 new. Prices £15-£45, ratings 3.7-4.9.
# Each tuple: (email, display_name, first, last, subjects, rate, exp, rating, sessions, bio)
TUTOR_DATA = [
    # --- Existing 6 (adjusted to more realistic ratings / prices) ---
    ('dr.jane@lsbu.ac.uk', 'DrJaneDoe', 'Jane', 'Doe',
     ['Mathematics', 'Physics'], 35, 8, 4.8, 94,
     'PhD in Applied Mathematics from Imperial. 8 years tutoring university '
     'students. Specialising in calculus, linear algebra, and mathematical physics.'),
    ('prof.ahmed@kcl.ac.uk', 'ProfAhmed', 'Ahmed', 'Hassan',
     ['Computer Science', 'Data Structures', 'Algorithms'], 40, 10, 4.7, 132,
     'Senior lecturer in Computer Science. Data structures, algorithms, and '
     'software engineering. Practical examples and live coding sessions.'),
    ('sarah.t@ucl.ac.uk', 'SarahTeaches', 'Sarah', 'Williams',
     ['English Literature', 'Academic Writing', 'Essay Skills'], 28, 5, 4.5, 47,
     'MA English Literature, UCL. Helping students improve academic writing, '
     'critical analysis, and essay structure for essay-heavy subjects.'),
    ('mike.r@imperial.ac.uk', 'MikeRobotics', 'Mike', 'Chen',
     ['Python', 'Machine Learning', 'AI'], 42, 6, 4.6, 71,
     'AI researcher and Python specialist. Working on robotics and ML. '
     'Complex concepts broken down into practical projects you can build.'),
    ('emma.b@qmul.ac.uk', 'EmmaBiology', 'Emma', 'Baker',
     ['Biology', 'Chemistry', 'Biochemistry'], 26, 4, 4.3, 38,
     'MSc Biochemistry. PhD researcher in molecular biology. Patient with '
     'visual learners — I use a lot of diagrams and analogies.'),
    ('james.p@lsbu.ac.uk', 'JamesDesign', 'James', 'Park',
     ['Web Development', 'UI/UX Design', 'JavaScript', 'React'], 32, 7, 4.4, 58,
     'Full-stack developer and UX designer. 7 years industry experience. '
     'Specialising in React, JavaScript, and modern web development.'),

    # --- 10 new tutors, diverse ---
    ('lisa.morgan@city.ac.uk', 'LisaMStats', 'Lisa', 'Morgan',
     ['Statistics', 'R', 'Data Analysis'], 30, 4, 4.4, 29,
     'Statistician turned educator. 4 years teaching SPSS, R, and statistical '
     'reasoning for social science students.'),
    ('tom.garcia@westminster.ac.uk', 'TomGEcon', 'Tom', 'Garcia',
     ['Economics', 'Microeconomics', 'Macroeconomics'], 25, 3, 4.1, 18,
     'Economics graduate currently doing a masters. Focused on making '
     'first-year economics intuitive rather than intimidating.'),
    ('priya.s@imperial.ac.uk', 'PriyaChem', 'Priya', 'Shah',
     ['Chemistry', 'Organic Chemistry', 'Inorganic Chemistry'], 38, 6, 4.7, 82,
     'PhD Chemistry (Imperial), 6 years tutoring. Specialising in organic '
     'reaction mechanisms — the bit everyone finds hardest.'),
    ('ryan.o@greenwich.ac.uk', 'RyanONet', 'Ryan', "O'Brien",
     ['Networking', 'Cybersecurity', 'Linux'], 34, 5, 4.5, 41,
     'Network engineer by day, tutor by evening. CCNA and Security+ '
     'instructor. I help you pass certifications AND understand them.'),
    ('amelia.j@ucl.ac.uk', 'AmeliaJHist', 'Amelia', 'Johnson',
     ['History', 'Politics', 'International Relations'], 22, 2, 4.0, 12,
     'UCL MA History graduate. Helping with essay arguments, historiography, '
     'and structuring arguments for politics essays.'),
    ('david.k@brunel.ac.uk', 'DavidKElec', 'David', 'Kim',
     ['Electrical Engineering', 'Circuit Analysis', 'Signals'], 36, 5, 4.3, 33,
     'Chartered electrical engineer. Hands-on approach — bring me your '
     'lab reports and problem sheets, we work through them together.'),
    ('rachel.m@lsbu.ac.uk', 'RachelMAcc', 'Rachel', 'Murphy',
     ['Accounting', 'Finance', 'Business Studies'], 27, 4, 4.2, 24,
     'Chartered Accountant (ACA). Helping students with financial statements, '
     'management accounting, and finance calcs without the jargon.'),
    ('yuki.t@qmul.ac.uk', 'YukiTJap', 'Yuki', 'Tanaka',
     ['Japanese', 'Japanese Literature', 'Linguistics'], 18, 3, 4.6, 51,
     'Native Japanese speaker, linguistics MA. All levels from beginner '
     'to JLPT N1 — conversational practice and exam prep.'),
    ('benedict.a@city.ac.uk', 'BenALaw', 'Benedict', 'Adeyemi',
     ['Law', 'Contract Law', 'Tort Law'], 45, 8, 4.9, 109,
     'Barrister, 8 years teaching law to undergraduates. ILEX and LLB '
     'specialist. My students get into the top firms.'),
    ('nadia.r@roehampton.ac.uk', 'NadiaRPsych', 'Nadia', 'Rahman',
     ['Psychology', 'Research Methods', 'Cognitive Psychology'], 24, 3, 3.9, 16,
     'Psychology MSc. Helping BSc students with research methods, statistics '
     'for psychology, and dissertation design.'),
    ('alex.w@westminster.ac.uk', 'AlexWMusic', 'Alex', 'Whitfield',
     ['Music Theory', 'Composition', 'Ear Training'], 15, 2, 3.7, 9,
     'Music composition student. Budget-friendly sessions for music theory, '
     'ear training, and Grade 5 ABRSM theory — where I started myself.'),
]


SAMPLE_STUDENT_NOTES = [
    'Looking forward to working through last week\'s problem sheet.',
    'Preparing for an exam next month, could we focus on past papers?',
    'Beginner here — please go slow with me!',
    'Need help with a specific topic from lecture 5.',
    'I\'ll bring my coursework draft for feedback.',
    '',
    '',
    'Would like to focus on practical examples rather than theory.',
]

REVIEW_COMMENTS_BY_RATING = {
    5: [
        'Excellent session! Really helped me understand the topic.',
        'Very patient and knowledgeable tutor. Highly recommended.',
        'Great at explaining complex concepts in simple terms.',
        'Helped me prepare for my exam — feeling much more confident now.',
        'Brilliant tutor, made the subject come alive for me.',
    ],
    4: [
        'Good session overall. Tutor knew the material well.',
        'Helpful and well-prepared. Would book again.',
        'Explained things clearly, though we ran out of time a bit.',
        'Solid teaching — worth the price.',
    ],
    3: [
        'Okay session, got what I needed but nothing amazing.',
        'Tutor knows the subject but teaching style didn\'t quite click for me.',
        'Fine for revision but I wouldn\'t rebook unless I was stuck.',
    ],
    2: [
        'Felt a bit rushed. Tutor knew the topic but the pacing was off.',
        'Not quite what I was looking for, but delivered what I asked.',
    ],
}


class Command(BaseCommand):
    help = 'Seed StudySpace with realistic sample data.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Seeding StudySpace database...'))

        # ---- Admin ----
        if not User.objects.filter(email='admin@studyspace.com').exists():
            User.objects.create_superuser(
                email='admin@studyspace.com', username='admin@studyspace.com',
                password='Admin123!', display_name='Admin',
                first_name='Site', last_name='Admin', role='admin',
                is_email_verified=True,
            )
            self.stdout.write(self.style.SUCCESS('  Admin created'))

        # ---- Students ----
        students = []
        for email, display, first, last, uni, course, year in STUDENT_DATA:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email, 'display_name': display,
                    'first_name': first, 'last_name': last,
                    'role': 'student', 'is_email_verified': True,
                },
            )
            if created:
                user.set_password('Student123!')
                user.save()
                StudentProfile.objects.create(
                    user=user, university=uni, university_email=email,
                    university_verified=True,
                    university_verified_at=timezone.now(),
                    course=course, year_of_study=year,
                )
            students.append(user)
        self.stdout.write(self.style.SUCCESS(f'  {len(students)} students'))

        # ---- Tutors ----
        tutors = []
        for email, display, first, last, subjects, rate, exp, rating, sessions, bio in TUTOR_DATA:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email, 'display_name': display,
                    'first_name': first, 'last_name': last,
                    'role': 'tutor', 'is_email_verified': True,
                },
            )
            if created:
                user.set_password('Tutor123!')
                user.save()

            university_name = uni_from_email(email)
            reviews_count = int(sessions * random.uniform(0.45, 0.75))

            profile, p_created = TutorProfile.objects.get_or_create(
                user=user,
                defaults={
                    'bio': bio,
                    'subjects': subjects,
                    'hourly_rate': Decimal(rate),
                    'experience_years': exp,
                    'company_email': email,
                    'company_email_verified': True,
                    'university': university_name,
                    'university_verified': True,
                    'university_verified_at': timezone.now(),
                    'verification_status': 'approved',
                    'average_rating': rating,
                    'total_sessions': sessions,
                    'total_reviews': reviews_count,
                },
            )
            # Backfill for rows created before this seed version
            if not profile.university or not profile.university_verified or not profile.university_verified_at:
                profile.university = university_name
                profile.university_verified = True
                profile.university_verified_at = timezone.now()
                profile.save()
            tutors.append(profile)
        self.stdout.write(self.style.SUCCESS(f'  {len(tutors)} tutors (rates £15-£45, ratings 3.7-4.9)'))

        # ---- Availability — ALWAYS calculated from today ----
        today = timezone.localdate()
        slot_count = 0
        for tutor in tutors:
            # Each tutor gets different availability patterns to feel realistic.
            # Some prefer mornings, some evenings, some weekends.
            pattern = hash(tutor.user.email) % 4
            hours_map = {
                0: [9, 10, 11, 14, 15, 16],       # standard daytime
                1: [10, 11, 16, 17, 18, 19],      # afternoon + evening
                2: [8, 9, 10, 11, 13, 14],        # morning-heavy
                3: [15, 16, 17, 18, 19, 20],      # evening-only
            }
            hours = hours_map[pattern]

            for day_offset in range(1, 22):  # next 21 days
                d = today + timedelta(days=day_offset)
                # Mon-Fri for most; patterns 1 and 2 also work Saturdays
                weekday = d.weekday()
                if weekday >= 5 and pattern not in (1, 2):
                    continue
                if weekday == 6:  # no Sundays
                    continue

                # Skip a random day now and then to look organic
                if random.random() < 0.15:
                    continue

                for hour in hours:
                    # Skip some individual slots randomly
                    if random.random() < 0.2:
                        continue
                    _, was_new = AvailabilitySlot.objects.get_or_create(
                        tutor=tutor, date=d,
                        start_time=time(hour, 0),
                        defaults={'end_time': time(hour + 1, 0)},
                    )
                    if was_new:
                        slot_count += 1
        self.stdout.write(self.style.SUCCESS(
            f'  {slot_count} availability slots (starting tomorrow)'))

        # ---- Bookings: realistic mix ----
        # Only seed if there are none — keeps re-runs idempotent
        if Booking.objects.count() < 10:
            self._seed_bookings(tutors, students)

        # ---- Forum seed (unchanged behaviour) ----
        self._seed_forum(students)

        self.stdout.write(self.style.SUCCESS('\nDone.\n'))
        self.stdout.write('Log in with:')
        self.stdout.write('  admin@studyspace.com / Admin123!')
        self.stdout.write('  alice@lsbu.ac.uk / Student123!')
        self.stdout.write('  dr.jane@lsbu.ac.uk / Tutor123!')

    # -----------------------------------------------------------------

    def _seed_bookings(self, tutors, students):
        """Create a realistic mix of bookings with various statuses."""
        slots = list(
            AvailabilitySlot.objects.filter(is_booked=False)
            .order_by('date', 'start_time')[:25]
        )
        statuses_plan = (
            ['completed'] * 7 +
            ['confirmed'] * 6 +
            ['pending'] * 3 +
            ['cancelled'] * 2 +
            ['change_requested'] * 2
        )
        random.shuffle(statuses_plan)
        booking_count = 0
        today = timezone.localdate()

        for i, slot in enumerate(slots):
            if i >= len(statuses_plan):
                break
            student = students[i % len(students)]
            if student.id == slot.tutor.user.id:
                continue

            target_status = statuses_plan[i]

            # For completed bookings, use a past slot date if possible
            if target_status == 'completed':
                # Create a retroactive slot in the past so completed bookings
                # actually look completed (date < today).
                past_date = today - timedelta(days=random.randint(3, 25))
                past_slot, _ = AvailabilitySlot.objects.get_or_create(
                    tutor=slot.tutor, date=past_date,
                    start_time=slot.start_time,
                    defaults={'end_time': slot.end_time, 'is_booked': True},
                )
                past_slot.is_booked = True
                past_slot.save()
                booking = Booking.objects.create(
                    student=student, tutor=slot.tutor, slot=past_slot,
                    subject=slot.tutor.subjects[0] if slot.tutor.subjects else 'General',
                    status='completed',
                    price=slot.tutor.hourly_rate,
                    student_note=random.choice(SAMPLE_STUDENT_NOTES),
                )
                PaymentRecord.objects.create(
                    booking=booking, amount=booking.price,
                    transaction_id=f'test_txn_{booking.id}', status='completed',
                )
                # Review with weighted realism: very rarely 5★ across the board
                rating_weights = [(5, 45), (4, 35), (3, 15), (2, 5)]
                rating = random.choices(
                    [r for r, _ in rating_weights],
                    weights=[w for _, w in rating_weights],
                )[0]
                Review.objects.create(
                    booking=booking, student=student, tutor=slot.tutor,
                    rating=rating,
                    comment=random.choice(REVIEW_COMMENTS_BY_RATING.get(rating, ['Good session.'])),
                )
                booking_count += 1
                continue

            # Future / present statuses — use the actual future slot
            booking = Booking.objects.create(
                student=student, tutor=slot.tutor, slot=slot,
                subject=slot.tutor.subjects[0] if slot.tutor.subjects else 'General',
                status=target_status,
                price=slot.tutor.hourly_rate,
                student_note=random.choice(SAMPLE_STUDENT_NOTES),
            )

            if target_status in ('confirmed', 'pending', 'change_requested'):
                slot.is_booked = True
                slot.save()
                PaymentRecord.objects.create(
                    booking=booking, amount=booking.price,
                    transaction_id=f'test_txn_{booking.id}', status='completed',
                )

            if target_status == 'change_requested':
                # Create an actual BookingChangeRequest row so the UI renders properly
                from tutoring.models import BookingChangeRequest
                alt_date = slot.date + timedelta(days=2)
                BookingChangeRequest.objects.create(
                    booking=booking,
                    requested_by='tutor',
                    requested_by_user=slot.tutor.user,
                    proposed_date=alt_date,
                    proposed_start_time=slot.start_time,
                    proposed_end_time=slot.end_time,
                    message='Could we push this back by 2 days? '
                            'I have a lecture clash on the original date.',
                )
                booking.tutor_note = 'Could we push this back by 2 days?'
                booking.save()

            if target_status == 'cancelled':
                booking.cancelled_at = timezone.now() - timedelta(days=1)
                booking.cancelled_by = student
                booking.refund_percent = 100
                booking.save()

            booking_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'  {booking_count} bookings (mixed statuses: pending, confirmed, '
            f'change_requested, completed, cancelled)'))

    def _seed_forum(self, students):
        """Forum seed — idempotent like the others."""
        globals_data = [
            ('General Discussion', 'Chat about anything related to university life.', 'chat', 1),
            ('Study Tips & Techniques', 'Share effective study methods.', 'lightbulb', 2),
            ('Career & Internships', 'CVs, cover letters, interview prep.', 'work', 3),
            ('Academic Writing', 'Essay structure, referencing, dissertation tips.', 'edit', 4),
            ('Tech & Programming', 'Programming help, debugging.', 'code', 5),
            ('Maths & Science', 'Maths, physics, chemistry, biology.', 'functions', 6),
            ('Mental Health & Wellbeing', 'Supportive space for stress, motivation.', 'favorite', 7),
        ]
        categories = {}
        for name, desc, icon, order in globals_data:
            cat, _ = ForumCategory.objects.get_or_create(
                name=name, university='',
                defaults={'description': desc, 'icon': icon, 'order': order,
                          'is_university_only': False},
            )
            categories[name] = cat

        uni_data = [
            ('LSBU Discussion', 'London South Bank University', 'LSBU'),
            ('KCL Students', 'Kings College London', 'KCL'),
            ('UCL Students', 'University College London', 'UCL'),
            ('Imperial Students', 'Imperial College London', 'Imperial'),
            ('QMUL Students', 'Queen Mary University of London', 'QMUL'),
        ]
        uni_cats = {}
        for name, uni, short in uni_data:
            cat, _ = ForumCategory.objects.get_or_create(
                name=name, university=uni,
                defaults={'description': f'Private forum for verified {short} students and tutors.',
                          'icon': 'school', 'order': 10, 'is_university_only': True},
            )
            uni_cats[short] = cat

        if ForumPost.objects.count() == 0:
            posts = [
                (0, 'cat', 'Tech & Programming',
                 'Best resources for learning Data Structures?',
                 'Starting second year — any resources that actually clicked for you?',
                 12, 4, ['learning', 'dsa']),
                (2, 'cat', 'Mental Health & Wellbeing',
                 'Struggling to manage deadlines — any advice?',
                 'Three deadlines in one week. How do you cope?',
                 28, 7, ['stress']),
                (1, 'cat', 'Maths & Science',
                 'Tips for second-year linear algebra',
                 'Finding the jump tough. What should I nail first?',
                 15, 5, ['maths']),
                (3, 'cat', 'Career & Internships',
                 'Got my first ML internship — AMA',
                 'Happy to share how I prepared and applied.',
                 42, 9, ['career', 'ml']),
                (0, 'cat_uni', 'LSBU',
                 'LSBU library extended hours during exams?',
                 'Has Perry Library confirmed 24h opening during May exams?',
                 8, 3, ['lsbu', 'exams']),
            ]
            for s_idx, cat_key, key_or_short, title, content, up, rc, tags in posts:
                if cat_key == 'cat_uni':
                    category = uni_cats.get(key_or_short)
                    uni = {'LSBU': 'London South Bank University'}.get(key_or_short, '')
                else:
                    category = categories.get(key_or_short)
                    uni = ''
                if not category:
                    continue
                post = ForumPost.objects.create(
                    author=students[s_idx], category=category,
                    title=title, content=content, university=uni,
                    upvotes=up, reply_count=rc, tags=tags,
                )
                for j in range(min(rc, random.randint(2, 4))):
                    ForumReply.objects.create(
                        post=post, author=students[(s_idx + j + 1) % len(students)],
                        content='Good point. I had similar problems — what worked was '
                                'breaking it into smaller sessions.',
                        upvotes=random.randint(0, 8),
                    )
            for cat in ForumCategory.objects.all():
                cat.post_count = ForumPost.objects.filter(
                    category=cat, is_flagged=False,
                ).count()
                cat.save()
