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
            {'email': 'fatima@lsbu.ac.uk', 'display_name': 'fatima_ai', 'first': 'Fatima', 'last': 'Ahmed',
             'uni': 'London South Bank University', 'course': 'Artificial Intelligence', 'year': 2},
            {'email': 'george@kcl.ac.uk', 'display_name': 'george_law', 'first': 'George', 'last': 'Taylor',
             'uni': 'Kings College London', 'course': 'Law', 'year': 3},
            {'email': 'hannah@ucl.ac.uk', 'display_name': 'hannah_med', 'first': 'Hannah', 'last': 'Patel',
             'uni': 'University College London', 'course': 'Medicine', 'year': 4},
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
                if d.weekday() < 5:
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

        # =============================================
        # FORUM — Global + University-Specific Categories
        # =============================================

        # Global categories (visible to everyone)
        global_cats = [
            {'name': 'General Discussion', 'desc': 'Chat about anything related to university life, share experiences, and connect with students across all universities.', 'icon': 'chat', 'order': 1},
            {'name': 'Study Tips & Techniques', 'desc': 'Share and discover effective study methods, time management strategies, and productivity tools.', 'icon': 'lightbulb', 'order': 2},
            {'name': 'Career & Internships', 'desc': 'CVs, cover letters, interview prep, graduate schemes, internships, and career planning advice.', 'icon': 'work', 'order': 3},
            {'name': 'Academic Writing', 'desc': 'Essay structure, referencing styles, dissertation tips, report writing, and academic integrity.', 'icon': 'edit', 'order': 4},
            {'name': 'Tech & Programming', 'desc': 'Programming help, tech discussions, project ideas, debugging, and software development.', 'icon': 'code', 'order': 5},
            {'name': 'Maths & Science', 'desc': 'Mathematics, physics, chemistry, biology — problem solving and concept explanations.', 'icon': 'functions', 'order': 6},
            {'name': 'Mental Health & Wellbeing', 'desc': 'A supportive space to discuss stress, anxiety, motivation, and looking after yourself at university.', 'icon': 'favorite', 'order': 7},
        ]

        categories = {}
        for c in global_cats:
            cat = ForumCategory.objects.create(
                name=c['name'], description=c['desc'], icon=c['icon'],
                university='', is_university_only=False, order=c['order'],
            )
            categories[c['name']] = cat

        # University-specific categories
        uni_names = [
            'London South Bank University',
            'Kings College London',
            'University College London',
            'Imperial College London',
            'Queen Mary University',
        ]
        uni_cats = {}
        for uni in uni_names:
            short = uni.split(' ')[0] if uni != 'London South Bank University' else 'LSBU'
            if uni == 'Kings College London': short = 'KCL'
            if uni == 'University College London': short = 'UCL'
            if uni == 'Imperial College London': short = 'Imperial'
            if uni == 'Queen Mary University': short = 'QMUL'

            cat = ForumCategory.objects.create(
                name=f'{short} Community',
                description=f'Exclusive forum for verified {uni} students. Discuss modules, societies, campus life, and connect with your peers.',
                icon='school', university=uni, is_university_only=True, order=10,
            )
            uni_cats[uni] = cat

        total_cats = len(global_cats) + len(uni_cats)
        self.stdout.write(self.style.SUCCESS(f'  {total_cats} forum categories created ({len(global_cats)} global + {len(uni_cats)} university-specific)'))

        # =============================================
        # FORUM POSTS — Rich sample content
        # =============================================

        posts_data = [
            # Global posts
            {'cat': 'General Discussion', 'student': 2, 'uni': '', 'title': 'Feeling overwhelmed with deadlines — any advice?',
             'content': 'I have three assignments due in the same week and I am really struggling to manage my time. Does anyone have tips for dealing with multiple deadlines at once? I feel like I am falling behind and it is making me anxious. Any strategies that worked for you?',
             'anon': True, 'upvotes': 31, 'replies_count': 12, 'tags': ['stress', 'deadlines', 'time-management']},

            {'cat': 'Study Tips & Techniques', 'student': 3, 'uni': '', 'title': 'Pomodoro technique actually works!',
             'content': 'I started using the Pomodoro technique last week (25 min study, 5 min break) and it has made a huge difference to my focus. I can actually sit down and study for 3-4 hours now without getting distracted. I use an app called Forest which plants a virtual tree while you focus. Highly recommend trying it if you struggle with concentration.',
             'anon': False, 'upvotes': 42, 'replies_count': 7, 'pinned': True, 'tags': ['pomodoro', 'focus', 'productivity']},

            {'cat': 'Career & Internships', 'student': 4, 'uni': '', 'title': 'Is it worth doing a placement year?',
             'content': 'I am debating whether to do a placement year or go straight into final year. Has anyone done a placement and felt it was worth the extra year? I am worried about falling behind my friends but also know the experience could help with jobs after uni. Would love to hear from people who have been through this decision.',
             'anon': False, 'upvotes': 15, 'replies_count': 9, 'tags': ['placement', 'career', 'advice']},

            {'cat': 'Tech & Programming', 'student': 0, 'uni': '', 'title': 'Best resources for learning Data Structures?',
             'content': 'I am in my second year studying CS and really struggling with data structures. Can anyone recommend good resources? I have tried YouTube but find it hard to follow along without practice problems. Looking for textbooks, online courses, or interactive platforms that helped you understand trees, graphs, hash tables, and sorting algorithms. Free resources preferred but happy to pay if it is worth it.',
             'anon': False, 'upvotes': 24, 'replies_count': 8, 'tags': ['data-structures', 'cs', 'resources', 'algorithms']},

            {'cat': 'Tech & Programming', 'student': 1, 'uni': '', 'title': 'How to approach a final year project proposal?',
             'content': 'I need to submit my FYP proposal next month and I am not sure where to start. Should I pick something I am passionate about or something that looks good on my CV? How detailed does the proposal need to be? Any advice from people who have been through this would be really helpful. My supervisor has not been very responsive so I am mostly figuring this out on my own.',
             'anon': False, 'upvotes': 18, 'replies_count': 5, 'tags': ['fyp', 'dissertation', 'proposal']},

            {'cat': 'Maths & Science', 'student': 0, 'uni': '', 'title': 'Tips for understanding proof by induction?',
             'content': 'I keep getting confused with the inductive step in mathematical proofs. The base case makes sense but I lose track when trying to prove it holds for n+1. Any tips or resources that explain this in a simple way? My lecturer goes through it really fast and I can not keep up.',
             'anon': False, 'upvotes': 11, 'replies_count': 4, 'tags': ['maths', 'proofs', 'induction']},

            {'cat': 'Academic Writing', 'student': 6, 'uni': '', 'title': 'Harvard vs APA referencing — which do you use?',
             'content': 'My university uses Harvard but I see a lot of journals using APA. Is there a big difference? Also, does anyone have a good guide for Harvard referencing that covers edge cases like government documents, websites with no author, and social media posts? I keep getting marked down for small referencing errors.',
             'anon': False, 'upvotes': 8, 'replies_count': 3, 'tags': ['referencing', 'harvard', 'apa', 'writing']},

            {'cat': 'Career & Internships', 'student': 5, 'uni': '', 'title': 'How to write a cover letter for a tech internship?',
             'content': 'I have been applying to summer internships at tech companies but keep getting rejected. I think my cover letter might be the problem. Does anyone have tips for writing a good cover letter for software engineering roles? Should I mention specific projects? How long should it be? Any examples would be really helpful.',
             'anon': False, 'upvotes': 22, 'replies_count': 6, 'tags': ['cover-letter', 'internship', 'tech', 'applications']},

            {'cat': 'Mental Health & Wellbeing', 'student': 7, 'uni': '', 'title': 'How do you deal with imposter syndrome at university?',
             'content': 'I constantly feel like I do not belong at my university and that everyone else is smarter than me. Even when I get good grades, I feel like it was just luck. Does anyone else experience this? How do you deal with it? I am in my final year and it is getting worse as the workload increases.',
             'anon': True, 'upvotes': 38, 'replies_count': 14, 'tags': ['imposter-syndrome', 'mental-health', 'support']},

            {'cat': 'General Discussion', 'student': 3, 'uni': '', 'title': 'Best study spots in London?',
             'content': 'Looking for quiet places to study in London that are not just the university library. Coffee shops, public libraries, co-working spaces — anything goes. Bonus points if they have good wifi and are not too expensive. I usually study in central London but open to anywhere on the tube lines.',
             'anon': False, 'upvotes': 19, 'replies_count': 11, 'tags': ['london', 'study-spots', 'libraries']},

            {'cat': 'Tech & Programming', 'student': 5, 'uni': '', 'title': 'React vs Vue vs Angular for a beginner — which should I learn?',
             'content': 'I have basic HTML, CSS and JavaScript knowledge and want to learn a frontend framework. My university teaches Angular but most job listings seem to want React. Vue looks simpler to start with. Which would you recommend for someone who wants to get a junior developer job after graduation? Should I just focus on one or learn the basics of all three?',
             'anon': False, 'upvotes': 27, 'replies_count': 13, 'tags': ['react', 'vue', 'angular', 'frontend', 'career']},

            # University-specific posts — LSBU
            {'cat_uni': 'London South Bank University', 'student': 0, 'uni': 'London South Bank University',
             'title': 'CS module choices for final year — what did you pick?',
             'content': 'Trying to decide my optional modules for final year Computer Science at LSBU. Thinking about AI and Machine Learning, Cloud Computing, or Cyber Security. Has anyone taken any of these? Which lecturers are good? Which ones have heavy coursework vs exams?',
             'anon': False, 'upvotes': 9, 'replies_count': 5, 'tags': ['lsbu', 'modules', 'cs']},

            {'cat_uni': 'London South Bank University', 'student': 5, 'uni': 'London South Bank University',
             'title': 'LSBU Hackathon Society — anyone interested in joining?',
             'content': 'Thinking of starting a hackathon society at LSBU. We would organise monthly coding challenges, workshops, and maybe enter external competitions. If you are interested in coding, design, or just want to build cool things with other students, let me know! We need at least 10 people to register as an official society.',
             'anon': False, 'upvotes': 14, 'replies_count': 6, 'tags': ['lsbu', 'hackathon', 'society', 'coding']},

            # University-specific posts — KCL
            {'cat_uni': 'Kings College London', 'student': 1, 'uni': 'Kings College London',
             'title': 'KCL Engineering lab access during Easter break?',
             'content': 'Does anyone know if the engineering labs at Strand campus are open during Easter break? I need to finish my group project prototype and could really use the workshop equipment. The website says opening hours might change but does not give specifics.',
             'anon': False, 'upvotes': 5, 'replies_count': 2, 'tags': ['kcl', 'labs', 'engineering']},

            {'cat_uni': 'Kings College London', 'student': 6, 'uni': 'Kings College London',
             'title': 'Best lunch spots near Guy\'s Campus?',
             'content': 'Just transferred to Guy\'s Campus and don\'t know the area well. Where do you all go for affordable lunch? The campus canteen is quite expensive and gets really crowded around 1pm. Any hidden gems nearby?',
             'anon': False, 'upvotes': 12, 'replies_count': 8, 'tags': ['kcl', 'food', 'campus']},

            # University-specific posts — UCL
            {'cat_uni': 'University College London', 'student': 2, 'uni': 'University College London',
             'title': 'UCL Maths study group — looking for members',
             'content': 'I am organising a weekly study group for second year maths students at UCL. We would meet every Wednesday afternoon in the Science Library to work through problem sheets together. All welcome regardless of ability — the idea is to help each other. DM me if interested!',
             'anon': False, 'upvotes': 16, 'replies_count': 4, 'tags': ['ucl', 'maths', 'study-group']},

            # University-specific posts — Imperial
            {'cat_uni': 'Imperial College London', 'student': 3, 'uni': 'Imperial College London',
             'title': 'Imperial Computing — anyone else finding Year 2 much harder?',
             'content': 'First year felt manageable but second year has been a huge step up. Concurrent programming, algorithms, and the group project are all hitting at once. Is it just me or does everyone find the jump from Year 1 to Year 2 quite intense? Any tips for coping?',
             'anon': True, 'upvotes': 21, 'replies_count': 9, 'tags': ['imperial', 'computing', 'year2']},
        ]

        sample_replies = [
            'Great question! I found the same thing when I was studying this. What really helped me was breaking it down into smaller chunks and tackling one concept at a time.',
            'I completely agree with this. When I was in your position, what helped me most was finding a study group — having other people to discuss with makes such a difference.',
            'This is really useful advice, thanks for sharing! I have been looking for something like this.',
            'I struggled with the same thing last year. My tutor recommended looking at the MIT OpenCourseWare resources — they are free and really well structured.',
            'Have you tried talking to your module leader? They might be able to point you to additional support or extend a deadline if you explain your situation.',
            'I found a really good YouTube channel for this called 3Blue1Brown — they explain mathematical concepts visually which made everything click for me.',
            'Same experience here! It does get easier after the first few weeks once you build up your foundations. Keep pushing through.',
            'This is a great discussion. I think the key thing is to start early and not leave everything to the last minute. Even 30 minutes a day makes a huge difference over a few weeks.',
            'Have you looked at Anki for flashcards? It uses spaced repetition and has been a game changer for my revision.',
            'I would also recommend the StudySpace AI assistant for working through problems step by step — it does not give you answers but helps you think through the logic.',
            'Totally relate to this. University can feel isolating sometimes but remember that most people around you are feeling the same way, even if they don\'t show it.',
            'Great post! I\'d add that consistency is more important than intensity. Studying for 2 hours every day beats cramming for 12 hours the night before.',
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
                author=students[p['student']],
                category=category,
                title=p['title'],
                content=p['content'],
                university=p.get('uni', ''),
                is_anonymous=p.get('anon', False),
                is_pinned=p.get('pinned', False),
                upvotes=p['upvotes'],
                reply_count=p['replies_count'],
                tags=p.get('tags', []),
            )

            # Create sample replies (3-4 per post)
            num_replies = min(p['replies_count'], random.randint(3, 5))
            for j in range(num_replies):
                reply_author_idx = (p['student'] + j + 1) % len(students)
                ForumReply.objects.create(
                    post=post,
                    author=students[reply_author_idx],
                    content=random.choice(sample_replies),
                    upvotes=random.randint(0, 15),
                )
            post_count += 1

        # Update category post counts
        for cat in ForumCategory.objects.all():
            cat.post_count = ForumPost.objects.filter(category=cat, is_flagged=False).count()
            cat.save()

        self.stdout.write(self.style.SUCCESS(f'  {post_count} forum posts with replies created'))

        # --- Notifications ---
        Notification.objects.create(
            user=students[0], notification_type='booking_confirmed',
            title='Session Confirmed', message='Your session with Dr. Jane Doe has been confirmed.',
        )
        Notification.objects.create(
            user=students[0], notification_type='forum_reply',
            title='New reply to your post', message='Someone replied to "Best resources for learning Data Structures?"',
        )
        Notification.objects.create(
            user=students[2], notification_type='forum_reply',
            title='New reply to your post', message='3 people replied to your anonymous post about deadlines.',
        )

        self.stdout.write(self.style.SUCCESS('\nDatabase seeded successfully!'))
        self.stdout.write(self.style.SUCCESS('Login credentials:'))
        self.stdout.write(f'  Admin:   admin@studyspace.com / Admin123!')
        self.stdout.write(f'  Student: alice@lsbu.ac.uk / Student123! (LSBU)')
        self.stdout.write(f'  Student: bob@kcl.ac.uk / Student123! (KCL)')
        self.stdout.write(f'  Student: charlie@ucl.ac.uk / Student123! (UCL)')
        self.stdout.write(f'  Tutor:   dr.jane@lsbu.ac.uk / Tutor123!')
