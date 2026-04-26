import uuid
import random
import string
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Custom user model supporting Student, Tutor, Admin, and Parent roles."""

    class Role(models.TextChoices):
        STUDENT = 'student', 'Student'
        TUTOR = 'tutor', 'Tutor'
        ADMIN = 'admin', 'Admin'
        PARENT = 'parent', 'Parent/Guardian'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    display_name = models.CharField(max_length=30, unique=True, help_text="Public username visible to all users")
    date_of_birth = models.DateField(null=True, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_email_verified = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False, help_text="Soft-deleted account. Posts remain but profile is hidden.")
    deletion_reason = models.TextField(blank=True)
    last_display_name_change = models.DateTimeField(null=True, blank=True, help_text="Last time the display name was changed. 90-day cooldown.")

    # Accessibility preferences (available to ALL roles)
    text_size = models.CharField(max_length=20, default='medium',
                                  choices=[('small', 'Small'), ('medium', 'Medium'),
                                           ('large', 'Large'), ('xl', 'Extra Large')])
    high_contrast = models.BooleanField(default=False)
    reduced_motion = models.BooleanField(default=False)
    underline_links = models.BooleanField(default=False,
                                          help_text="Always underline links for easier scanning.")
    dyslexia_font = models.BooleanField(default=False,
                                         help_text="Use a dyslexia-friendly font across the site.")
    focus_ring_boost = models.BooleanField(default=False,
                                            help_text="Stronger focus outlines on keyboard tab navigation.")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'display_name']

    def __str__(self):
        return f"{self.display_name} ({self.role})"

    @property
    def can_change_display_name(self):
        if not self.last_display_name_change:
            return True
        return timezone.now() > self.last_display_name_change + timezone.timedelta(days=90)

    @property
    def display_name_change_available_at(self):
        if not self.last_display_name_change:
            return None
        return self.last_display_name_change + timezone.timedelta(days=90)


class PendingRegistration(models.Model):
    """
    Holds an in-flight signup until the full registration flow is complete.
    A real User is created only after the final student/tutor step succeeds.
    """
    TTL_MINUTES = 60

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    hashed_password = models.CharField(max_length=256)
    role = models.CharField(max_length=10, choices=User.Role.choices, default=User.Role.STUDENT)
    code = models.CharField(max_length=6)
    attempts = models.PositiveSmallIntegerField(
        default=0,
        help_text="Number of failed verification attempts.",
    )
    email_verified_at = models.DateTimeField(null=True, blank=True)

    first_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50, blank=True)
    display_name = models.CharField(max_length=30, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)

    university = models.CharField(max_length=200, blank=True)
    university_email = models.EmailField(blank=True, default='')
    course = models.CharField(max_length=200, blank=True)
    year_of_study = models.PositiveSmallIntegerField(null=True, blank=True)

    company_email = models.EmailField(blank=True, default='')
    subjects = models.JSONField(default=list, blank=True)
    hourly_rate = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    experience_years = models.PositiveSmallIntegerField(null=True, blank=True)
    personal_statement = models.TextField(blank=True)
    location_city = models.CharField(max_length=100, blank=True)
    location_postcode_area = models.CharField(max_length=10, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['email'], name='accounts_pe_email_idx'),
            models.Index(fields=['created_at'], name='accounts_pe_created_idx'),
        ]

    def __str__(self):
        return f"PendingRegistration<{self.email}>"

    @property
    def is_expired(self):
        return timezone.now() > self.created_at + timezone.timedelta(minutes=self.TTL_MINUTES)

    @property
    def is_email_verified(self):
        return self.email_verified_at is not None

    @staticmethod
    def generate_code():
        return ''.join(random.choices(string.digits, k=6))


class EmailVerificationCode(models.Model):
    """Stores 6-digit codes sent to users during registration and verification flows."""

    class Purpose(models.TextChoices):
        ACCOUNT_EMAIL = 'account_email', 'Account Email'
        UNIVERSITY_EMAIL = 'university_email', 'University Email'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_codes')
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=30, choices=Purpose.choices, default=Purpose.ACCOUNT_EMAIL)
    target_email = models.EmailField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    @staticmethod
    def generate_code():
        return ''.join(random.choices(string.digits, k=6))

    @property
    def is_expired(self):
        return timezone.now() > self.created_at + timezone.timedelta(minutes=15)


class UniversityDomain(models.Model):
    """Database-backed mapping of university email domains to institution names."""

    domain = models.CharField(max_length=255, unique=True)
    university_name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['university_name', 'domain']

    def __str__(self):
        return f"{self.university_name} ({self.domain})"


class StudentProfile(models.Model):
    """Extended profile for students."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    university = models.CharField(max_length=200, blank=True)
    university_email = models.EmailField(blank=True)
    university_verified = models.BooleanField(default=False)
    university_verified_at = models.DateTimeField(null=True, blank=True)
    course = models.CharField(max_length=200, blank=True)
    year_of_study = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"Student: {self.user.display_name}"

    @property
    def university_verification_active(self):
        return bool(
            self.university_verified and
            self.university_verified_at and
            timezone.now() < self.university_verified_at + timezone.timedelta(days=365)
        )

    @property
    def university_email_can_change(self):
        if not self.university_verified_at:
            return True
        return timezone.now() >= self.university_verified_at + timezone.timedelta(days=30)


class TutorProfile(models.Model):
    """Extended profile for tutors with verification workflow."""

    class VerificationStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        UNDER_REVIEW = 'under_review', 'Under Review'
        INFO_REQUESTED = 'info_requested', 'Info Requested'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='tutor_profile')
    bio = models.TextField(blank=True, max_length=2000)
    subjects = models.JSONField(default=list, help_text="List of subjects the tutor teaches")
    hourly_rate = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    experience_years = models.IntegerField(default=0)
    company_email = models.EmailField(help_text="University/company email for verification")
    company_email_verified = models.BooleanField(default=False)
    university = models.CharField(max_length=200, blank=True, help_text="University the tutor is affiliated with")
    university_verified = models.BooleanField(default=False)
    university_verified_at = models.DateTimeField(null=True, blank=True)

    # Approximate location for in-person bookings (added 2026-04-25).
    # Public — shown on the tutor's profile so students can gauge proximity.
    # Deliberately NOT a precise address.
    location_city = models.CharField(max_length=100, blank=True,
                                      help_text="City or town the tutor is based in (approximate, public).")
    location_postcode_area = models.CharField(max_length=10, blank=True,
                                               help_text="UK postcode area, e.g. 'SE1' or 'EC2A'. "
                                                         "First half only — never the full postcode.")

    # Verification
    verification_status = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )
    photo_id = models.FileField(upload_to='verification/photo_id/', null=True, blank=True)
    qualifications_doc = models.FileField(upload_to='verification/qualifications/', null=True, blank=True)
    dbs_certificate = models.FileField(upload_to='verification/dbs/', null=True, blank=True)
    personal_statement = models.TextField(blank=True, max_length=3000)
    rejection_reason = models.TextField(blank=True)

    # Stats
    average_rating = models.FloatField(default=0.0)
    total_sessions = models.IntegerField(default=0)
    total_reviews = models.IntegerField(default=0)

    def __str__(self):
        return f"Tutor: {self.user.display_name} ({self.verification_status})"

    @property
    def university_verification_active(self):
        return bool(
            self.university_verified and
            self.university_verified_at and
            timezone.now() < self.university_verified_at + timezone.timedelta(days=365)
        )

    @property
    def university_email_can_change(self):
        if not self.university_verified_at:
            return True
        return timezone.now() >= self.university_verified_at + timezone.timedelta(days=30)


class VerificationDocument(models.Model):
    """Individual verification documents uploaded by tutors."""

    class DocType(models.TextChoices):
        PHOTO_ID = 'photo_id', 'Photo ID'
        QUALIFICATION = 'qualification', 'Qualification'
        DBS = 'dbs', 'DBS Certificate'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tutor = models.ForeignKey(TutorProfile, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=20, choices=DocType.choices)
    file = models.FileField(upload_to='verification/documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    review_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
        default='pending'
    )
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    review_notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.document_type} — {self.tutor.user.display_name}"


class Notification(models.Model):
    """Platform notifications for all user types."""

    class NotifType(models.TextChoices):
        BOOKING_CONFIRMED = 'booking_confirmed', 'Booking Confirmed'
        BOOKING_CANCELLED = 'booking_cancelled', 'Booking Cancelled'
        BOOKING_REMINDER = 'booking_reminder', 'Booking Reminder'
        VERIFICATION_UPDATE = 'verification_update', 'Verification Update'
        FORUM_REPLY = 'forum_reply', 'Forum Reply'
        FORUM_UPVOTE = 'forum_upvote', 'Forum Upvote'
        MESSAGE = 'message', 'New Message'
        MODERATION_ACTION = 'moderation_action', 'Moderation Action'
        SYSTEM = 'system', 'System'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NotifType.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=500, blank=True, help_text="Frontend route to navigate to when clicked")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} → {self.user.display_name}"


class ContactMessage(models.Model):
    """Contact form submissions."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='contact_messages')
    email = models.EmailField()
    name = models.CharField(max_length=100)
    subject = models.CharField(max_length=200)
    message = models.TextField(max_length=5000)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.subject} — {self.email}"
