import dns.exception
import dns.resolver

from .models import StudentProfile, TutorProfile, UniversityDomain


def normalize_email(email: str) -> str:
    return (email or '').strip().lower()


def extract_domain(email: str) -> str:
    email = normalize_email(email)
    return email.split('@', 1)[1] if '@' in email else ''


def get_university_domain_record(domain: str):
    domain = (domain or '').strip().lower()
    return UniversityDomain.objects.filter(domain=domain, is_active=True).first()

def university_email_is_verified_elsewhere(email: str, current_user) -> bool:
    email = normalize_email(email)
    if not email:
        return False

    student_exists = StudentProfile.objects.filter(
        university_email__iexact=email,
        university_verified=True,
    ).exclude(user=current_user).exists()

    tutor_exists = TutorProfile.objects.filter(
        company_email__iexact=email,
        university_verified=True,
    ).exclude(user=current_user).exists()

    return student_exists or tutor_exists


def domain_has_mail_records(domain: str) -> bool:
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        return len(list(answers)) > 0
    except (
        dns.resolver.NoAnswer,
        dns.resolver.NXDOMAIN,
        dns.resolver.NoNameservers,
        dns.exception.Timeout,
    ):
        return False


def validate_university_email(email: str) -> dict:
    email = normalize_email(email)
    domain = extract_domain(email)

    if not email or not domain:
        return {
            'ok': False,
            'error': 'Please enter a valid university email address.',
        }

    domain_record = get_university_domain_record(domain)
    if not domain_record:
        return {
            'ok': False,
            'error': 'That university email domain is not recognised by StudySpace.',
        }

    if not domain_has_mail_records(domain):
        return {
            'ok': False,
            'error': 'That university email domain could not be verified right now. Please try again later.',
        }

    return {
        'ok': True,
        'email': email,
        'domain': domain,
        'university_name': domain_record.university_name,
    }
