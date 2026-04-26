from django.core.management.base import BaseCommand
from django.db.models import Count
from django.utils import timezone

from messaging.models import Conversation


class Command(BaseCommand):
    help = 'Delete empty direct conversations older than the chosen age.'

    def add_arguments(self, parser):
        parser.add_argument('--hours', type=int, default=24)
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        hours = options['hours']
        cutoff = timezone.now() - timezone.timedelta(hours=hours)

        queryset = Conversation.objects.annotate(
            message_count=Count('messages')
        ).filter(
            message_count=0,
            created_at__lt=cutoff,
        )

        count = queryset.count()

        if options['dry_run']:
            self.stdout.write(f'{count} empty conversations would be deleted.')
            return

        queryset.delete()
        self.stdout.write(
            self.style.SUCCESS(f'Deleted {count} empty conversations older than {hours} hours.')
        )
