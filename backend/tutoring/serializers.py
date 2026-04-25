from rest_framework import serializers
from .models import (
    AvailabilitySlot, Booking, PaymentRecord, Review,
    BookingChangeRequest, BookingDocument,
)
from accounts.serializers import UserSerializer


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilitySlot
        fields = '__all__'
        read_only_fields = ['id', 'tutor', 'is_booked', 'created_at']


class BookingDocumentSerializer(serializers.ModelSerializer):
    uploader_name = serializers.CharField(source='uploaded_by.display_name', read_only=True)
    uploader_role = serializers.CharField(source='uploaded_by.role', read_only=True)
    uploader_id = serializers.CharField(source='uploaded_by.id', read_only=True)
    file_url = serializers.SerializerMethodField()
    size_bytes = serializers.SerializerMethodField()

    class Meta:
        model = BookingDocument
        fields = [
            'id', 'booking', 'uploaded_by', 'uploader_id', 'uploader_name', 'uploader_role',
            'file', 'file_url', 'original_name', 'description',
            'size_bytes', 'created_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'created_at']

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get('request')
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def get_size_bytes(self, obj):
        try:
            return obj.file.size
        except Exception:
            return None


class BookingChangeRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by_user.display_name', read_only=True)

    # Current values on the booking (for showing a diff client-side)
    current_date = serializers.DateField(source='booking.slot.date', read_only=True)
    current_start_time = serializers.TimeField(source='booking.slot.start_time', read_only=True)
    current_end_time = serializers.TimeField(source='booking.slot.end_time', read_only=True)
    current_session_type = serializers.CharField(source='booking.session_type', read_only=True)
    current_video_platform = serializers.CharField(source='booking.video_platform', read_only=True)
    current_location_suggestion = serializers.CharField(source='booking.location_suggestion', read_only=True)

    class Meta:
        model = BookingChangeRequest
        fields = [
            'id', 'booking', 'requested_by', 'requested_by_name',
            'proposed_date', 'proposed_start_time', 'proposed_end_time',
            'proposed_session_type',
            'proposed_video_platform', 'proposed_location_suggestion',
            'message', 'status',
            'current_date', 'current_start_time', 'current_end_time',
            'current_session_type',
            'current_video_platform', 'current_location_suggestion',
            'created_at', 'resolved_at',
        ]
        read_only_fields = ['id', 'status', 'created_at', 'resolved_at']


class BookingSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.display_name', read_only=True)
    student_first_name = serializers.CharField(source='student.first_name', read_only=True)
    student_last_name = serializers.CharField(source='student.last_name', read_only=True)
    student_avatar = serializers.SerializerMethodField()
    student_id = serializers.CharField(source='student.id', read_only=True)

    tutor_name = serializers.CharField(source='tutor.user.display_name', read_only=True)
    tutor_first_name = serializers.CharField(source='tutor.user.first_name', read_only=True)
    tutor_last_name = serializers.CharField(source='tutor.user.last_name', read_only=True)
    tutor_avatar = serializers.SerializerMethodField()
    tutor_id = serializers.CharField(source='tutor.user.id', read_only=True)

    slot_date = serializers.DateField(source='slot.date', read_only=True)
    slot_start = serializers.TimeField(source='slot.start_time', read_only=True)
    slot_end = serializers.TimeField(source='slot.end_time', read_only=True)

    # Related objects
    documents = BookingDocumentSerializer(many=True, read_only=True)
    pending_change = serializers.SerializerMethodField()
    has_review = serializers.SerializerMethodField()

    # Cancellation policy info (computed on the fly)
    hours_until_session = serializers.SerializerMethodField()
    refund_tier = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ['id', 'student', 'price', 'created_at', 'updated_at',
                            'cancelled_at', 'cancelled_by', 'refund_percent']

    def get_student_avatar(self, obj):
        return obj.student.avatar.url if obj.student.avatar else None

    def get_tutor_avatar(self, obj):
        return obj.tutor.user.avatar.url if obj.tutor.user.avatar else None

    def get_pending_change(self, obj):
        cr = obj.change_requests.filter(status='pending').order_by('-created_at').first()
        if not cr:
            return None
        return BookingChangeRequestSerializer(cr, context=self.context).data

    def get_has_review(self, obj):
        return hasattr(obj, 'review')

    def get_hours_until_session(self, obj):
        from django.utils import timezone
        from datetime import datetime
        try:
            dt = datetime.combine(obj.slot.date, obj.slot.start_time)
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
            delta = dt - timezone.now()
            return round(delta.total_seconds() / 3600, 1)
        except Exception:
            return None

    def get_refund_tier(self, obj):
        h = self.get_hours_until_session(obj)
        if h is None:
            return None
        if h > 72:
            return {'tier': 'full', 'percent': 100, 'label': 'Full refund'}
        if h > 24:
            return {'tier': 'half', 'percent': 50, 'label': '50% refund'}
        return {'tier': 'none', 'percent': 0, 'label': 'No refund — booking removed only'}


class BookingCreateSerializer(serializers.Serializer):
    slot_id = serializers.UUIDField()
    subject = serializers.CharField(max_length=100)
    # New flow: only video / in_person are valid for new bookings (chat is legacy).
    session_type = serializers.ChoiceField(
        choices=[('video', 'Video Call'), ('in_person', 'In Person')],
        required=False,
    )
    student_note = serializers.CharField(max_length=500, allow_blank=True, required=False)
    # New (2026-04-25): platform / location collected at booking time.
    video_platform = serializers.ChoiceField(
        choices=Booking.VideoPlatform.choices,
        required=False, allow_blank=True,
    )
    location_suggestion = serializers.CharField(
        max_length=200, required=False, allow_blank=True,
    )

    def validate(self, data):
        """Cross-field validation tied to session_type."""
        session_type = data.get('session_type', 'video')
        if session_type == 'video':
            # Platform is optional at booking time — student may want the tutor
            # to choose. But strip a stray location.
            data['location_suggestion'] = ''
        elif session_type == 'in_person':
            # Strip any video platform that snuck in.
            data['video_platform'] = ''
        return data


class ReviewCreateSerializer(serializers.Serializer):
    booking_id = serializers.UUIDField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=1000)


class ReviewSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.display_name', read_only=True)
    student_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = '__all__'
        read_only_fields = ['id', 'student', 'tutor', 'booking', 'created_at']

    def get_student_avatar(self, obj):
        return obj.student.avatar.url if obj.student.avatar else None


class PaymentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRecord
        fields = '__all__'
