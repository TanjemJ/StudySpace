from datetime import date, time, timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Avg, Count, Q
from django.utils import timezone

from accounts.models import (
    Notification,
    StudentProfile,
    TutorProfile,
    UniversityDomain,
    User,
)
from forum.models import ForumCategory, ForumPost, ForumReply, ModerationLog, Report
from messaging.models import ChatMessage, Conversation, ConversationParticipant
from tutoring.models import (
    AvailabilitySlot,
    Booking,
    BookingChangeRequest,
    PaymentRecord,
    Review,
)


STUDENT_PASSWORD = "Student123!"
TUTOR_PASSWORD = "Tutor123!"
ADMIN_PASSWORD = "Admin123!"
DEMO_ADMIN_EMAIL = "demo.admin@studyspace.example"
DEMO_DOMAIN = "@studyspace.example"


UNIVERSITIES = [
    ("lsbu.ac.uk", "London South Bank University"),
    ("westminster.ac.uk", "University of Westminster"),
    ("ucl.ac.uk", "University College London"),
    ("kcl.ac.uk", "Kings College London"),
    ("imperial.ac.uk", "Imperial College London"),
    ("qmul.ac.uk", "Queen Mary University of London"),
    ("city.ac.uk", "City, University of London"),
    ("greenwich.ac.uk", "University of Greenwich"),
    ("brunel.ac.uk", "Brunel University London"),
    ("roehampton.ac.uk", "University of Roehampton"),
]


STUDENTS = [
    {
        "key": "aisha",
        "email": "aisha.khan@studyspace.example",
        "display_name": "AishaKhan",
        "first_name": "Aisha",
        "last_name": "Khan",
        "dob": date(2003, 6, 14),
        "university": "London South Bank University",
        "university_email": "aisha.khan@lsbu.ac.uk",
        "course": "BSc Computer Science",
        "year": 2,
        "avatar": "student-aisha-khan.jpg",
    },
    {
        "key": "daniel",
        "email": "daniel.reed@studyspace.example",
        "display_name": "DanielReed",
        "first_name": "Daniel",
        "last_name": "Reed",
        "dob": date(2002, 11, 3),
        "university": "University of Westminster",
        "university_email": "daniel.reed@westminster.ac.uk",
        "course": "BSc Cyber Security",
        "year": 3,
        "avatar": "student-daniel-reed.jpg",
    },
    {
        "key": "maya",
        "email": "maya.patel@studyspace.example",
        "display_name": "MayaPatel",
        "first_name": "Maya",
        "last_name": "Patel",
        "dob": date(2005, 2, 21),
        "university": "University College London",
        "university_email": "maya.patel@ucl.ac.uk",
        "course": "BA English Literature",
        "year": 1,
        "avatar": "student-maya-patel.jpg",
    },
    {
        "key": "omar",
        "email": "omar.hassan@studyspace.example",
        "display_name": "OmarHassan",
        "first_name": "Omar",
        "last_name": "Hassan",
        "dob": date(2004, 8, 9),
        "university": "Kings College London",
        "university_email": "omar.hassan@kcl.ac.uk",
        "course": "BSc Mathematics",
        "year": 2,
        "avatar": "student-omar-hassan.jpg",
    },
    {
        "key": "emily",
        "email": "emily.brooks@studyspace.example",
        "display_name": "EmilyBrooks",
        "first_name": "Emily",
        "last_name": "Brooks",
        "dob": date(2003, 12, 18),
        "university": "Queen Mary University of London",
        "university_email": "emily.brooks@qmul.ac.uk",
        "course": "BSc Psychology",
        "year": 3,
        "avatar": "student-emily-brooks.jpg",
    },
    {
        "key": "leo",
        "email": "leo.nguyen@studyspace.example",
        "display_name": "LeoNguyen",
        "first_name": "Leo",
        "last_name": "Nguyen",
        "dob": date(2001, 5, 6),
        "university": "Imperial College London",
        "university_email": "leo.nguyen@imperial.ac.uk",
        "course": "MSc Artificial Intelligence",
        "year": 5,
        "avatar": "student-leo-nguyen.jpg",
    },
    {
        "key": "sofia",
        "email": "sofia.martinez@studyspace.example",
        "display_name": "SofiaMartinez",
        "first_name": "Sofia",
        "last_name": "Martinez",
        "dob": date(2004, 1, 29),
        "university": "City, University of London",
        "university_email": "sofia.martinez@city.ac.uk",
        "course": "BSc Data Science",
        "year": 2,
        "avatar": "student-sofia-martinez.jpg",
    },
    {
        "key": "noah",
        "email": "noah.wilson@studyspace.example",
        "display_name": "NoahWilson",
        "first_name": "Noah",
        "last_name": "Wilson",
        "dob": date(2005, 3, 11),
        "university": "University of Greenwich",
        "university_email": "noah.wilson@greenwich.ac.uk",
        "course": "BA Business Management",
        "year": 1,
        "avatar": "student-noah-wilson.jpg",
    },
    {
        "key": "priya",
        "email": "priya.sharma@studyspace.example",
        "display_name": "PriyaSharma",
        "first_name": "Priya",
        "last_name": "Sharma",
        "dob": date(2004, 9, 1),
        "university": "Brunel University London",
        "university_email": "priya.sharma@brunel.ac.uk",
        "course": "BSc Biomedical Science",
        "year": 2,
        "avatar": "student-priya-sharma.jpg",
    },
    {
        "key": "james",
        "email": "james.taylor@studyspace.example",
        "display_name": "JamesTaylor",
        "first_name": "James",
        "last_name": "Taylor",
        "dob": date(2002, 7, 24),
        "university": "University of Roehampton",
        "university_email": "james.taylor@roehampton.ac.uk",
        "course": "BA Education Studies",
        "year": 3,
        "avatar": "student-james-taylor.jpg",
    },
    {
        "key": "chloe",
        "email": "chloe.martin@studyspace.example",
        "display_name": "ChloeMartin",
        "first_name": "Chloe",
        "last_name": "Martin",
        "dob": date(2004, 4, 2),
        "university": "London South Bank University",
        "university_email": "chloe.martin@lsbu.ac.uk",
        "course": "LLB Law",
        "year": 2,
        "avatar": "student-chloe-martin.jpg",
    },
    {
        "key": "yusuf",
        "email": "yusuf.ahmed@studyspace.example",
        "display_name": "YusufAhmed",
        "first_name": "Yusuf",
        "last_name": "Ahmed",
        "dob": date(2005, 10, 5),
        "university": "University of Westminster",
        "university_email": "yusuf.ahmed@westminster.ac.uk",
        "course": "BSc Software Engineering",
        "year": 1,
        "avatar": "student-yusuf-ahmed.jpg",
    },
]


TUTORS = [
    {
        "key": "hannah",
        "email": "demo.tutor01@studyspace.example",
        "display_name": "HannahMorgan",
        "first_name": "Hannah",
        "last_name": "Morgan",
        "dob": date(1998, 4, 12),
        "subjects": ["Mathematics", "Statistics", "Data Analysis"],
        "rate": "14.50",
        "experience": 3,
        "university": "University of Westminster",
        "company_email": "hannah.morgan@westminster.ac.uk",
        "city": "Westminster",
        "postcode": "W1",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online and in-person",
        "sessions": 32,
        "bio": (
            "Patient maths tutor based near Marylebone. I help first and second year "
            "students rebuild confidence with statistics, linear algebra, and exam "
            "style questions using clear worked examples."
        ),
        "avatar": "tutor-hannah-morgan.jpg",
    },
    {
        "key": "marcus",
        "email": "demo.tutor02@studyspace.example",
        "display_name": "MarcusChen",
        "first_name": "Marcus",
        "last_name": "Chen",
        "dob": date(1997, 9, 30),
        "subjects": ["Computer Science", "Algorithms", "Python"],
        "rate": "18.75",
        "experience": 4,
        "university": "London South Bank University",
        "company_email": "marcus.chen@lsbu.ac.uk",
        "city": "South Bank",
        "postcode": "SE1",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online only",
        "sessions": 41,
        "bio": (
            "Software engineer and part-time tutor for programming modules. I focus "
            "on debugging habits, data structures, Python coursework, and explaining "
            "why an algorithm works rather than just memorising it."
        ),
        "avatar": "tutor-marcus-chen.jpg",
    },
    {
        "key": "ella",
        "email": "ella.roberts@studyspace.example",
        "display_name": "EllaRoberts",
        "first_name": "Ella",
        "last_name": "Roberts",
        "dob": date(1996, 1, 17),
        "subjects": ["Academic Writing", "English Literature", "Essay Skills"],
        "rate": "22.40",
        "experience": 5,
        "university": "University College London",
        "company_email": "ella.roberts@ucl.ac.uk",
        "city": "Bloomsbury",
        "postcode": "WC1",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online and in-person",
        "sessions": 58,
        "bio": (
            "Academic writing coach for essays, literature modules, and dissertation "
            "planning. I help students turn descriptive drafts into stronger arguments "
            "with better structure and cleaner referencing."
        ),
        "avatar": "tutor-ella-roberts.jpg",
    },
    {
        "key": "zain",
        "email": "zain.ali@studyspace.example",
        "display_name": "ZainAli",
        "first_name": "Zain",
        "last_name": "Ali",
        "dob": date(1995, 8, 6),
        "subjects": ["Physics", "Engineering", "Circuit Analysis"],
        "rate": "25.90",
        "experience": 4,
        "university": "Imperial College London",
        "company_email": "zain.ali@imperial.ac.uk",
        "city": "South Kensington",
        "postcode": "SW7",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "In-person preferred",
        "sessions": 36,
        "bio": (
            "Engineering tutor who uses diagrams and real lab examples to make "
            "problem sheets less intimidating. Strong fit for mechanics, circuits, "
            "and foundation physics."
        ),
        "avatar": "tutor-zain-ali.jpg",
    },
    {
        "key": "grace",
        "email": "grace.evans@studyspace.example",
        "display_name": "GraceEvans",
        "first_name": "Grace",
        "last_name": "Evans",
        "dob": date(1994, 12, 20),
        "subjects": ["Biology", "Chemistry", "Biochemistry"],
        "rate": "28.25",
        "experience": 6,
        "university": "Queen Mary University of London",
        "company_email": "grace.evans@qmul.ac.uk",
        "city": "Whitechapel",
        "postcode": "E1",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online only",
        "sessions": 74,
        "bio": (
            "Biochemistry researcher supporting first and second year science "
            "students. I use diagrams, active recall, and short quizzes to make "
            "dense topics easier to revise."
        ),
        "avatar": "tutor-grace-evans.jpg",
    },
    {
        "key": "ibrahim",
        "email": "ibrahim.suleiman@studyspace.example",
        "display_name": "IbrahimS",
        "first_name": "Ibrahim",
        "last_name": "Suleiman",
        "dob": date(1993, 2, 4),
        "subjects": ["Economics", "Business", "Finance"],
        "rate": "30.60",
        "experience": 5,
        "university": "City, University of London",
        "company_email": "ibrahim.suleiman@city.ac.uk",
        "city": "Clerkenwell",
        "postcode": "EC1",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online and in-person",
        "sessions": 49,
        "bio": (
            "Business and economics tutor with a practical approach to models, "
            "case studies, and finance calculations. Good for students who want "
            "examples tied to current UK markets."
        ),
        "avatar": "tutor-ibrahim-suleiman.jpg",
    },
    {
        "key": "nina",
        "email": "nina.kowalski@studyspace.example",
        "display_name": "NinaKowalski",
        "first_name": "Nina",
        "last_name": "Kowalski",
        "dob": date(1998, 3, 22),
        "subjects": ["Web Development", "JavaScript", "React"],
        "rate": "34.50",
        "experience": 7,
        "university": "University of Greenwich",
        "company_email": "nina.kowalski@greenwich.ac.uk",
        "city": "Greenwich",
        "postcode": "SE10",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online only",
        "sessions": 86,
        "bio": (
            "Frontend developer teaching React, accessibility, and project-ready "
            "web development. Sessions are practical and usually involve improving "
            "a real component or debugging a real issue."
        ),
        "avatar": "tutor-nina-kowalski.jpg",
    },
    {
        "key": "theo",
        "email": "theo.bennett@studyspace.example",
        "display_name": "TheoBennett",
        "first_name": "Theo",
        "last_name": "Bennett",
        "dob": date(1992, 7, 11),
        "subjects": ["Law", "Contract Law", "Tort Law"],
        "rate": "39.25",
        "experience": 8,
        "university": "Kings College London",
        "company_email": "theo.bennett@kcl.ac.uk",
        "city": "Strand",
        "postcode": "WC2",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "In-person preferred",
        "sessions": 103,
        "bio": (
            "Law mentor helping students structure problem questions and improve "
            "legal analysis. I focus on issue spotting, clean authorities, and "
            "writing answers under time pressure."
        ),
        "avatar": "tutor-theo-bennett.jpg",
    },
    {
        "key": "riya",
        "email": "riya.desai@studyspace.example",
        "display_name": "RiyaDesai",
        "first_name": "Riya",
        "last_name": "Desai",
        "dob": date(1996, 10, 2),
        "subjects": ["Machine Learning", "AI", "Python"],
        "rate": "42.80",
        "experience": 6,
        "university": "Imperial College London",
        "company_email": "riya.desai@imperial.ac.uk",
        "city": "South Kensington",
        "postcode": "SW7",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online only",
        "sessions": 69,
        "bio": (
            "AI tutor focused on Python notebooks, model evaluation, and the maths "
            "underneath machine learning. I am especially useful for students who "
            "can run the code but want to understand the results."
        ),
        "avatar": "tutor-riya-desai.jpg",
    },
    {
        "key": "amara",
        "email": "amara.lewis@studyspace.example",
        "display_name": "AmaraLewis",
        "first_name": "Amara",
        "last_name": "Lewis",
        "dob": date(1997, 5, 19),
        "subjects": ["Psychology", "Research Methods", "SPSS"],
        "rate": "24.75",
        "experience": 3,
        "university": "University of Roehampton",
        "company_email": "amara.lewis@roehampton.ac.uk",
        "city": "Lambeth",
        "postcode": "SE11",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online and in-person",
        "sessions": 27,
        "bio": (
            "Psychology tutor for research methods, SPSS, and cognitive psychology. "
            "I help students design studies, understand results, and write methods "
            "sections with fewer surprises."
        ),
        "avatar": "tutor-amara-lewis.jpg",
    },
    {
        "key": "callum",
        "email": "callum.fraser@studyspace.example",
        "display_name": "CallumFraser",
        "first_name": "Callum",
        "last_name": "Fraser",
        "dob": date(1991, 11, 13),
        "subjects": ["Accounting", "Finance", "Business Studies"],
        "rate": "19.90",
        "experience": 4,
        "university": "Brunel University London",
        "company_email": "callum.fraser@brunel.ac.uk",
        "city": "Canary Wharf",
        "postcode": "E14",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online only",
        "sessions": 44,
        "bio": (
            "ACA-qualified finance tutor. I make financial statements, management "
            "accounting, and valuation calculations feel less abstract by working "
            "through realistic examples."
        ),
        "avatar": "tutor-callum-fraser.jpg",
    },
    {
        "key": "farah",
        "email": "farah.rahman@studyspace.example",
        "display_name": "FarahRahman",
        "first_name": "Farah",
        "last_name": "Rahman",
        "dob": date(1995, 6, 8),
        "subjects": ["Cybersecurity", "Networking", "Linux"],
        "rate": "31.20",
        "experience": 5,
        "university": "University of Westminster",
        "company_email": "farah.rahman@westminster.ac.uk",
        "city": "Shoreditch",
        "postcode": "E2",
        "status": TutorProfile.VerificationStatus.APPROVED,
        "mode": "Online and in-person",
        "sessions": 52,
        "bio": (
            "Cybersecurity practitioner teaching networking, Linux, and defensive "
            "security fundamentals. Ideal for students preparing for labs, reports, "
            "or practical demos."
        ),
        "avatar": "tutor-farah-rahman.jpg",
    },
    {
        "key": "samira",
        "email": "samira.nasser@studyspace.example",
        "display_name": "SamiraNasser",
        "first_name": "Samira",
        "last_name": "Nasser",
        "dob": date(1999, 1, 10),
        "subjects": ["English Literature", "Dissertation Planning"],
        "rate": "16.80",
        "experience": 2,
        "university": "University College London",
        "company_email": "samira.nasser@ucl.ac.uk",
        "city": "Camden",
        "postcode": "NW1",
        "status": TutorProfile.VerificationStatus.UNDER_REVIEW,
        "mode": "Online and in-person",
        "sessions": 0,
        "bio": "Pending demo tutor for the admin verification queue.",
        "avatar": "tutor-samira-nasser.jpg",
    },
    {
        "key": "louis",
        "email": "louis.carter@studyspace.example",
        "display_name": "LouisCarter",
        "first_name": "Louis",
        "last_name": "Carter",
        "dob": date(1998, 7, 15),
        "subjects": ["Chemistry", "Organic Chemistry"],
        "rate": "21.30",
        "experience": 2,
        "university": "Queen Mary University of London",
        "company_email": "louis.carter@qmul.ac.uk",
        "city": "Mile End",
        "postcode": "E3",
        "status": TutorProfile.VerificationStatus.PENDING,
        "mode": "Online only",
        "sessions": 0,
        "bio": "Pending demo tutor with documents waiting for admin review.",
        "avatar": "tutor-louis-carter.jpg",
    },
    {
        "key": "meera",
        "email": "meera.shah@studyspace.example",
        "display_name": "MeeraShah",
        "first_name": "Meera",
        "last_name": "Shah",
        "dob": date(1996, 9, 27),
        "subjects": ["UX Research", "Human Computer Interaction"],
        "rate": "27.40",
        "experience": 4,
        "university": "City, University of London",
        "company_email": "meera.shah@city.ac.uk",
        "city": "Angel",
        "postcode": "N1",
        "status": TutorProfile.VerificationStatus.INFO_REQUESTED,
        "mode": "Online and in-person",
        "sessions": 0,
        "bio": "Demo tutor with extra information requested by admin.",
        "avatar": "tutor-meera-shah.jpg",
    },
    {
        "key": "patrick",
        "email": "patrick.oneill@studyspace.example",
        "display_name": "PatrickONeill",
        "first_name": "Patrick",
        "last_name": "ONeill",
        "dob": date(1994, 2, 28),
        "subjects": ["Economics", "Macroeconomics"],
        "rate": "20.10",
        "experience": 1,
        "university": "London South Bank University",
        "company_email": "patrick.oneill@lsbu.ac.uk",
        "city": "Borough",
        "postcode": "SE1",
        "status": TutorProfile.VerificationStatus.REJECTED,
        "mode": "Online only",
        "sessions": 0,
        "bio": "Rejected demo tutor used to show the moderation and verification trail.",
        "avatar": "tutor-patrick-oneill.jpg",
    },
]


LEGACY_DEMO_EMAILS = {
    "alice@lsbu.ac.uk",
    "bob@kcl.ac.uk",
    "charlie@ucl.ac.uk",
    "diana@imperial.ac.uk",
    "edward@qmul.ac.uk",
    "fatima@lsbu.ac.uk",
    "george@kcl.ac.uk",
    "hannah@ucl.ac.uk",
    "dr.jane@lsbu.ac.uk",
    "prof.ahmed@kcl.ac.uk",
    "sarah.t@ucl.ac.uk",
    "mike.r@imperial.ac.uk",
    "emma.b@qmul.ac.uk",
    "james.p@lsbu.ac.uk",
    "lisa.morgan@city.ac.uk",
    "tom.garcia@westminster.ac.uk",
    "priya.s@imperial.ac.uk",
    "ryan.o@greenwich.ac.uk",
    "amelia.j@ucl.ac.uk",
    "david.k@brunel.ac.uk",
    "rachel.m@lsbu.ac.uk",
    "yuki.t@qmul.ac.uk",
    "benedict.a@city.ac.uk",
    "nadia.r@roehampton.ac.uk",
    "alex.w@westminster.ac.uk",
    "demo.student01@studyspace.example",
    "demo.student02@studyspace.example",
    "demo.student03@studyspace.example",
    "demo.student04@studyspace.example",
    "demo.student05@studyspace.example",
    "demo.student06@studyspace.example",
    "demo.student07@studyspace.example",
    "demo.student08@studyspace.example",
    "demo.student09@studyspace.example",
    "demo.student10@studyspace.example",
    "demostudent01@studyspace.example",
}


GLOBAL_CATEGORIES = [
    ("General Discussion", "Everyday university life, practical questions, and peer advice.", "forum", 1),
    ("Study Tips & Techniques", "Revision methods, note-taking, motivation, and exam preparation.", "lightbulb", 2),
    ("Career & Internships", "CVs, applications, interviews, placements, and graduate roles.", "work", 3),
    ("Academic Writing", "Essay structure, referencing, dissertation planning, and feedback.", "edit", 4),
    ("Tech & Programming", "Programming help, debugging, coursework, and project support.", "code", 5),
    ("Maths & Science", "Maths, physics, chemistry, biology, and lab-work support.", "functions", 6),
    ("Wellbeing & Balance", "Stress, routines, confidence, and staying steady during term.", "favorite", 7),
]


UNIVERSITY_CATEGORIES = [
    ("LSBU Discussion", "London South Bank University", "Private discussion for verified LSBU students and tutors.", "school", 20),
    ("UOW Students", "University of Westminster", "University of Westminster posts, campus tips, and module questions.", "school", 21),
    ("UCL Students", "University College London", "Verified UCL community space for study and campus advice.", "school", 22),
    ("KCL Students", "Kings College London", "Verified KCL community space for coursework and opportunities.", "school", 23),
    ("QMUL Students", "Queen Mary University of London", "Verified QMUL space for campus, modules, and commuting tips.", "school", 24),
    ("Imperial Students", "Imperial College London", "Verified Imperial space for technical modules and lab advice.", "school", 25),
]


POST_DATA = [
    {
        "author": "aisha",
        "category": "Study Tips & Techniques",
        "title": "How are people planning revision without burning out?",
        "content": (
            "I am trying to avoid last minute revision this term. Has anyone found "
            "a weekly routine that actually sticks when lectures and coursework are both busy?"
        ),
        "tags": ["revision", "planning"],
        "upvotes": 18,
        "hours_ago": 5,
        "pinned": True,
        "replies": [
            ("daniel", "Two 45 minute blocks with a real break works better for me than one long session.", [
                ("aisha", "That sounds manageable. Do you plan topics in advance or pick them on the day?"),
                ("daniel", "I plan the first topic, then use mistakes from that session to choose the second one."),
            ]),
            ("maya", "I keep Sundays for light review only. It stops the week from feeling like one giant deadline."),
            ("omar", "Past paper questions early helped me because I could see what lecturers actually test."),
        ],
    },
    {
        "author": "daniel",
        "category": "Tech & Programming",
        "title": "Best way to practise data structures before the exam?",
        "content": (
            "I understand linked lists and trees in lectures, but I freeze when the "
            "question changes slightly. What practice helped you make the ideas stick?"
        ),
        "tags": ["computer-science", "algorithms", "exams"],
        "upvotes": 25,
        "hours_ago": 11,
        "replies": [
            ("leo", "Draw the structure first, then write tiny operations by hand before touching code.", [
                ("daniel", "Good shout. I think I jump into Python too quickly."),
                ("sofia", "Same. Whiteboard-style practice made recursion less mysterious for me."),
            ]),
            ("marcus", "Try tracing insert, delete, and search with the same example input. That exposes gaps fast."),
            ("yusuf", "I use LeetCode easy questions but force myself to explain the Big O out loud."),
            ("aisha", "Our tutor made us build a mistake log. Annoying at first, useful before the exam."),
        ],
    },
    {
        "author": "maya",
        "category": "Academic Writing",
        "title": "My feedback keeps saying I describe too much",
        "content": (
            "The marker says my essays need more analysis. I understand the text, "
            "but I struggle to turn that into an argument rather than a summary."
        ),
        "tags": ["essays", "feedback", "writing"],
        "upvotes": 14,
        "hours_ago": 19,
        "replies": [
            ("ella", "After every quote, ask: so what, why here, and what does this change in the argument?"),
            ("chloe", "I started writing topic sentences as claims rather than descriptions. It made a big difference."),
            ("james", "A tutor told me to cut any paragraph that could be true for every essay on the topic."),
        ],
    },
    {
        "author": "omar",
        "category": "General Discussion",
        "title": "Quiet study spots near Waterloo after 5pm?",
        "content": (
            "The library is packed most afternoons. Looking for somewhere calm near "
            "Waterloo or South Bank where I can work for a few hours."
        ),
        "tags": ["london", "study-spaces"],
        "upvotes": 9,
        "hours_ago": 24,
        "replies": [
            ("aisha", "The upper floor of the BFI cafe is decent if you have headphones."),
            ("daniel", "Southbank Centre can be good, but avoid Friday evenings."),
        ],
    },
    {
        "author": "emily",
        "category": "Career & Internships",
        "title": "Placement applications: how early did you start?",
        "content": (
            "I am in second year and keep hearing different advice. Are most UK "
            "placement applications already open by autumn, or is spring still okay?"
        ),
        "tags": ["placements", "careers"],
        "upvotes": 31,
        "hours_ago": 31,
        "replies": [
            ("sofia", "Start with a CV now, then apply in batches. I missed some deadlines last year."),
            ("noah", "Some finance and tech placements opened shockingly early. Set alerts."),
            ("priya", "Careers services can review CVs quickly if you book early."),
            ("leo", "For ML roles, GitHub projects helped more than extra certificates."),
        ],
    },
    {
        "author": "leo",
        "category": "Tech & Programming",
        "title": "Machine learning coursework: how much maths is enough?",
        "content": (
            "I can train the model, but I want to understand evaluation properly. "
            "Which maths topics should I revise before writing the report?"
        ),
        "tags": ["machine-learning", "python"],
        "upvotes": 16,
        "hours_ago": 38,
        "replies": [
            ("riya", "Start with confusion matrices, precision, recall, and why accuracy can mislead."),
            ("daniel", "Basic probability helped me understand why my validation split mattered."),
        ],
    },
    {
        "author": "sofia",
        "category": "General Discussion",
        "title": "Group project communication tips?",
        "content": (
            "Our group has five people and messages are already getting messy. "
            "What tools or routines have worked for keeping everyone accountable?"
        ),
        "tags": ["group-work"],
        "upvotes": 7,
        "hours_ago": 42,
        "replies": [],
    },
    {
        "author": "noah",
        "category": "Wellbeing & Balance",
        "title": "How do you switch off after evening lectures?",
        "content": (
            "I get home late twice a week and still feel wired. Looking for a routine "
            "that does not involve scrolling until midnight."
        ),
        "tags": ["routine", "wellbeing"],
        "upvotes": 11,
        "hours_ago": 48,
        "replies": [
            ("emily", "I make tomorrow's list before I leave campus. It stops me replaying everything at home."),
            ("james", "A short walk after the train helps me separate study time from home time."),
        ],
    },
    {
        "author": "priya",
        "category": "Maths & Science",
        "title": "Lab notebook organisation ideas?",
        "content": (
            "My lab notes are technically complete but hard to use when writing reports. "
            "How do you make them searchable and useful later?"
        ),
        "tags": ["labs", "science"],
        "upvotes": 13,
        "hours_ago": 56,
        "replies": [
            ("grace", "Use the same headings every time: aim, setup, observations, errors, follow-up."),
            ("emily", "I add a one-line conclusion at the end of each lab day."),
        ],
    },
    {
        "author": "james",
        "category": "Career & Internships",
        "title": "First presentation at assessment centre",
        "content": (
            "I have a short presentation as part of an assessment centre next week. "
            "Any tips for making it clear without sounding over-rehearsed?"
        ),
        "tags": ["presentations", "interviews"],
        "upvotes": 6,
        "hours_ago": 63,
        "replies": [],
    },
    {
        "author": "aisha",
        "category": "LSBU Discussion",
        "university": "London South Bank University",
        "title": "LSBU library quiet floors during exam week?",
        "content": (
            "Does anyone know which floors usually stay quiet during May exams? "
            "I need somewhere reliable for morning revision."
        ),
        "tags": ["lsbu", "library"],
        "upvotes": 10,
        "hours_ago": 16,
        "replies": [
            ("chloe", "The silent floor fills quickly, but before 10am it is usually fine."),
            ("daniel", "Book one of the smaller study rooms if you need guaranteed space."),
        ],
    },
    {
        "author": "daniel",
        "category": "UOW Students",
        "university": "University of Westminster",
        "title": "UOW students: Cavendish campus study rooms?",
        "content": (
            "Has anyone used the Cavendish study rooms recently? Wondering whether "
            "they are good for pair programming or if they are strict about silence."
        ),
        "tags": ["uow", "campus", "study-rooms"],
        "upvotes": 12,
        "hours_ago": 21,
        "replies": [
            ("yusuf", "Pair programming is usually okay in the bookable rooms, not the open study area."),
            ("farah", "Try to book the smaller rooms early. They go fast near coursework deadlines."),
        ],
    },
    {
        "author": "maya",
        "category": "UCL Students",
        "university": "University College London",
        "title": "UCL reading lists: how much do you actually do?",
        "content": (
            "Some seminar lists are huge. Do people read everything, or prioritise "
            "core texts and skim the rest?"
        ),
        "tags": ["ucl", "reading"],
        "upvotes": 5,
        "hours_ago": 35,
        "replies": [
            ("ella", "Read the core text properly, then use abstracts and introductions to choose the rest."),
        ],
    },
    {
        "author": "omar",
        "category": "KCL Students",
        "university": "Kings College London",
        "title": "KCL internship fair worth attending?",
        "content": (
            "I have lectures either side of it. Is the fair useful for first years "
            "or mostly aimed at finalists?"
        ),
        "tags": ["kcl", "internships"],
        "upvotes": 4,
        "hours_ago": 47,
        "replies": [],
    },
    {
        "author": "emily",
        "category": "QMUL Students",
        "university": "Queen Mary University of London",
        "title": "QMUL commute from Stratford after evening labs",
        "content": (
            "I have a late lab next term and usually commute through Stratford. "
            "Any tips for making the evening journey less stressful?"
        ),
        "tags": ["qmul", "commute"],
        "upvotes": 8,
        "hours_ago": 52,
        "replies": [
            ("priya", "I avoid the first busy train after lectures and use the time to tidy notes."),
            ("noah", "Citymapper alerts help if the Central line is having one of those days."),
            ("grace", "Try leaving with someone from your lab group if it is late."),
        ],
    },
    {
        "author": "leo",
        "category": "Imperial Students",
        "university": "Imperial College London",
        "title": "Imperial maths support sessions for ML modules?",
        "content": (
            "Does anyone know whether the maths support sessions cover optimisation "
            "and probability for machine learning, or are they mostly first-year topics?"
        ),
        "tags": ["imperial", "machine-learning", "maths"],
        "upvotes": 15,
        "hours_ago": 58,
        "replies": [
            ("riya", "They can help with probability foundations. For optimisation, bring a specific question."),
            ("zain", "The engineering maths drop-in is also useful if you frame it as a method question."),
        ],
    },
]


FLAGGED_POST = {
    "author": "yusuf",
    "category": "General Discussion",
    "title": "This group project is impossible with lazy people",
    "content": (
        "I know I am annoyed, but one person keeps calling everyone useless and telling "
        "people to shut up in the group chat. What is the right way to report it?"
    ),
    "tags": ["moderation", "group-work"],
    "upvotes": 0,
}


REVIEW_COMMENTS = [
    (5, "Very clear explanations and a calm pace. I finally understood the topic."),
    (4, "Helpful session with good examples. I would have liked five more minutes on exam timing."),
    (5, "Prepared exactly around my coursework questions and gave practical next steps."),
    (4, "Good tutor and easy to talk to. The follow-up notes were especially useful."),
    (5, "The examples were realistic and made the lecture material feel much easier."),
    (3, "Useful overall, but the session moved a little quickly for me."),
    (4, "Strong subject knowledge and a friendly style. I would book again."),
    (5, "Excellent support. I left with a revision plan I can actually follow."),
    (4, "Clear feedback on my draft and good advice on how to improve the argument."),
    (5, "Patient, practical, and very organised. Exactly what I needed before the deadline."),
    (3, "The topic was covered, but I needed more beginner-level explanation at the start."),
    (4, "Good balance of theory and practice. The worked examples helped a lot."),
]


class Command(BaseCommand):
    help = "Create realistic, repeatable StudySpace demo users, tutors, bookings, forums, and moderation data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm-demo-data",
            action="store_true",
            help="Required confirmation flag so this command cannot run accidentally.",
        )
        parser.add_argument(
            "--reset-demo",
            action="store_true",
            help="Delete old demo users/content first. This only targets known demo accounts.",
        )
        parser.add_argument(
            "--avatar-dir",
            default="fixtures/demo_avatars",
            help=(
                "Optional folder of avatar images. Relative paths are resolved from the Django backend folder. "
                "Expected filenames are listed in docs/DEMO_DATA.md."
            ),
        )
        parser.add_argument(
            "--fake-stripe-ready",
            action="store_true",
            help=(
                "If no real sandbox Connect account exists, mark approved demo tutors as visible using fake "
                "acct_demo IDs. Only use this for UI screenshots, not payment testing."
            ),
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not options["confirm_demo_data"]:
            raise CommandError("Refusing to seed demo data without --confirm-demo-data.")

        avatar_dir = self._resolve_avatar_dir(options["avatar_dir"])
        reusable_stripe_account = self._find_reusable_stripe_account()

        if options["reset_demo"]:
            self._reset_demo_records()

        self._seed_university_domains()
        admin = self._seed_admin()
        students = self._seed_students(avatar_dir)
        tutors = self._seed_tutors(
            avatar_dir=avatar_dir,
            reusable_stripe_account=reusable_stripe_account,
            fake_stripe_ready=options["fake_stripe_ready"],
        )

        self._clear_demo_activity()
        categories = self._seed_categories()
        availability_count = self._seed_availability(tutors)
        booking_count = self._seed_bookings(students, tutors)
        forum_count, reply_count = self._seed_forum(students, tutors, categories, admin)
        message_count = self._seed_messages(students, tutors)
        self._refresh_category_counts()
        self._refresh_tutor_stats(tutors)
        self._seed_verification_notifications(tutors)

        approved = [p for p in tutors.values() if p.verification_status == TutorProfile.VerificationStatus.APPROVED]
        visible = [p for p in approved if p.stripe_ready_for_payments]
        pending = [
            p for p in tutors.values()
            if p.verification_status in (
                TutorProfile.VerificationStatus.PENDING,
                TutorProfile.VerificationStatus.UNDER_REVIEW,
                TutorProfile.VerificationStatus.INFO_REQUESTED,
            )
        ]

        self.stdout.write(self.style.SUCCESS("Realistic demo data ready."))
        self.stdout.write(f"  Students: {len(students)}")
        self.stdout.write(f"  Tutors: {len(tutors)} ({len(visible)} visible in Find a Tutor, {len(pending)} pending/admin review)")
        self.stdout.write(f"  Availability slots: {availability_count}")
        self.stdout.write(f"  Bookings: {booking_count}")
        self.stdout.write(f"  Forum posts/replies: {forum_count}/{reply_count}")
        self.stdout.write(f"  Message threads: {message_count}")
        self.stdout.write("")
        self.stdout.write("Demo login passwords:")
        self.stdout.write(f"  Admin: {DEMO_ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        self.stdout.write(f"  Students: any seeded student / {STUDENT_PASSWORD}")
        self.stdout.write(f"  Tutors: any seeded tutor / {TUTOR_PASSWORD}")

        if not visible:
            self.stdout.write(
                self.style.WARNING(
                    "No demo tutors are Stripe-ready. Connect at least one sandbox tutor account or rerun with "
                    "--fake-stripe-ready for UI-only screenshots."
                )
            )
        elif reusable_stripe_account:
            self.stdout.write(
                self.style.WARNING(
                    "Approved demo tutors reuse the sandbox Stripe Connect account already present in the database. "
                    "That keeps booking/payment tests working without onboarding every demo tutor."
                )
            )

        if not avatar_dir.exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Avatar folder not found: {avatar_dir}. Users were seeded without profile photos."
                )
            )

    def _all_seed_emails(self):
        emails = {DEMO_ADMIN_EMAIL}
        emails.update(item["email"] for item in STUDENTS)
        emails.update(item["email"] for item in TUTORS)
        emails.update(LEGACY_DEMO_EMAILS)
        return emails

    def _demo_user_filter(self):
        return Q(email__in=self._all_seed_emails()) | Q(email__endswith=DEMO_DOMAIN)

    def _resolve_avatar_dir(self, raw_path):
        path = Path(raw_path)
        if path.is_absolute():
            return path
        return Path(settings.BASE_DIR) / path

    def _find_reusable_stripe_account(self):
        profile = (
            TutorProfile.objects
            .filter(
                stripe_charges_enabled=True,
                stripe_payouts_enabled=True,
                stripe_account_id__startswith="acct_",
            )
            .exclude(stripe_account_id__startswith="acct_demo_")
            .order_by("user__email")
            .first()
        )
        return profile.stripe_account_id if profile else ""

    def _reset_demo_records(self):
        demo_users = User.objects.filter(self._demo_user_filter())
        count = demo_users.count()
        demo_users.delete()
        ChatMessage.objects.filter(body__icontains="Demo check: live messaging REST fallback works.").delete()
        ModerationLog.objects.filter(reason__icontains="Demo moderation example").delete()
        self.stdout.write(self.style.WARNING(f"Reset removed {count} demo users and their related demo content."))

    def _clear_demo_activity(self):
        demo_users = User.objects.filter(self._demo_user_filter())
        demo_tutors = TutorProfile.objects.filter(user__in=demo_users)

        Report.objects.filter(
            Q(reporter__in=demo_users)
            | Q(post__author__in=demo_users)
            | Q(reply__author__in=demo_users)
            | Q(reply__post__author__in=demo_users)
        ).delete()
        ModerationLog.objects.filter(reason__icontains="Demo moderation example").delete()
        ForumReply.objects.filter(Q(author__in=demo_users) | Q(post__author__in=demo_users)).delete()
        ForumPost.objects.filter(author__in=demo_users).delete()
        Booking.objects.filter(Q(student__in=demo_users) | Q(tutor__in=demo_tutors)).delete()
        AvailabilitySlot.objects.filter(tutor__in=demo_tutors).delete()
        Notification.objects.filter(user__in=demo_users).delete()
        Conversation.objects.filter(Q(user_one__in=demo_users) | Q(user_two__in=demo_users)).delete()
        ChatMessage.objects.filter(body__icontains="Demo check: live messaging REST fallback works.").delete()

    def _seed_university_domains(self):
        for domain, university_name in UNIVERSITIES:
            UniversityDomain.objects.update_or_create(
                domain=domain,
                defaults={"university_name": university_name, "is_active": True},
            )

    def _seed_admin(self):
        admin, _ = User.objects.update_or_create(
            email=DEMO_ADMIN_EMAIL,
            defaults={
                "username": DEMO_ADMIN_EMAIL,
                "display_name": "DemoAdmin",
                "first_name": "Rania",
                "last_name": "Admin",
                "role": User.Role.ADMIN,
                "is_email_verified": True,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
                "date_of_birth": date(1990, 1, 1),
            },
        )
        admin.set_password(ADMIN_PASSWORD)
        admin.save(update_fields=["password"])
        return admin

    def _seed_students(self, avatar_dir):
        students = {}
        for data in STUDENTS:
            user = self._upsert_user(data, role=User.Role.STUDENT, password=STUDENT_PASSWORD)
            StudentProfile.objects.update_or_create(
                user=user,
                defaults={
                    "university": data["university"],
                    "university_email": data["university_email"],
                    "university_verified": True,
                    "university_verified_at": timezone.now(),
                    "course": data["course"],
                    "year_of_study": data["year"],
                },
            )
            self._attach_avatar(user, avatar_dir, data["avatar"])
            students[data["key"]] = user
        return students

    def _seed_tutors(self, avatar_dir, reusable_stripe_account, fake_stripe_ready):
        tutors = {}
        for data in TUTORS:
            user = self._upsert_user(data, role=User.Role.TUTOR, password=TUTOR_PASSWORD)
            existing = TutorProfile.objects.filter(user=user).first()
            status = data["status"]
            is_approved = status == TutorProfile.VerificationStatus.APPROVED

            stripe_account = existing.stripe_account_id if existing and existing.stripe_account_id else ""
            if is_approved and not stripe_account:
                stripe_account = reusable_stripe_account
            if is_approved and not stripe_account and fake_stripe_ready:
                stripe_account = f"acct_demo_{data['key']}"

            stripe_ready = bool(is_approved and stripe_account)
            info_message = ""
            rejection_reason = ""
            submitted_at = timezone.now() - timedelta(days=2)
            approved_at = timezone.now() - timedelta(days=1) if is_approved else None

            if status == TutorProfile.VerificationStatus.INFO_REQUESTED:
                info_message = "Please upload clearer qualification evidence before approval."
            if status == TutorProfile.VerificationStatus.REJECTED:
                rejection_reason = "Demo rejection: qualification evidence was incomplete."

            profile, _ = TutorProfile.objects.update_or_create(
                user=user,
                defaults={
                    "bio": f"{data['bio']} Sessions offered: {data['mode']}.",
                    "subjects": data["subjects"],
                    "hourly_rate": Decimal(data["rate"]),
                    "experience_years": data["experience"],
                    "company_email": data["company_email"],
                    "company_email_verified": True,
                    "university": data["university"],
                    "university_verified": True,
                    "university_verified_at": timezone.now(),
                    "location_city": data["city"],
                    "location_postcode_area": data["postcode"],
                    "verification_status": status,
                    "personal_statement": data["bio"],
                    "info_request_message": info_message,
                    "rejection_reason": rejection_reason,
                    "verification_submitted_at": submitted_at,
                    "verification_approved_at": approved_at,
                    "stripe_account_id": stripe_account,
                    "stripe_charges_enabled": stripe_ready,
                    "stripe_payouts_enabled": stripe_ready,
                    "stripe_details_submitted": stripe_ready,
                    "total_sessions": data["sessions"],
                },
            )
            self._attach_avatar(user, avatar_dir, data["avatar"])
            tutors[data["key"]] = profile
        return tutors

    def _upsert_user(self, data, role, password):
        user, _ = User.objects.update_or_create(
            email=data["email"],
            defaults={
                "username": data["email"],
                "display_name": data["display_name"],
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "role": role,
                "is_email_verified": True,
                "is_active": True,
                "date_of_birth": data["dob"],
            },
        )
        user.set_password(password)
        user.save(update_fields=["password"])
        return user

    def _attach_avatar(self, user, avatar_dir, filename):
        if not filename:
            return
        image_path = avatar_dir / filename
        if not image_path.exists():
            return
        if user.avatar and user.avatar.name.endswith(filename):
            return
        with image_path.open("rb") as handle:
            user.avatar.save(f"demo_avatars/{filename}", File(handle), save=True)

    def _seed_categories(self):
        categories = {}
        for name, description, icon, order in GLOBAL_CATEGORIES:
            category, _ = ForumCategory.objects.update_or_create(
                name=name,
                university="",
                defaults={
                    "description": description,
                    "icon": icon,
                    "order": order,
                    "is_university_only": False,
                },
            )
            categories[name] = category

        for name, university, description, icon, order in UNIVERSITY_CATEGORIES:
            category, _ = ForumCategory.objects.update_or_create(
                name=name,
                university=university,
                defaults={
                    "description": description,
                    "icon": icon,
                    "order": order,
                    "is_university_only": True,
                },
            )
            categories[name] = category
        return categories

    def _seed_availability(self, tutors):
        now = timezone.localtime()
        today = timezone.localdate()
        count = 0

        patterns = [
            [9, 10, 14, 15],
            [11, 12, 16, 17],
            [8, 9, 18, 19],
            [13, 14, 19, 20],
        ]

        approved = [
            profile for profile in tutors.values()
            if profile.verification_status == TutorProfile.VerificationStatus.APPROVED
        ]

        for index, tutor in enumerate(approved):
            hours = patterns[index % len(patterns)]
            for day_offset in range(0, 21):
                slot_date = today + timedelta(days=day_offset)
                if slot_date.weekday() == 6:
                    continue
                if slot_date == today:
                    hours_for_day = [hour for hour in hours if hour > now.hour + 1]
                    if not hours_for_day:
                        continue
                else:
                    hours_for_day = hours

                if day_offset % 5 == index % 5:
                    continue

                for hour in hours_for_day:
                    _, created = AvailabilitySlot.objects.get_or_create(
                        tutor=tutor,
                        date=slot_date,
                        start_time=time(hour, 0),
                        defaults={"end_time": time(hour + 1, 0), "is_booked": False},
                    )
                    if created:
                        count += 1
        return count

    def _seed_bookings(self, students, tutors):
        today = timezone.localdate()
        student_values = list(students.values())
        approved_tutors = [
            profile for profile in tutors.values()
            if profile.verification_status == TutorProfile.VerificationStatus.APPROVED
        ]
        booking_count = 0

        for tutor_index, tutor in enumerate(approved_tutors):
            for review_index in range(2):
                student = student_values[(tutor_index + review_index) % len(student_values)]
                slot_date = today - timedelta(days=7 + tutor_index + review_index)
                start_hour = 10 + ((tutor_index + review_index) % 5)
                booking = self._create_booking(
                    student=student,
                    tutor=tutor,
                    slot_date=slot_date,
                    start_hour=start_hour,
                    status=Booking.Status.COMPLETED,
                    session_type=Booking.SessionType.VIDEO if review_index == 0 else Booking.SessionType.IN_PERSON,
                    note="Completed demo booking used for realistic tutor history.",
                )
                rating, comment = REVIEW_COMMENTS[(tutor_index * 2 + review_index) % len(REVIEW_COMMENTS)]
                Review.objects.get_or_create(
                    booking=booking,
                    defaults={
                        "student": student,
                        "tutor": tutor,
                        "rating": rating,
                        "comment": comment,
                    },
                )
                self._upsert_payment(booking, PaymentRecord.PaymentStatus.COMPLETED)
                booking_count += 1

        future_plans = [
            ("aisha", "hannah", 1, 15, Booking.Status.CONFIRMED, Booking.SessionType.VIDEO),
            ("daniel", "marcus", 2, 11, Booking.Status.PENDING, Booking.SessionType.VIDEO),
            ("maya", "ella", 3, 14, Booking.Status.CONFIRMED, Booking.SessionType.IN_PERSON),
            ("omar", "zain", 4, 16, Booking.Status.CHANGE_REQUESTED, Booking.SessionType.IN_PERSON),
            ("emily", "grace", 5, 10, Booking.Status.PENDING, Booking.SessionType.VIDEO),
            ("leo", "riya", 6, 18, Booking.Status.CONFIRMED, Booking.SessionType.VIDEO),
            ("sofia", "nina", 7, 17, Booking.Status.PENDING_PAYMENT, Booking.SessionType.VIDEO),
            ("noah", "callum", 8, 12, Booking.Status.CANCELLED, Booking.SessionType.VIDEO),
            ("priya", "farah", 9, 19, Booking.Status.CHANGE_REQUESTED, Booking.SessionType.IN_PERSON),
        ]

        for student_key, tutor_key, days_ahead, start_hour, status, session_type in future_plans:
            booking = self._create_booking(
                student=students[student_key],
                tutor=tutors[tutor_key],
                slot_date=today + timedelta(days=days_ahead),
                start_hour=start_hour,
                status=status,
                session_type=session_type,
                note=self._student_note_for(status),
            )
            if status in (Booking.Status.CONFIRMED, Booking.Status.PENDING, Booking.Status.CHANGE_REQUESTED):
                self._upsert_payment(booking, PaymentRecord.PaymentStatus.COMPLETED)
            elif status == Booking.Status.PENDING_PAYMENT:
                booking.payment_expires_at = timezone.now() + timedelta(minutes=10)
                booking.save(update_fields=["payment_expires_at", "updated_at"])
                self._upsert_payment(booking, PaymentRecord.PaymentStatus.PENDING)
            elif status == Booking.Status.CANCELLED:
                booking.cancelled_at = timezone.now() - timedelta(hours=8)
                booking.cancelled_by = booking.student
                booking.refund_percent = 100
                booking.save(update_fields=["cancelled_at", "cancelled_by", "refund_percent", "updated_at"])
                self._upsert_payment(booking, PaymentRecord.PaymentStatus.REFUNDED, refunded=True)

            if status == Booking.Status.CHANGE_REQUESTED:
                BookingChangeRequest.objects.get_or_create(
                    booking=booking,
                    status=BookingChangeRequest.Status.PENDING,
                    defaults={
                        "requested_by": BookingChangeRequest.RequestedBy.TUTOR,
                        "requested_by_user": booking.tutor.user,
                        "proposed_date": booking.slot.date + timedelta(days=2),
                        "proposed_start_time": booking.slot.start_time,
                        "proposed_end_time": booking.slot.end_time,
                        "proposed_session_type": booking.session_type,
                        "message": "Could we move this by two days? I can offer the same time slot.",
                    },
                )
            booking_count += 1

        return booking_count

    def _create_booking(self, student, tutor, slot_date, start_hour, status, session_type, note):
        slot, _ = AvailabilitySlot.objects.get_or_create(
            tutor=tutor,
            date=slot_date,
            start_time=time(start_hour, 0),
            defaults={"end_time": time(start_hour + 1, 0), "is_booked": status != Booking.Status.CANCELLED},
        )
        slot.is_booked = status != Booking.Status.CANCELLED
        slot.save(update_fields=["is_booked"])

        video_platform = ""
        location_suggestion = ""
        session_link = ""
        if session_type == Booking.SessionType.VIDEO:
            video_platform = Booking.VideoPlatform.GOOGLE_MEET
            session_link = "https://meet.google.com/studyspace-demo"
        elif session_type == Booking.SessionType.IN_PERSON:
            location_suggestion = f"Near {tutor.location_city} campus library"

        booking, _ = Booking.objects.update_or_create(
            student=student,
            tutor=tutor,
            slot=slot,
            defaults={
                "subject": tutor.subjects[0] if tutor.subjects else "General study support",
                "status": status,
                "session_type": session_type,
                "video_platform": video_platform,
                "location_suggestion": location_suggestion,
                "student_note": note,
                "tutor_note": "",
                "session_link": session_link,
                "price": tutor.hourly_rate,
            },
        )
        return booking

    def _student_note_for(self, status):
        notes = {
            Booking.Status.CONFIRMED: "Confirmed demo session with all details ready.",
            Booking.Status.PENDING: "Could we focus on past paper style questions?",
            Booking.Status.CHANGE_REQUESTED: "Happy to be flexible if another slot works better.",
            Booking.Status.PENDING_PAYMENT: "Payment hold demo booking. The slot is temporarily reserved.",
            Booking.Status.CANCELLED: "Cancelled demo booking used to test refund labels.",
        }
        return notes.get(status, "Demo booking.")

    def _upsert_payment(self, booking, status, refunded=False):
        amount = booking.price
        platform_fee = (amount * Decimal("0.10")).quantize(Decimal("0.01"))
        payout = amount - platform_fee
        PaymentRecord.objects.update_or_create(
            booking=booking,
            defaults={
                "amount": amount,
                "currency": "GBP",
                "payment_method": "stripe",
                "transaction_id": f"demo_txn_{str(booking.id)[:8]}",
                "stripe_checkout_session_id": f"cs_demo_{str(booking.id).replace('-', '')[:18]}",
                "stripe_checkout_url": "",
                "stripe_payment_intent_id": f"pi_demo_{str(booking.id).replace('-', '')[:18]}",
                "stripe_account_id": booking.tutor.stripe_account_id,
                "platform_fee_amount": platform_fee,
                "tutor_payout_amount": payout,
                "status": status,
                "refunded_amount": amount if refunded else Decimal("0.00"),
                "paid_at": timezone.now() - timedelta(days=1) if status == PaymentRecord.PaymentStatus.COMPLETED else None,
            },
        )

    def _seed_forum(self, students, tutors, categories, admin):
        created_posts = 0
        created_replies = 0
        now = timezone.now()
        authors = {**students, **{key: profile.user for key, profile in tutors.items()}}

        for post_data in POST_DATA:
            category = categories[post_data["category"]]
            post = ForumPost.objects.create(
                author=authors[post_data["author"]],
                category=category,
                title=post_data["title"],
                content=post_data["content"],
                university=post_data.get("university", category.university or ""),
                is_anonymous=False,
                is_pinned=post_data.get("pinned", False),
                upvotes=post_data["upvotes"],
                downvotes=0,
                tags=post_data["tags"],
                is_flagged=False,
            )
            self._set_created_at(post, now - timedelta(hours=post_data["hours_ago"]))
            created_posts += 1

            reply_total = 0
            for reply in post_data["replies"]:
                reply_total += self._create_reply_tree(post, authors, reply, now)
            post.reply_count = reply_total
            post.save(update_fields=["reply_count"])
            created_replies += reply_total

        flagged = ForumPost.objects.create(
            author=authors[FLAGGED_POST["author"]],
            category=categories[FLAGGED_POST["category"]],
            title=FLAGGED_POST["title"],
            content=FLAGGED_POST["content"],
            university="",
            is_anonymous=False,
            is_flagged=True,
            flag_reason="Demo moderation example: disrespectful group chat language.",
            upvotes=FLAGGED_POST["upvotes"],
            tags=FLAGGED_POST["tags"],
        )
        self._set_created_at(flagged, now - timedelta(hours=2))
        created_posts += 1

        reporters = [students["aisha"], students["chloe"], students["maya"]]
        for reporter in reporters:
            Report.objects.create(
                reporter=reporter,
                post=flagged,
                reason=Report.Reason.HARASSMENT,
                details="Demo report: disrespectful wording and group chat concern.",
            )
        ModerationLog.objects.create(
            admin=admin,
            target_type="post",
            target_id=flagged.id,
            action="flagged",
            reason="Demo moderation example: post was flagged after multiple reports.",
        )

        flagged_reply_parent = ForumPost.objects.filter(title="Group project communication tips?").first()
        if flagged_reply_parent:
            flagged_reply = ForumReply.objects.create(
                post=flagged_reply_parent,
                author=students["yusuf"],
                content="Just tell the useless people to stop wasting everyone's time.",
                is_flagged=True,
                flag_reason="Demo moderation example: disrespectful reply.",
            )
            Report.objects.create(
                reporter=students["sofia"],
                reply=flagged_reply,
                reason=Report.Reason.HARASSMENT,
                details="Demo report on a disrespectful reply.",
            )
            ModerationLog.objects.create(
                admin=admin,
                target_type="reply",
                target_id=flagged_reply.id,
                action="flagged",
                reason="Demo moderation example: reply hidden from normal forum view.",
            )

        return created_posts, created_replies

    def _create_reply_tree(self, post, authors, reply_data, now, parent=None, depth=0):
        if len(reply_data) == 2:
            author_key, content = reply_data
            children = []
        else:
            author_key, content, children = reply_data

        reply = ForumReply.objects.create(
            post=post,
            author=authors[author_key],
            parent=parent,
            content=content,
            upvotes=max(0, 7 - depth),
        )
        self._set_created_at(reply, now - timedelta(hours=max(1, depth + len(content) % 23)))

        count = 1
        for child in children:
            count += self._create_reply_tree(post, authors, child, now, parent=reply, depth=depth + 1)
        return count

    def _set_created_at(self, obj, value):
        obj.__class__.objects.filter(pk=obj.pk).update(created_at=value)

    def _seed_messages(self, students, tutors):
        pairs = [
            ("aisha", "hannah", [
                ("aisha", "Hi Hannah, thanks for accepting the booking. Could we focus on confidence intervals?"),
                ("hannah", "Absolutely. Bring one question you found difficult and we can build from there."),
            ]),
            ("daniel", "marcus", [
                ("daniel", "I am stuck on binary search trees. Do you mind if we start there?"),
                ("marcus", "Good place to start. I will prepare a few tracing examples."),
                ("daniel", "Thanks, that would help a lot."),
            ]),
            ("maya", "ella", [
                ("maya", "I uploaded my essay plan in the booking notes."),
                ("ella", "I saw it. The argument is promising, we mainly need to sharpen the paragraph order."),
            ]),
            ("leo", "riya", [
                ("leo", "For the ML session, can we spend time on evaluation metrics?"),
                ("riya", "Yes. We can compare accuracy, precision, recall, and F1 using one example dataset."),
            ]),
        ]

        for student_key, tutor_key, messages in pairs:
            student = students[student_key]
            tutor_user = tutors[tutor_key].user
            conversation, _ = Conversation.get_or_create_direct(student, tutor_user)
            conversation.is_system = False
            conversation.allow_replies = True
            conversation.save(update_fields=["is_system", "allow_replies", "updated_at"])

            last_message = None
            for author_key, body in messages:
                sender = student if author_key == student_key else tutor_user
                last_message = ChatMessage.objects.create(
                    conversation=conversation,
                    sender=sender,
                    body=body,
                )
            if last_message:
                conversation.last_message_at = last_message.created_at
                conversation.save(update_fields=["last_message_at", "updated_at"])
            ConversationParticipant.objects.get_or_create(conversation=conversation, user=student)
            ConversationParticipant.objects.get_or_create(conversation=conversation, user=tutor_user)
        return len(pairs)

    def _seed_verification_notifications(self, tutors):
        for profile in tutors.values():
            if profile.verification_status == TutorProfile.VerificationStatus.APPROVED:
                continue

            title = "Tutor verification update"
            message = "Your tutor application is waiting for an admin decision."
            notif_type = Notification.NotifType.VERIFICATION_UPDATE
            if profile.verification_status == TutorProfile.VerificationStatus.INFO_REQUESTED:
                title = "More information needed"
                message = profile.info_request_message or "Please upload clearer evidence."
                notif_type = Notification.NotifType.VERIFICATION_INFO_REQUESTED
            elif profile.verification_status == TutorProfile.VerificationStatus.REJECTED:
                title = "Tutor application rejected"
                message = profile.rejection_reason or "Your tutor application was not approved."
                notif_type = Notification.NotifType.VERIFICATION_REJECTED

            Notification.objects.get_or_create(
                user=profile.user,
                notification_type=notif_type,
                title=title,
                defaults={"message": message, "link": "/dashboard"},
            )

    def _refresh_tutor_stats(self, tutors):
        for profile in tutors.values():
            stats = Review.objects.filter(tutor=profile).aggregate(
                avg=Avg("rating"),
                count=Count("id"),
            )
            review_count = stats["count"] or 0
            if review_count:
                profile.average_rating = round(float(stats["avg"] or 0), 1)
                profile.total_reviews = review_count
            profile.total_sessions = max(
                profile.total_sessions,
                Booking.objects.filter(tutor=profile, status=Booking.Status.COMPLETED).count(),
            )
            profile.save(update_fields=["average_rating", "total_reviews", "total_sessions"])

    def _refresh_category_counts(self):
        for category in ForumCategory.objects.all():
            category.post_count = ForumPost.objects.filter(
                category=category,
                is_flagged=False,
                is_deleted=False,
            ).count()
            category.save(update_fields=["post_count"])
