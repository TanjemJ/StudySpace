from datetime import time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone

from accounts.models import StudentProfile, TutorProfile, User
from forum.models import ForumCategory, ForumPost, ForumReply
from tutoring.models import AvailabilitySlot, Booking, PaymentRecord, Review


STUDENT_PASSWORD = 'Student123!'
TUTOR_PASSWORD = 'Tutor123!'

STUDENTS = [
    ('demo.student01@studyspace.example', 'demostudent01', 'Aisha', 'Khan', 'University of Westminster', 'BSc Computer Science', 2),
    ('demo.student02@studyspace.example', 'demostudent02', 'Daniel', 'Reed', 'London South Bank University', 'BEng Software Engineering', 3),
    ('demo.student03@studyspace.example', 'demostudent03', 'Maya', 'Patel', 'University College London', 'BA English Literature', 1),
    ('demo.student04@studyspace.example', 'demostudent04', 'Omar', 'Hassan', 'Kings College London', 'BSc Mathematics', 2),
    ('demo.student05@studyspace.example', 'demostudent05', 'Emily', 'Brooks', 'Queen Mary University of London', 'BSc Psychology', 3),
    ('demo.student06@studyspace.example', 'demostudent06', 'Leo', 'Nguyen', 'Imperial College London', 'MSc Artificial Intelligence', 5),
    ('demo.student07@studyspace.example', 'demostudent07', 'Sofia', 'Martinez', 'City, University of London', 'BSc Data Science', 2),
    ('demo.student08@studyspace.example', 'demostudent08', 'Noah', 'Wilson', 'University of Greenwich', 'BA Business Management', 1),
    ('demo.student09@studyspace.example', 'demostudent09', 'Priya', 'Sharma', 'Brunel University London', 'BSc Biomedical Science', 2),
    ('demo.student10@studyspace.example', 'demostudent10', 'James', 'Taylor', 'University of Roehampton', 'BA Education Studies', 3),
]

TUTORS = [
    ('demo.tutor01@studyspace.example', 'demotutor01', 'Hannah', 'Morgan', ['Mathematics', 'Statistics', 'Data Analysis'], 14, 3, 'University of Westminster', 'Patient maths tutor focused on confidence, exam technique, and clear worked examples.', 'London', 'W1'),
    ('demo.tutor02@studyspace.example', 'demotutor02', 'Marcus', 'Chen', ['Computer Science', 'Algorithms', 'Python'], 18, 4, 'London South Bank University', 'Software engineer helping students turn difficult programming topics into practical habits.', 'London', 'SE1'),
    ('demo.tutor03@studyspace.example', 'demotutor03', 'Ella', 'Roberts', ['Academic Writing', 'English Literature', 'Essay Skills'], 22, 5, 'University College London', 'Writing coach for essays, dissertations, citations, and building a strong argument.', 'London', 'WC1'),
    ('demo.tutor04@studyspace.example', 'demotutor04', 'Zain', 'Ali', ['Physics', 'Engineering', 'Circuit Analysis'], 25, 4, 'Imperial College London', 'Engineering tutor who uses diagrams and examples to make problem sheets less intimidating.', 'London', 'SW7'),
    ('demo.tutor05@studyspace.example', 'demotutor05', 'Grace', 'Evans', ['Biology', 'Chemistry', 'Biochemistry'], 28, 6, 'Queen Mary University of London', 'Biochemistry researcher supporting first and second year science students.', 'London', 'E1'),
    ('demo.tutor06@studyspace.example', 'demotutor06', 'Ibrahim', 'Suleiman', ['Economics', 'Business', 'Finance'], 30, 5, 'City, University of London', 'Business and economics tutor with a practical approach to models and case studies.', 'London', 'EC1'),
    ('demo.tutor07@studyspace.example', 'demotutor07', 'Nina', 'Kowalski', ['Web Development', 'JavaScript', 'React'], 34, 7, 'University of Greenwich', 'Frontend developer teaching React, accessibility, and project-ready web development.', 'London', 'SE10'),
    ('demo.tutor08@studyspace.example', 'demotutor08', 'Theo', 'Bennett', ['Law', 'Contract Law', 'Tort Law'], 38, 8, 'Kings College London', 'Law mentor helping students structure problem questions and improve legal analysis.', 'London', 'WC2'),
    ('demo.tutor09@studyspace.example', 'demotutor09', 'Riya', 'Desai', ['Machine Learning', 'AI', 'Python'], 42, 6, 'Imperial College London', 'AI tutor focused on Python notebooks, model evaluation, and understanding the maths underneath.', 'London', 'SW7'),
    ('demo.tutor10@studyspace.example', 'demotutor10', 'Benedict', 'Adeyemi', ['Cybersecurity', 'Networking', 'Linux'], 45, 9, 'Brunel University London', 'Cybersecurity practitioner teaching networking, Linux, and security fundamentals.', 'Uxbridge', 'UB8'),
]

FORUM_CATEGORIES = [
    ('General Discussion', 'Everyday university life, questions, and practical advice.', 'forum', 1),
    ('Study Tips & Techniques', 'Revision methods, note-taking, motivation, and exam preparation.', 'lightbulb', 2),
    ('Career & Internships', 'CVs, applications, interviews, placements, and graduate roles.', 'work', 3),
    ('Academic Writing', 'Essay structure, referencing, dissertation planning, and feedback.', 'edit', 4),
    ('Tech & Programming', 'Programming help, debugging, and project support.', 'code', 5),
]

FORUM_POSTS = [
    ('demostudent01', 'Study Tips & Techniques', 'How are people planning revision blocks this term?', 'I am trying to avoid last minute revision this year. Has anyone found a weekly routine that actually sticks?', ['revision', 'planning'], 14),
    ('demostudent02', 'Tech & Programming', 'Best way to practise data structures before exams?', 'I understand the lectures but freeze when the question changes slightly. Any good practice approach?', ['computer-science', 'exams'], 19),
    ('demostudent03', 'Academic Writing', 'How do you make an essay argument feel less flat?', 'My feedback keeps saying I describe too much and do not analyse enough. What helped you improve this?', ['essays', 'feedback'], 11),
    ('demostudent04', 'General Discussion', 'Useful quiet places to study around central London?', 'The library is packed most afternoons. Looking for places where I can work for a few hours without too much noise.', ['campus', 'study-spaces'], 8),
    ('demostudent05', 'Career & Internships', 'Placement applications: how early should I start?', 'I am in second year and not sure when applications really open. Would appreciate advice from anyone who has done it.', ['placements', 'careers'], 21),
    ('demostudent06', 'Tech & Programming', 'Machine learning coursework: how much maths is enough?', 'I can run the code but want to understand the evaluation properly. What concepts should I revise first?', ['machine-learning'], 16),
]

REPLIES = [
    'Breaking topics into three 40 minute sessions helped me more than one long block.',
    'I would start with past papers, then turn mistakes into a checklist.',
    'Office hours are underrated. I bring one focused question and usually leave with a clearer plan.',
    'Try explaining the concept out loud before writing. It exposes the gaps quickly.',
    'I found it useful to keep one document just for common mistakes and fixes.',
]


class Command(BaseCommand):
    help = 'Create safe, clearly labelled StudySpace demo users, tutors, bookings, and forum content.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm-demo-data',
            action='store_true',
            help='Required confirmation flag so this command cannot run accidentally.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not options['confirm_demo_data']:
            raise CommandError('Refusing to seed demo data without --confirm-demo-data.')

        students = self._seed_students()
        tutors = self._seed_tutors()
        slot_count = self._seed_availability(tutors)
        booking_count = self._seed_bookings(students, tutors)
        post_count, reply_count = self._seed_forum(students)

        self.stdout.write(self.style.SUCCESS('Demo data ready.'))
        self.stdout.write(f'  Students: {len(students)}')
        self.stdout.write(f'  Approved tutors: {len(tutors)}')
        self.stdout.write(f'  Availability slots checked/created: {slot_count}')
        self.stdout.write(f'  Demo bookings checked/created: {booking_count}')
        self.stdout.write(f'  Forum posts/replies checked/created: {post_count}/{reply_count}')
        self.stdout.write('Demo tutor password: Tutor123!')
        self.stdout.write('Demo student password: Student123!')

    def _seed_students(self):
        students = []
        for email, display, first, last, university, course, year in STUDENTS:
            user, _ = User.objects.update_or_create(
                email=email,
                defaults={
                    'username': email,
                    'display_name': display,
                    'first_name': first,
                    'last_name': last,
                    'role': User.Role.STUDENT,
                    'is_email_verified': True,
                    'is_active': True,
                },
            )
            user.set_password(STUDENT_PASSWORD)
            user.save(update_fields=['password'])

            StudentProfile.objects.update_or_create(
                user=user,
                defaults={
                    'university': university,
                    'university_email': email,
                    'university_verified': True,
                    'university_verified_at': timezone.now(),
                    'course': course,
                    'year_of_study': year,
                },
            )
            students.append(user)
        return students

    def _seed_tutors(self):
        tutors = []
        for email, display, first, last, subjects, rate, experience, university, bio, city, postcode in TUTORS:
            user, _ = User.objects.update_or_create(
                email=email,
                defaults={
                    'username': email,
                    'display_name': display,
                    'first_name': first,
                    'last_name': last,
                    'role': User.Role.TUTOR,
                    'is_email_verified': True,
                    'is_active': True,
                },
            )
            user.set_password(TUTOR_PASSWORD)
            user.save(update_fields=['password'])

            profile, _ = TutorProfile.objects.update_or_create(
                user=user,
                defaults={
                    'bio': bio,
                    'subjects': subjects,
                    'hourly_rate': Decimal(str(rate)),
                    'experience_years': experience,
                    'company_email': email,
                    'company_email_verified': True,
                    'university': university,
                    'university_verified': True,
                    'university_verified_at': timezone.now(),
                    'location_city': city,
                    'location_postcode_area': postcode,
                    'verification_status': TutorProfile.VerificationStatus.APPROVED,
                    'personal_statement': bio,
                    'rejection_reason': '',
                },
            )
            tutors.append(profile)
        return tutors

    def _seed_availability(self, tutors):
        today = timezone.localdate()
        checked = 0
        patterns = {
            0: [10, 11, 14, 15],
            1: [9, 10, 16, 17],
            2: [12, 13, 18, 19],
        }

        for tutor_index, tutor in enumerate(tutors):
            hours = patterns[tutor_index % len(patterns)]
            for day_offset in range(1, 15):
                slot_date = today + timedelta(days=day_offset)
                if slot_date.weekday() == 6:
                    continue
                for hour in hours:
                    AvailabilitySlot.objects.get_or_create(
                        tutor=tutor,
                        date=slot_date,
                        start_time=time(hour, 0),
                        defaults={'end_time': time(hour + 1, 0), 'is_booked': False},
                    )
                    checked += 1
        return checked

    def _seed_bookings(self, students, tutors):
        today = timezone.localdate()
        ratings = [5, 4, 5, 4, 5, 4, 5, 5, 4, 5]
        comments = [
            'Really clear explanation and practical examples throughout.',
            'The session helped me understand where I was losing marks.',
            'Patient tutor and very well prepared.',
            'Good pace and useful revision plan for the next week.',
            'Excellent support with a topic I had been avoiding.',
        ]
        checked = 0

        for index, tutor in enumerate(tutors):
            student = students[index % len(students)]
            past_date = today - timedelta(days=index + 3)
            slot, _ = AvailabilitySlot.objects.get_or_create(
                tutor=tutor,
                date=past_date,
                start_time=time(10 + (index % 4), 0),
                defaults={'end_time': time(11 + (index % 4), 0), 'is_booked': True},
            )
            slot.is_booked = True
            slot.save(update_fields=['is_booked'])

            booking, _ = Booking.objects.get_or_create(
                student=student,
                tutor=tutor,
                slot=slot,
                defaults={
                    'subject': tutor.subjects[0] if tutor.subjects else 'General',
                    'status': Booking.Status.COMPLETED,
                    'session_type': Booking.SessionType.VIDEO,
                    'video_platform': Booking.VideoPlatform.GOOGLE_MEET,
                    'session_link': 'https://meet.google.com/demo-studyspace',
                    'price': tutor.hourly_rate,
                    'student_note': 'Demo booking used to show completed sessions and reviews.',
                },
            )
            booking.status = Booking.Status.COMPLETED
            booking.price = tutor.hourly_rate
            booking.save(update_fields=['status', 'price', 'updated_at'])

            PaymentRecord.objects.get_or_create(
                booking=booking,
                defaults={
                    'amount': booking.price,
                    'currency': 'GBP',
                    'payment_method': 'demo',
                    'transaction_id': f'demo_{booking.id}',
                    'status': PaymentRecord.PaymentStatus.COMPLETED,
                },
            )

            Review.objects.get_or_create(
                booking=booking,
                defaults={
                    'student': student,
                    'tutor': tutor,
                    'rating': ratings[index % len(ratings)],
                    'comment': comments[index % len(comments)],
                },
            )
            checked += 1

        for tutor in tutors:
            stats = Review.objects.filter(tutor=tutor).aggregate(
                avg_rating=Avg('rating'),
                review_count=Count('id'),
            )
            tutor.average_rating = round(stats['avg_rating'] or 0, 1)
            tutor.total_reviews = stats['review_count'] or 0
            tutor.total_sessions = max(tutor.total_sessions, tutor.total_reviews + 8)
            tutor.save(update_fields=['average_rating', 'total_reviews', 'total_sessions'])

        return checked

    def _seed_forum(self, students):
        categories = {}
        for name, description, icon, order in FORUM_CATEGORIES:
            category, _ = ForumCategory.objects.update_or_create(
                name=name,
                university='',
                defaults={
                    'description': description,
                    'icon': icon,
                    'order': order,
                    'is_university_only': False,
                },
            )
            categories[name] = category

        by_display_name = {student.display_name: student for student in students}
        post_count = 0
        reply_count = 0

        for display_name, category_name, title, content, tags, upvotes in FORUM_POSTS:
            author = by_display_name[display_name]
            category = categories[category_name]
            post, _ = ForumPost.objects.update_or_create(
                title=title,
                category=category,
                defaults={
                    'author': author,
                    'content': content,
                    'university': '',
                    'is_anonymous': False,
                    'upvotes': upvotes,
                    'tags': tags,
                    'is_deleted': False,
                },
            )
            post_count += 1

            for offset, reply_text in enumerate(REPLIES[:3]):
                replier = students[(students.index(author) + offset + 1) % len(students)]
                reply, _ = ForumReply.objects.get_or_create(
                    post=post,
                    author=replier,
                    content=reply_text,
                    defaults={'upvotes': max(0, upvotes // (offset + 4))},
                )
                if reply:
                    reply_count += 1

            post.reply_count = ForumReply.objects.filter(post=post, is_deleted=False).count()
            post.save(update_fields=['reply_count'])

        for category in categories.values():
            category.post_count = ForumPost.objects.filter(category=category, is_deleted=False).count()
            category.save(update_fields=['post_count'])

        return post_count, reply_count
