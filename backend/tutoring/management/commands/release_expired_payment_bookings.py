from django.core.management.base import BaseCommand

from tutoring.views import release_expired_payment_bookings


class Command(BaseCommand):
    help = 'Release unpaid pending-payment bookings whose checkout window has expired.'

    def handle(self, *args, **options):
        released = release_expired_payment_bookings()
        self.stdout.write(self.style.SUCCESS(f'Released {released} expired payment booking(s).'))
