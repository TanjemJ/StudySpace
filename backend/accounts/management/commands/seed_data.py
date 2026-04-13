from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, time, timedelta
from accounts.models import User, StudentProfile, TutorProfile, Notification
from tutoring.models import AvailabilitySlot, Booking, PaymentRecord, Review
from forum.models import ForumCategory, ForumPost, ForumReply
from ai_assistant.models import AIConversation
import random


class Command(BaseCommand):
    help = 'Seeds the database with sample data for development'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # --- Admin ---
        admin = User.objects.create_superuser(
            email='admin@studyspace.com', username='admin',
            password='Admin123!', display_name='AdminUser',
            role='admin', first_name='Platform', last_name='Admin',
            is_email_verified=True,
        )
        self.stdout.write(self.style.SUCCESS('  Admin created: admin@studyspace.com / Admin123!'))

        # --- Students ---
        students_data = [
            {'email': 'alice@lsbu.ac.uk', 'display_name': 'alice_cs', 'first': 'Alice', 'last': 'Johnson',
             'uni': 'London South Bank University', 'course': 'Computer Science', 'year': 3},
            {'email': 'bob@kcl.ac.uk', 'display_name': 'bob_eng', 'first': 'Bob', 'last': 'Smith',
             'uni': 'Kings College London', 'course': 'Engineering', 'year': 2},
            {'email': 'charlie@ucl.ac.uk', 'display_name': 'charlie_math', 'first': 'Charlie', 'last': 'Brown',
             'uni': 'University College London', 'course': 'Mathematics', 'year': 1},
            {'email': 'diana@imperial.ac.uk', 'display_name': 'diana_bio', 'first': 'Diana', 'last': 'Lee',
             'uni': 'Imperial College London', 'course': 'Biology', 'year': 2},
            {'email': 'edward@qmul.ac.uk', 'display_name': 'ed_physics', 'first': 'Edward', 'last': 'Wilson',
             'uni': 'Queen Mary University', 'course': 'Physics', 'year': 3},
        ]
        students = []
        for s in students_data:
            user = User.objects.create_user(
                email=s['email'], username=s['email'], password='Student123!',
                display_name=s['display_name'], first_name=s['first'], last_name=s['last'],
                role='student', is_email_verified=True,
            )
            StudentProfile.objects.create(
                user=user, university=s['uni'], university_email=s['email'],
                university_verified=True, course=s['course'], year_of_study=s['year'],
            )
            students.append(user)
        self.stdout.write(self.style.SUCCESS(f'  {len(students)} students created'))

        # --- Tutors ---
        tutors_data = [
            {'email': 'dr.jane@lsbu.ac.uk', 'display_name': 'DrJaneDoe', 'first': 'Jane', 'last': 'Doe',
             'subjects': ['Mathematics', 'Physics'], 'rate': 35, 'exp': 8, 'rating': 4.9, 'sessions': 127,
             'bio': 'PhD in Applied Mathematics from Imperial College. 8 years of tutoring experience with university students. Specialising in calculus, linear algebra, and mathematical physics.'},
            {'email': 'prof.ahmed@kcl.ac.uk', 'display_name': 'ProfAhmed', 'first': 'Ahmed', 'last': 'Hassan',
             'subjects': ['Computer Science', 'Data Structures', 'Algorithms'], 'rate': 40, 'exp': 10, 'rating': 4.8, 'sessions': 203,
             'bio': 'Senior lecturer in Computer Science. Expert in data structures, algorithms, and software engineering. Love helping students understand complex concepts through practical examples.'},
            {'email': 'sarah.t@ucl.ac.uk', 'display_name': 'SarahTeaches', 'first': 'Sarah', 'last': 'Williams',
             'subjects': ['English Literature', 'Academic Writing', 'Essay Skills'], 'rate': 30, 'exp': 5, 'rating': 4.7, 'sessions': 89,
             'bio': 'MA in English Literature from UCL. Passionate about helping students improve their academic writing, critical analysis, and essay structure.'},
            {'email': 'mike.r@imperial.ac.uk', 'display_name': 'MikeRobotics', 'first': 'Mike', 'last': 'Chen',
             'subjects': ['Python', 'Machine Learning', 'AI'], 'rate': 45, 'exp': 6, 'rating': 4.9, 'sessions': 156,
             'bio': 'AI researcher and Python specialist. Working on robotics and machine learning. I make complex AI concepts accessible and practical for students at all levels.'},
            {'email': 'emma.b@qmul.ac.uk', 'display_name': 'EmmaBiology', 'first': 'Emma', 'last': 'Baker',
             'subjects': ['Biology', 'Chemistry', 'Biochemistry'], 'rate': 32, 'exp': 4, 'rating': 4.6, 'sessions': 67,
             'bio': 'MSc in Biochemistry. Currently doing PhD research in molecular biology. I enjoy breaking down complex biological processes into simple, understandable steps.'},
            {'email': 'james.p@lsbu.ac.uk', 'display_name': 'JamesDesign', 'first': 'James', 'last': 'Park',
             'subjects': ['Web Development', 'UI/UX Design', 'JavaScript', 'React'], 'rate': 38, 'exp': 7, 'rating': 4.8, 'sessions': 142,
             'bio': 'Full-stack developer and UX designer with 7 years of industry experience. Specialising in React, JavaScript, and modern web development practices.'},
        ]
        tutors = []
        for t in tutors_data:
            user = User.objects.create_user(
                email=t['email'], username=t['email'], password='Tutor123!',
                display_name=t['display_name'], first_name=t['first'], last_name=t['last'],
                role='tutor', is_email_verified=True,
            )
            profile = TutorProfile.objects.create(
                user=user, bio=t['bio'], subjects=t['subjects'],
                hourly_rate=t['rate'], experience_years=t['exp'],
                company_email=t['email'], company_email_verified=True,
                verification_status='approved',
                average_rating=t['rating'], total_sessions=t['sessions'],
                total_reviews=int(t['sessions'] * 0.6),
            )
            tutors.append(profile)
        self.stdout.write(self.style.SUCCESS(f'  {len(tutors)} tutors created'))

        # --- Availability Slots ---
        today = date.today()
        slot_count = 0
        for tutor in tutors:
            for day_offset in range(1, 15):
                d = today + timedelta(days=day_offset)
                if d.weekday() < 5:  # weekdays only
                    for hour in [9, 10, 11, 14, 15, 16]:
                        AvailabilitySlot.objects.create(
                            tutor=tutor, date=d,
                            start_time=time(hour, 0), end_time=time(hour + 1, 0),
                        )
                        slot_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {slot_count} availability slots created'))

        # --- Sample Bookings ---
        slots = list(AvailabilitySlot.objects.filter(is_booked=False)[:10])
        booking_count = 0
        for i, slot in enumerate(slots):
            student = students[i % len(students)]
            booking = Booking.objects.create(
                student=student, tutor=slot.tutor, slot=slot,
                subject=slot.tutor.subjects[0] if slot.tutor.subjects else 'General',
                status=random.choice(['confirmed', 'completed', 'completed']),
                price=slot.tutor.hourly_rate,
            )
            slot.is_booked = True
            slot.save()
            PaymentRecord.objects.create(
                booking=booking, amount=booking.price,
                transaction_id=f'test_txn_{booking.id}', status='completed',
            )
            if booking.status == 'completed':
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
        self.stdout.write(self.style.SUCCESS(f'  {booking_count} bookings with payments & reviews created'))

        # --- Forum Categories ---
        categories_data = [
            {'name': 'Computer Science', 'desc': 'Discuss programming, algorithms, data structures, and all things CS.', 'icon': 'code'},
            {'name': 'Mathematics', 'desc': 'Calculus, algebra, statistics, and mathematical proofs.', 'icon': 'functions'},
            {'name': 'General Discussion', 'desc': 'Chat about anything related to university life.', 'icon': 'chat'},
            {'name': 'Study Tips', 'desc': 'Share and discover effective study techniques and resources.', 'icon': 'lightbulb'},
            {'name': 'Career Advice', 'desc': 'CVs, interviews, internships, and graduate opportunities.', 'icon': 'work'},
            {'name': 'Academic Writing', 'desc': 'Essay structure, referencing, dissertations, and reports.', 'icon': 'edit'},
        ]
        categories = []
        for c in categories_data:
            cat = ForumCategory.objects.create(name=c['name'], description=c['desc'], icon=c['icon'])
            categories.append(cat)
        self.stdout.write(self.style.SUCCESS(f'  {len(categories)} forum categories created'))

        # --- Forum Posts ---
        posts_data = [
            {'cat': 0, 'student': 0, 'title': 'Best resources for learning Data Structures?',
             'content': 'I am in my second year studying CS and really struggling with data structures. Can anyone recommend good resources? I have tried YouTube but find it hard to follow along. Looking for textbooks, online courses, or any other resources that helped you understand trees, graphs, and hash tables.',
             'anon': False, 'upvotes': 24, 'replies_count': 8},
            {'cat': 0, 'student': 1, 'title': 'How to approach a final year project proposal?',
             'content': 'I need to submit my FYP proposal next month and I am not sure where to start. Should I pick something I am passionate about or something that looks good on my CV? Any advice from people who have been through this would be really helpful.',
             'anon': False, 'upvotes': 18, 'replies_count': 5},
            {'cat': 2, 'student': 2, 'title': 'Feeling overwhelmed with deadlines — any advice?',
             'content': 'I have three assignments due in the same week and I am really struggling to manage my time. Does anyone have tips for dealing with multiple deadlines at once? I feel like I am falling behind.',
             'anon': True, 'upvotes': 31, 'replies_count': 12},
            {'cat': 3, 'student': 3, 'title': 'Pomodoro technique actually works!',
             'content': 'I started using the Pomodoro technique last week (25 min study, 5 min break) and it has made a huge difference to my focus. I can actually sit down and study for 3-4 hours now without getting distracted. Highly recommend trying it if you struggle with concentration.',
             'anon': False, 'upvotes': 42, 'replies_count': 7, 'pinned': True},
            {'cat': 4, 'student': 4, 'title': 'Is it worth doing a placement year?',
             'content': 'I am debating whether to do a placement year or go straight into final year. Has anyone done a placement and felt it was worth the extra year? I am worried about falling behind my friends but also know the experience could help with jobs after uni.',
             'anon': False, 'upvotes': 15, 'replies_count': 9},
            {'cat': 1, 'student': 0, 'title': 'Tips for understanding proof by induction?',
             'content': 'I keep getting confused with the inductive step in mathematical proofs. The base case makes sense but I lose track when trying to prove it holds for n+1. Any tips or resources that explain this in a simple way?',
             'anon': False, 'upvotes': 11, 'replies_count': 4},
            {'cat': 5, 'student': 1, 'title': 'Harvard vs APA referencing — which do you use?',
             'content': 'My university uses Harvard but I see a lot of journals using APA. Is there a big difference? Also, does anyone have a good guide for Harvard referencing that covers edge cases like government documents and websites?',
             'anon': False, 'upvotes': 8, 'replies_count': 3},
        ]
        sample_replies = [
            'Great question! I found the same thing when I was studying this. Have you tried...',
            'I completely agree. When I was in your position, what helped me was...',
            'This is really useful advice, thanks for sharing!',
            'I struggled with the same thing. My tutor recommended looking at...',
            'Have you tried talking to your module leader? They might be able to help.',
            'I found a really good YouTube channel for this — let me find the link.',
            'Same here! It gets easier after the first few weeks, trust me.',
            'This is a great discussion. I think the key thing is to start early and...',
        ]

        for p in posts_data:
            post = ForumPost.objects.create(
                author=students[p['student']], category=categories[p['cat']],
                title=p['title'], content=p['content'],
                is_anonymous=p.get('anon', False), is_pinned=p.get('pinned', False),
                upvotes=p['upvotes'], reply_count=p['replies_count'],
            )
            for j in range(min(p['replies_count'], 3)):
                ForumReply.objects.create(
                    post=post, author=students[(p['student'] + j + 1) % len(students)],
                    content=random.choice(sample_replies),
                    upvotes=random.randint(0, 10),
                )

        self.stdout.write(self.style.SUCCESS(f'  {len(posts_data)} forum posts with replies created'))

        # --- Notifications ---
        Notification.objects.create(
            user=students[0], notification_type='booking_confirmed',
            title='Session Confirmed', message='Your session with Dr. Jane Doe has been confirmed.',
        )
        Notification.objects.create(
            user=students[0], notification_type='forum_reply',
            title='New reply to your post', message='Someone replied to "Best resources for learning Data Structures?"',
        )

        self.stdout.write(self.style.SUCCESS('\nDatabase seeded successfully!'))
        self.stdout.write(self.style.SUCCESS('Login credentials:'))
        self.stdout.write(f'  Admin:   admin@studyspace.com / Admin123!')
        self.stdout.write(f'  Student: alice@lsbu.ac.uk / Student123!')
        self.stdout.write(f'  Tutor:   dr.jane@lsbu.ac.uk / Tutor123!')
