from .models import PendingRegistration, User


class PendingRegistrationError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def reset_pending_registration_details(pending):
    pending.email_verified_at = None
    pending.first_name = ''
    pending.last_name = ''
    pending.display_name = ''
    pending.date_of_birth = None

    pending.university = ''
    pending.university_email = ''
    pending.course = ''
    pending.year_of_study = None

    pending.company_email = ''
    pending.subjects = []
    pending.hourly_rate = None
    pending.experience_years = None
    pending.personal_statement = ''
    pending.location_city = ''
    pending.location_postcode_area = ''


def get_verified_pending_registration(registration_id):
    if not registration_id:
        raise PendingRegistrationError('Registration session missing. Please start again.')

    try:
        pending = PendingRegistration.objects.get(id=registration_id)
    except (PendingRegistration.DoesNotExist, ValueError, TypeError):
        raise PendingRegistrationError('Registration session not found. Please start again.', 404)

    if pending.is_expired:
        pending.delete()
        raise PendingRegistrationError('Registration session expired. Please start again.')

    if not pending.is_email_verified:
        raise PendingRegistrationError('Please verify your email before continuing.')

    return pending


def pending_has_personal_details(pending):
    return bool(
        pending.first_name and
        pending.last_name and
        pending.display_name and
        pending.date_of_birth
    )


def display_name_is_reserved_for_pending(display_name, pending):
    display_name = (display_name or '').strip()

    if User.objects.filter(display_name__iexact=display_name).exists():
        return True

    other_pending = PendingRegistration.objects.filter(
        display_name__iexact=display_name,
    ).exclude(id=pending.id)

    for other in other_pending:
        if other.is_expired:
            other.delete()
            continue
        return True

    return False


def create_user_from_pending(pending):
    user = User(
        email=pending.email,
        username=pending.email,
        role=pending.role,
        first_name=pending.first_name,
        last_name=pending.last_name,
        display_name=pending.display_name,
        date_of_birth=pending.date_of_birth,
        is_active=True,
        is_email_verified=True,
    )
    user.password = pending.hashed_password
    user.save()
    return user
