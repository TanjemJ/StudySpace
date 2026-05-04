import uuid
from django.db import models
from accounts.models import User, TutorProfile, StudentProfile


class AvailabilitySlot(models.Model):
    """Time slots that tutors make available for booking."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tutor = models.ForeignKey(TutorProfile, on_delete=models.CASCADE, related_name='availability_slots')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_booked = models.BooleanField(default=False)
    is_recurring = models.BooleanField(default=False, help_text="Repeat weekly")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'start_time']
        unique_together = ['tutor', 'date', 'start_time']

    def __str__(self):
        return f"{self.tutor.user.display_name} — {self.date} {self.start_time}-{self.end_time}"


class Booking(models.Model):

    class Status(models.TextChoices):
        PENDING_PAYMENT = 'pending_payment', 'Pending Payment'
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CHANGE_REQUESTED = 'change_requested', 'Change Requested'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    class SessionType(models.TextChoices):
        VIDEO = 'video', 'Video Call'
        IN_PERSON = 'in_person', 'In Person'
        CHAT = 'chat', 'Chat (legacy)'
        OTHER = 'other', 'Other'

    class VideoPlatform(models.TextChoices):
        GOOGLE_MEET = 'google_meet', 'Google Meet'
        ZOOM = 'zoom', 'Zoom'
        TEAMS = 'teams', 'Microsoft Teams'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='student_bookings')
    tutor = models.ForeignKey(TutorProfile, on_delete=models.CASCADE, related_name='tutor_bookings')
    slot = models.OneToOneField(AvailabilitySlot, on_delete=models.CASCADE, related_name='booking')
    subject = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    session_type = models.CharField(max_length=20, choices=SessionType.choices, default=SessionType.VIDEO)

    video_platform = models.CharField(
        max_length=20, blank=True, choices=VideoPlatform.choices,
        help_text="Which video platform this session will use. "
                  "Only meaningful when session_type='video'.",
    )
    location_suggestion = models.CharField(
        max_length=200, blank=True,
        help_text="Student's suggested location for an in-person session. "
                  "The tutor decides the final location.",
    )

    student_note = models.TextField(blank=True, max_length=500)
    tutor_note = models.TextField(blank=True, max_length=500)
    session_link = models.URLField(blank=True)
    price = models.DecimalField(max_digits=6, decimal_places=2)

    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='+',
    )
    refund_percent = models.IntegerField(default=0, help_text="0, 50 or 100")
    payment_expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.display_name} → {self.tutor.user.display_name} ({self.status})"


class BookingChangeRequest(models.Model):
    """
    Either party can propose a change to date/time/session_type/platform/location.
    The other party sees a diff of current vs proposed and accepts or declines.
    """

    class RequestedBy(models.TextChoices):
        STUDENT = 'student', 'Student'
        TUTOR = 'tutor', 'Tutor'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'
        WITHDRAWN = 'withdrawn', 'Withdrawn'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='change_requests')
    requested_by = models.CharField(max_length=10, choices=RequestedBy.choices)
    requested_by_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='+')

    # Proposed new values (nullable — only fields the requester wants to change are set)
    proposed_date = models.DateField(null=True, blank=True)
    proposed_start_time = models.TimeField(null=True, blank=True)
    proposed_end_time = models.TimeField(null=True, blank=True)
    proposed_session_type = models.CharField(
        max_length=20, blank=True,
        choices=Booking.SessionType.choices,
    )
    # New (2026-04-25): platform / location can also be change-requested.
    proposed_video_platform = models.CharField(
        max_length=20, blank=True,
        choices=Booking.VideoPlatform.choices,
    )
    proposed_location_suggestion = models.CharField(max_length=200, blank=True)

    message = models.TextField(blank=True, max_length=500)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Change #{self.id.hex[:6]} by {self.requested_by} on {self.booking_id}"


class BookingDocument(models.Model):
    """File attachment on a booking. Either side can upload."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='documents')
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='+')
    file = models.FileField(upload_to='booking_docs/')
    original_name = models.CharField(max_length=255)
    description = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.original_name} on booking {self.booking_id}"


class PaymentRecord(models.Model):
    """Payment records for bookings (sandbox/test mode)."""

    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        REFUNDED = 'refunded', 'Refunded'
        PARTIALLY_REFUNDED = 'partially_refunded', 'Partially Refunded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='payment')
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    currency = models.CharField(max_length=3, default='GBP')
    payment_method = models.CharField(max_length=20, default='stripe')
    transaction_id = models.CharField(max_length=200, blank=True)
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True, db_index=True)
    stripe_checkout_url = models.URLField(max_length=1000, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, db_index=True)
    stripe_account_id = models.CharField(max_length=255, blank=True)
    platform_fee_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    tutor_payout_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    refunded_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.status} — £{self.amount} for {self.booking}"


class Review(models.Model):
    """Student reviews of tutors after completed sessions."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='review')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_given')
    tutor = models.ForeignKey(TutorProfile, on_delete=models.CASCADE, related_name='reviews')
    rating = models.IntegerField(choices=[(i, str(i)) for i in range(1, 6)])
    comment = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.display_name} → {self.tutor.user.display_name}: {self.rating}★"
