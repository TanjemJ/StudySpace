from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from accounts.models import Notification, TutorProfile


class Command(BaseCommand):
    help = 'Notify approved tutors who have not completed Stripe setup after 24 hours.'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=24)
        profiles = (
            TutorProfile.objects
            .select_related('user')
            .filter(
                verification_status=TutorProfile.VerificationStatus.APPROVED,
                verification_approved_at__lte=cutoff,
                stripe_setup_reminder_sent_at__isnull=True,
            )
            .filter(
                Q(stripe_account_id='') |
                Q(stripe_charges_enabled=False) |
                Q(stripe_payouts_enabled=False)
            )
        )

        sent = 0
        now = timezone.now()
        for profile in profiles:
            Notification.objects.create(
                user=profile.user,
                notification_type=Notification.NotifType.SYSTEM,
                title='Finish setting up payments',
                message=(
                    'Your tutor profile is approved. Complete Stripe setup from your '
                    'dashboard so students can find and book you.'
                ),
                link='/tutor-dashboard',
            )
            profile.stripe_setup_reminder_sent_at = now
            profile.save(update_fields=['stripe_setup_reminder_sent_at'])
            sent += 1

        self.stdout.write(self.style.SUCCESS(f'Sent {sent} Stripe setup reminder(s).'))
