import csv
from pathlib import Path

from django.core.management.base import BaseCommand

from accounts.models import UniversityDomain


class Command(BaseCommand):
    help = 'Import university domains from CSV into the UniversityDomain table.'

    def handle(self, *args, **options):
        csv_path = (
            Path(__file__)
            .resolve()
            .parents[2]
            / 'data'
            / 'university_domains_england.csv'
        )

        if not csv_path.exists():
            self.stdout.write(
                self.style.ERROR(f'CSV file not found: {csv_path}')
            )
            return

        created = 0
        updated = 0

        with csv_path.open(mode='r', encoding='utf-8-sig', newline='') as csv_file:
            reader = csv.DictReader(csv_file)

            for row in reader:
                domain = (row.get('domain') or '').strip().lower()
                university_name = (row.get('university_name') or '').strip()
                is_active_raw = (row.get('is_active') or 'True').strip().lower()
                is_active = is_active_raw in ('true', '1', 'yes')

                if not domain or not university_name:
                    continue

                _, was_created = UniversityDomain.objects.update_or_create(
                    domain=domain,
                    defaults={
                        'university_name': university_name,
                        'is_active': is_active,
                    },
                )

                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'University domains synced. Created: {created}, Updated: {updated}'
            )
        )
