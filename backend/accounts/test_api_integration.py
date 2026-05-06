from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .models import PendingRegistration, TutorProfile, User


class AuthenticationAndValidationApiTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            email='student.api@example.com',
            username='student.api@example.com',
            display_name='StudentApi',
            password='Student123!',
            role=User.Role.STUDENT,
            is_email_verified=True,
        )

    def test_valid_login_returns_role_and_jwt_tokens(self):
        response = self.client.post(
            reverse('login'),
            {'email': 'student.api@example.com', 'password': 'Student123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['role'], User.Role.STUDENT)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])

    def test_protected_me_endpoint_rejects_missing_token(self):
        response = self.client.get(reverse('me'))

        self.assertIn(response.status_code, [401, 403])

    def test_student_cannot_access_admin_verification_queue(self):
        self.client.force_authenticate(self.student)

        response = self.client.get(reverse('admin-verification-queue'))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], 'Admin only.')

    def test_registration_rejects_weak_password(self):
        response = self.client.post(
            reverse('register-step1'),
            {
                'email': 'weak.password@example.com',
                'password': 'password123!',
                'confirm_password': 'password123!',
                'role': User.Role.STUDENT,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data)
        self.assertFalse(PendingRegistration.objects.filter(email='weak.password@example.com').exists())

    def test_registration_rejects_under_18_date_of_birth(self):
        pending = PendingRegistration.objects.create(
            email='young.student@example.com',
            hashed_password=make_password('Student123!'),
            role=User.Role.STUDENT,
            code='123456',
            email_verified_at=timezone.now(),
        )
        under_18_birth_date = timezone.localdate().replace(year=timezone.localdate().year - 17)

        response = self.client.post(
            reverse('register-step2'),
            {
                'registration_id': str(pending.id),
                'first_name': 'Young',
                'last_name': 'Student',
                'display_name': 'YoungStudentApi',
                'date_of_birth': under_18_birth_date.isoformat(),
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('date_of_birth', response.data)


class TutorSearchApiTests(TestCase):

    def setUp(self):
        self.client = APIClient()

    def _create_tutor_profile(self, display_name, *, approved=True, stripe_ready=True, hourly_rate=20):
        user = User.objects.create_user(
            email=f'{display_name.lower()}@example.com',
            username=f'{display_name.lower()}@example.com',
            display_name=display_name,
            password='Tutor123!',
            role=User.Role.TUTOR,
            is_email_verified=True,
        )
        return TutorProfile.objects.create(
            user=user,
            company_email=user.email,
            subjects=['Computer Science', 'Python'],
            hourly_rate=hourly_rate,
            experience_years=3,
            verification_status=(
                TutorProfile.VerificationStatus.APPROVED
                if approved else TutorProfile.VerificationStatus.PENDING
            ),
            stripe_account_id='acct_ready' if stripe_ready else '',
            stripe_charges_enabled=stripe_ready,
            stripe_payouts_enabled=stripe_ready,
            location_city='South Bank',
            average_rating=4.8,
        )

    def test_tutor_search_returns_only_approved_payment_ready_tutors(self):
        visible = self._create_tutor_profile('VisibleTutor', approved=True, stripe_ready=True, hourly_rate=18)
        self._create_tutor_profile('PendingTutor', approved=False, stripe_ready=True, hourly_rate=19)
        self._create_tutor_profile('NoStripeTutor', approved=True, stripe_ready=False, hourly_rate=20)

        response = self.client.get(reverse('tutor-search'), {'subject': 'Computer Science'})

        self.assertEqual(response.status_code, 200)
        returned_ids = {item['user']['id'] for item in response.data['results']}
        self.assertEqual(returned_ids, {str(visible.user_id)})

