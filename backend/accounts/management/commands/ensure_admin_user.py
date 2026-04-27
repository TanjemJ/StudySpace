import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


MAX_DISPLAY_NAME_LENGTH = 30


def _env(name, default=''):
    return os.environ.get(name, default).strip()


def _unique_display_name(User, base):
    base = (base or 'StudySpaceAdmin').strip()[:MAX_DISPLAY_NAME_LENGTH]
    candidate = base
    counter = 2

    while User.objects.filter(display_name=candidate).exists():
        suffix = str(counter)
        candidate = f'{base[:MAX_DISPLAY_NAME_LENGTH - len(suffix)]}{suffix}'
        counter += 1

    return candidate


class Command(BaseCommand):
    help = 'Create or update the production StudySpace admin user.'

    def add_arguments(self, parser):
        parser.add_argument('--email', default=None)
        parser.add_argument('--password', default=None)
        parser.add_argument('--display-name', default=None)
        parser.add_argument(
            '--update-password',
            action='store_true',
            help='Update the password for an existing admin user.',
        )

    def handle(self, *args, **options):
        User = get_user_model()

        email = (
            options['email']
            or _env('STUDYSPACE_ADMIN_EMAIL', 'admin@studyspace.com')
        ).lower()

        password = options['password'] or _env('STUDYSPACE_ADMIN_PASSWORD')
        display_name = options['display_name'] or _env(
            'STUDYSPACE_ADMIN_DISPLAY_NAME',
            'StudySpaceAdmin',
        )

        if not email:
            raise CommandError('Admin email is required.')

        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()

            if user:
                update_fields = []

                required_values = {
                    'username': user.username or email,
                    'role': User.Role.ADMIN,
                    'is_staff': True,
                    'is_superuser': True,
                    'is_active': True,
                    'is_email_verified': True,
                    'is_deleted': False,
                }

                for field, value in required_values.items():
                    if getattr(user, field) != value:
                        setattr(user, field, value)
                        update_fields.append(field)

                if options['update_password']:
                    if not password:
                        raise CommandError(
                            'STUDYSPACE_ADMIN_PASSWORD or --password is required with --update-password.'
                        )
                    user.set_password(password)
                    update_fields.append('password')
                elif password and not user.has_usable_password():
                    user.set_password(password)
                    update_fields.append('password')

                if update_fields:
                    user.save(update_fields=sorted(set(update_fields)))
                    self.stdout.write(self.style.SUCCESS(f'Admin user updated: {email}'))
                else:
                    self.stdout.write(self.style.SUCCESS(f'Admin user already ready: {email}'))

                return

            if not password:
                raise CommandError(
                    'STUDYSPACE_ADMIN_PASSWORD or --password is required when creating the admin user.'
                )

            user = User.objects.create_superuser(
                email=email,
                username=email,
                password=password,
                display_name=_unique_display_name(User, display_name),
                first_name='StudySpace',
                last_name='Admin',
                role=User.Role.ADMIN,
                is_email_verified=True,
            )

            self.stdout.write(self.style.SUCCESS(f'Admin user created: {user.email}'))
