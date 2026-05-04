from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Notification, TutorProfile, User


class AdminVerificationActionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='admin@example.com',
            username='admin@example.com',
            display_name='AdminUser',
            password='Admin123!',
            role=User.Role.ADMIN,
            is_email_verified=True,
        )
        self.tutor = User.objects.create_user(
            email='tutor@example.com',
            username='tutor@example.com',
            display_name='TutorUser',
            password='Tutor123!',
            role=User.Role.TUTOR,
            is_email_verified=True,
        )
        self.profile = TutorProfile.objects.create(
            user=self.tutor,
            company_email='tutor@example.com',
            subjects=['Computer Science'],
            hourly_rate=20,
            experience_years=2,
        )
        self.client.force_authenticate(self.admin)

    def action_url(self, action):
        return reverse(
            'admin-verification-action',
            kwargs={'tutor_id': self.tutor.id, 'action': action},
        )

    def test_admin_can_approve_tutor(self):
        response = self.client.post(self.action_url('approve'), {})

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.verification_status, TutorProfile.VerificationStatus.APPROVED)
        self.assertIsNotNone(self.profile.verification_approved_at)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tutor,
                notification_type=Notification.NotifType.VERIFICATION_APPROVED,
            ).exists()
        )

    def test_admin_can_request_more_info(self):
        response = self.client.post(
            self.action_url('request_info'),
            {'message': 'Please upload a clearer qualification document.'},
        )

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.verification_status, TutorProfile.VerificationStatus.INFO_REQUESTED)
        self.assertEqual(self.profile.info_request_message, 'Please upload a clearer qualification document.')
        self.assertTrue(
            Notification.objects.filter(
                user=self.tutor,
                notification_type=Notification.NotifType.VERIFICATION_INFO_REQUESTED,
            ).exists()
        )

    def test_admin_can_reject_tutor(self):
        response = self.client.post(
            self.action_url('reject'),
            {'reason': 'The submitted document is not valid.'},
        )

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.verification_status, TutorProfile.VerificationStatus.REJECTED)
        self.assertEqual(self.profile.rejection_reason, 'The submitted document is not valid.')
        self.assertTrue(
            Notification.objects.filter(
                user=self.tutor,
                notification_type=Notification.NotifType.VERIFICATION_REJECTED,
            ).exists()
        )
