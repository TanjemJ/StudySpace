import json
from datetime import time, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Notification, TutorProfile, User
from .models import AvailabilitySlot, Booking, PaymentRecord


class BookingAndStripeApiTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            email='booking.student@example.com',
            username='booking.student@example.com',
            display_name='BookingStudent',
            password='Student123!',
            role=User.Role.STUDENT,
            is_email_verified=True,
        )
        self.tutor_user = User.objects.create_user(
            email='booking.tutor@example.com',
            username='booking.tutor@example.com',
            display_name='BookingTutor',
            password='Tutor123!',
            role=User.Role.TUTOR,
            is_email_verified=True,
        )
        self.tutor = TutorProfile.objects.create(
            user=self.tutor_user,
            company_email='booking.tutor@example.com',
            subjects=['Computer Science'],
            hourly_rate=Decimal('18.75'),
            experience_years=4,
            verification_status=TutorProfile.VerificationStatus.APPROVED,
            stripe_account_id='acct_test_ready',
            stripe_charges_enabled=True,
            stripe_payouts_enabled=True,
        )
        self.slot = AvailabilitySlot.objects.create(
            tutor=self.tutor,
            date=timezone.localdate() + timedelta(days=7),
            start_time=time(10, 0),
            end_time=time(11, 0),
        )

    @override_settings(STRIPE_SECRET_KEY='sk_test_dummy')
    @patch('tutoring.views.create_booking_checkout_session')
    def test_booking_create_returns_pending_payment_and_checkout_url(self, checkout_mock):
        checkout_mock.return_value = SimpleNamespace(url='https://checkout.stripe.test/session')
        self.client.force_authenticate(self.student)

        response = self.client.post(
            reverse('booking-create'),
            {
                'slot_id': str(self.slot.id),
                'subject': 'Computer Science',
                'session_type': 'video',
                'video_platform': Booking.VideoPlatform.ZOOM,
                'student_note': 'Please focus on API testing.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], Booking.Status.PENDING_PAYMENT)
        self.assertEqual(response.data['checkout_url'], 'https://checkout.stripe.test/session')

        self.slot.refresh_from_db()
        self.assertTrue(self.slot.is_booked)

        booking = Booking.objects.get(id=response.data['id'])
        self.assertEqual(booking.student, self.student)
        self.assertEqual(booking.tutor, self.tutor)
        self.assertEqual(booking.payment.status, PaymentRecord.PaymentStatus.PENDING)

    @override_settings(STRIPE_SECRET_KEY='sk_test_dummy')
    @patch('tutoring.views.create_booking_checkout_session')
    def test_booking_create_rejects_already_booked_slot(self, checkout_mock):
        self.slot.is_booked = True
        self.slot.save(update_fields=['is_booked'])
        self.client.force_authenticate(self.student)

        response = self.client.post(
            reverse('booking-create'),
            {
                'slot_id': str(self.slot.id),
                'subject': 'Computer Science',
                'session_type': 'video',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 409)
        checkout_mock.assert_not_called()

    @override_settings(STRIPE_WEBHOOK_SECRET='')
    def test_stripe_webhook_completed_payment_updates_booking_and_payment(self):
        booking = Booking.objects.create(
            student=self.student,
            tutor=self.tutor,
            slot=self.slot,
            subject='Computer Science',
            status=Booking.Status.PENDING_PAYMENT,
            session_type=Booking.SessionType.VIDEO,
            price=self.tutor.hourly_rate,
            payment_expires_at=timezone.now() + timedelta(minutes=20),
        )
        self.slot.is_booked = True
        self.slot.save(update_fields=['is_booked'])
        PaymentRecord.objects.create(
            booking=booking,
            amount=booking.price,
            status=PaymentRecord.PaymentStatus.PENDING,
            stripe_checkout_session_id='cs_test_123',
        )
        payload = {
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'id': 'cs_test_123',
                    'payment_intent': 'pi_test_123',
                    'metadata': {'booking_id': str(booking.id)},
                }
            },
        }

        response = self.client.post(
            reverse('stripe-webhook'),
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        booking.payment.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.PENDING)
        self.assertEqual(booking.payment.status, PaymentRecord.PaymentStatus.COMPLETED)
        self.assertEqual(booking.payment.stripe_payment_intent_id, 'pi_test_123')
        self.assertTrue(
            Notification.objects.filter(
                user=self.tutor_user,
                notification_type=Notification.NotifType.BOOKING_REQUEST,
            ).exists()
        )
