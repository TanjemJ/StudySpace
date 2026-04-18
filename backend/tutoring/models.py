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
    """A booking between a student and a tutor."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CHANGE_REQUESTED = 'change_requested', 'Change Requested'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    class SessionType(models.TextChoices):
        VIDEO = 'video', 'Video Call'
        IN_PERSON = 'in_person', 'In Person'
        CHAT = 'chat', 'Chat'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='student_bookings')
    tutor = models.ForeignKey(TutorProfile, on_delete=models.CASCADE, related_name='tutor_bookings')
    slot = models.OneToOneField(AvailabilitySlot, on_delete=models.CASCADE, related_name='booking')
    subject = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    session_type = models.CharField(max_length=20, choices=SessionType.choices, default=SessionType.VIDEO)
    student_note = models.TextField(blank=True, max_length=500)
    tutor_note = models.TextField(blank=True, max_length=500)
    session_link = models.URLField(blank=True)
    price = models.DecimalField(max_digits=6, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.display_name} → {self.tutor.user.display_name} ({self.status})"


class PaymentRecord(models.Model):
    """Payment records for bookings (sandbox/test mode)."""

    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        REFUNDED = 'refunded', 'Refunded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='payment')
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    currency = models.CharField(max_length=3, default='GBP')
    payment_method = models.CharField(max_length=20, default='stripe')
    transaction_id = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
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
