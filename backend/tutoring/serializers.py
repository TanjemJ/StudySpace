from rest_framework import serializers
from .models import AvailabilitySlot, Booking, PaymentRecord, Review
from accounts.serializers import UserSerializer


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilitySlot
        fields = '__all__'
        read_only_fields = ['id', 'tutor', 'is_booked', 'created_at']


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

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ['id', 'student', 'price', 'created_at', 'updated_at']

    def get_student_avatar(self, obj):
        if obj.student.avatar:
            return obj.student.avatar.url
        return None

    def get_tutor_avatar(self, obj):
        if obj.tutor.user.avatar:
            return obj.tutor.user.avatar.url
        return None


class BookingCreateSerializer(serializers.Serializer):
    slot_id = serializers.UUIDField()
    subject = serializers.CharField(max_length=100)
    session_type = serializers.ChoiceField(choices=Booking.SessionType.choices, default='video')
    student_note = serializers.CharField(max_length=500, required=False, allow_blank=True)


class ReviewSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.display_name', read_only=True)
    student_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = '__all__'
        read_only_fields = ['id', 'student', 'tutor', 'booking', 'created_at']

    def get_student_avatar(self, obj):
        if obj.student.avatar:
            return obj.student.avatar.url
        return None


class ReviewCreateSerializer(serializers.Serializer):
    booking_id = serializers.UUIDField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=1000)


class PaymentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRecord
        fields = '__all__'
