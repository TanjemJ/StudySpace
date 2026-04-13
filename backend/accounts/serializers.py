from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, StudentProfile, TutorProfile, EmailVerificationCode, Notification


class PasswordStrengthSerializer(serializers.Serializer):
    """Check password strength and return score."""
    password = serializers.CharField()

    def validate_password(self, value):
        score = 0
        if len(value) >= 8: score += 1
        if len(value) >= 12: score += 1
        if any(c.isupper() for c in value): score += 1
        if any(c.islower() for c in value): score += 1
        if any(c.isdigit() for c in value): score += 1
        if any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in value): score += 1
        return value, score


# --- Step 1: Email & Password ---
class RegisterStep1Serializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=User.Role.choices)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(data['password'])
        return data


# --- Step 1b: Verify email code ---
class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)


# --- Step 2: Personal Info ---
class RegisterStep2Serializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=50)
    last_name = serializers.CharField(max_length=50)
    display_name = serializers.CharField(max_length=30)
    date_of_birth = serializers.DateField(required=False)

    def validate_display_name(self, value):
        if User.objects.filter(display_name=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters.")
        return value


# --- Step 3: Student university info (optional) ---
class RegisterStep3StudentSerializer(serializers.Serializer):
    university = serializers.CharField(required=False, allow_blank=True)
    university_email = serializers.EmailField(required=False, allow_blank=True)
    course = serializers.CharField(required=False, allow_blank=True)
    year_of_study = serializers.IntegerField(required=False)


# --- Tutor extra steps ---
class RegisterTutorStep3Serializer(serializers.Serializer):
    """Tutor Step 3: Company/university email (mandatory)."""
    company_email = serializers.EmailField()
    subjects = serializers.ListField(child=serializers.CharField(), min_length=1)


class RegisterTutorStep4Serializer(serializers.Serializer):
    """Tutor Step 4: Rate & experience."""
    hourly_rate = serializers.DecimalField(max_digits=6, decimal_places=2)
    experience_years = serializers.IntegerField(min_value=0)
    personal_statement = serializers.CharField(max_length=3000, required=False)


class RegisterTutorStep5Serializer(serializers.Serializer):
    """Tutor Step 5: Document uploads handled via multipart form."""
    pass  # Files handled in the view directly


# --- Login ---
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


# --- User detail ---
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'display_name', 'first_name', 'last_name',
                  'role', 'avatar', 'is_email_verified', 'date_of_birth', 'created_at']
        read_only_fields = ['id', 'email', 'role', 'created_at']


class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = StudentProfile
        fields = '__all__'


class TutorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = TutorProfile
        fields = '__all__'


class TutorCardSerializer(serializers.ModelSerializer):
    """Lightweight serializer for tutor search results."""
    user = UserSerializer(read_only=True)

    class Meta:
        model = TutorProfile
        fields = ['user', 'bio', 'subjects', 'hourly_rate', 'experience_years',
                  'verification_status', 'average_rating', 'total_sessions', 'total_reviews']


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
