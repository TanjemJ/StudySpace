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
    last_display_name_change = models.DateTimeField(null=True, blank=True, help_text="Last time the display name was changed. 90-day cooldown.")
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


class EmailVerificationCode(models.Model):
    """Stores 6-digit codes sent to users during registration."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_codes')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    @staticmethod
    def generate_code():
        return ''.join(random.choices(string.digits, k=6))

    @property
    def is_expired(self):
        return timezone.now() > self.created_at + timezone.timedelta(minutes=15)


class StudentProfile(models.Model):
    """Extended profile for students."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    university = models.CharField(max_length=200, blank=True)
    university_email = models.EmailField(blank=True)
    university_verified = models.BooleanField(default=False)
    course = models.CharField(max_length=200, blank=True)
    year_of_study = models.IntegerField(null=True, blank=True)

    # Accessibility preferences
    text_size = models.CharField(max_length=20, default='medium',
                                  choices=[('small', 'Small'), ('medium', 'Medium'),
                                           ('large', 'Large'), ('xl', 'Extra Large')])
    high_contrast = models.BooleanField(default=False)
    reduced_motion = models.BooleanField(default=False)

    def __str__(self):
        return f"Student: {self.user.display_name}"


class TutorProfile(models.Model):
    """Extended profile for tutors with verification workflow."""

    class VerificationStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        UNDER_REVIEW = 'under_review', 'Under Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='tutor_profile')
    bio = models.TextField(blank=True, max_length=2000)
    subjects = models.JSONField(default=list, help_text="List of subjects the tutor teaches")
    hourly_rate = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    experience_years = models.IntegerField(default=0)
    company_email = models.EmailField(help_text="University/company email for verification")
    company_email_verified = models.BooleanField(default=False)

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
        VERIFICATION_UPDATE = 'verification_update', 'Verification Update'
        FORUM_REPLY = 'forum_reply', 'Forum Reply'
        MODERATION_ACTION = 'moderation_action', 'Moderation Action'
        SYSTEM = 'system', 'System'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NotifType.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} → {self.user.display_name}"
