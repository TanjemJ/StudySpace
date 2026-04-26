from types import SimpleNamespace

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone


from .models import (
    User,
    StudentProfile,
    TutorProfile,
    EmailVerificationCode,
    PendingRegistration,
    Notification,
    ContactMessage,
)


class PasswordStrengthSerializer(serializers.Serializer):
    password = serializers.CharField()


# --- Registration steps ---
class RegisterStep1Serializer(serializers.Serializer):
    """
    Validates step-1 signup. See StudySpacePasswordValidator for password rules.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=User.Role.choices)

    def validate_email(self, value):
        email = (value or '').strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        synthetic_user = SimpleNamespace(
            email=data['email'],
            first_name='',
            last_name='',
            display_name='',
            username=data['email'],
        )
        try:
            validate_password(data['password'], user=synthetic_user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})

        return data


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)


class RegisterStep2Serializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=50)
    last_name = serializers.CharField(max_length=50)
    display_name = serializers.CharField(max_length=30)
    date_of_birth = serializers.DateField(
        required=True,
        allow_null=False,
        error_messages={
            'required': 'Please enter your date of birth.',
            'null': 'Please enter your date of birth.',
            'invalid': 'Please enter a valid date of birth.',
        },
    )

    def validate_display_name(self, value):
        if User.objects.filter(display_name=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters.")
        return value
    
    def validate_date_of_birth(self, value):
        today = timezone.localdate()

        if value > today:
            raise serializers.ValidationError('Date of birth cannot be in the future.')

        try:
            latest_allowed_birth_date = today.replace(year=today.year - 18)
        except ValueError:
            latest_allowed_birth_date = today.replace(year=today.year - 18, month=2, day=28)

        if value > latest_allowed_birth_date:
            raise serializers.ValidationError('You must be at least 18 years old to use StudySpace.')

        return value

class RegisterStep3StudentSerializer(serializers.Serializer):
    university = serializers.CharField(required=False, allow_blank=True)
    university_email = serializers.EmailField(required=False, allow_blank=True)
    course = serializers.CharField(required=False, allow_blank=True)
    year_of_study = serializers.IntegerField(required=False, allow_null=True)


class RegisterTutorStep3Serializer(serializers.Serializer):
    company_email = serializers.EmailField()
    subjects = serializers.ListField(child=serializers.CharField(), min_length=1)


class RegisterTutorStep4Serializer(serializers.Serializer):
    """
    Tutor step 4 — rate, experience, personal statement, and approximate location.
    The location fields are required because students need to see where the tutor
    is based when deciding whether to book.
    """
    hourly_rate = serializers.DecimalField(max_digits=6, decimal_places=2)
    experience_years = serializers.IntegerField(min_value=0)
    personal_statement = serializers.CharField(max_length=3000, required=False, allow_blank=True)
    location_city = serializers.CharField(max_length=100)
    location_postcode_area = serializers.CharField(max_length=10, required=False, allow_blank=True)


class RegisterTutorStep5Serializer(serializers.Serializer):
    pass


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


# --- User detail ---
class UserSerializer(serializers.ModelSerializer):
    can_change_display_name = serializers.BooleanField(read_only=True)
    display_name_change_available_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'display_name', 'first_name', 'last_name',
            'role', 'avatar', 'is_email_verified', 'is_deleted', 'date_of_birth',
            'text_size', 'high_contrast', 'reduced_motion',
            'underline_links', 'dyslexia_font', 'focus_ring_boost',
            'can_change_display_name', 'display_name_change_available_at',
            'created_at',
        ]
        read_only_fields = ['id', 'email', 'role', 'is_deleted', 'created_at']


class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    university_verification_active = serializers.ReadOnlyField()
    university_email_can_change = serializers.ReadOnlyField()

    class Meta:
        model = StudentProfile
        fields = '__all__'


class TutorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    university_verification_active = serializers.ReadOnlyField()
    university_email_can_change = serializers.ReadOnlyField()

    class Meta:
        model = TutorProfile
        fields = '__all__'    # automatically picks up location_city + location_postcode_area


class TutorCardSerializer(serializers.ModelSerializer):
    """Lightweight serializer used in tutor search results / cards."""
    user = UserSerializer(read_only=True)

    class Meta:
        model = TutorProfile
        fields = [
            'user', 'bio', 'subjects', 'hourly_rate', 'experience_years',
            'verification_status', 'average_rating', 'total_sessions', 'total_reviews',
            'university', 'university_verified',
            # New (2026-04-25):
            'location_city', 'location_postcode_area',
        ]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ['id', 'user', 'created_at']


class CheckUsernameSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=30)

    def validate_display_name(self, value):
        if User.objects.filter(display_name=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['id', 'email', 'name', 'subject', 'message', 'created_at']
        read_only_fields = ['id', 'created_at']
