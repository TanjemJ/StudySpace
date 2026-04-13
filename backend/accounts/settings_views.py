"""
Settings-related views for profile management, password change, avatar upload, etc.
Kept separate from views.py to avoid modifying existing registration/auth code.
"""
from rest_framework import status, permissions, views
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import User, StudentProfile, TutorProfile
from .serializers import UserSerializer, StudentProfileSerializer, TutorProfileSerializer


class UpdateProfileView(views.APIView):
    """Update basic profile fields: first_name, last_name, date_of_birth."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        user = request.user
        allowed = ['first_name', 'last_name', 'date_of_birth']
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field] if request.data[field] else None)
        user.save()

        # Update role-specific profile
        if user.role == 'student' and hasattr(user, 'student_profile'):
            profile = user.student_profile
            for field in ['university', 'course', 'year_of_study']:
                if field in request.data:
                    setattr(profile, field, request.data[field])
            profile.save()

        if user.role == 'tutor' and hasattr(user, 'tutor_profile'):
            profile = user.tutor_profile
            for field in ['bio', 'hourly_rate', 'experience_years', 'personal_statement']:
                if field in request.data:
                    setattr(profile, field, request.data[field])
            if 'subjects' in request.data:
                subjects = request.data['subjects']
                if isinstance(subjects, str):
                    profile.subjects = [s.strip() for s in subjects.split(',') if s.strip()]
                else:
                    profile.subjects = subjects
            profile.save()

        return Response({'message': 'Profile updated.', 'user': _get_full_user_data(user)})


class ChangeDisplayNameView(views.APIView):
    """Change display name with 90-day cooldown."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        new_name = request.data.get('display_name', '').strip()

        if not new_name or len(new_name) < 3:
            return Response({'error': 'Username must be at least 3 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_name == user.display_name:
            return Response({'error': 'This is already your username.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.can_change_display_name:
            available = user.display_name_change_available_at
            return Response({
                'error': f'You can only change your username once every 90 days.',
                'available_at': available.isoformat() if available else None,
            }, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(display_name=new_name).exclude(id=user.id).exists():
            return Response({'error': 'This username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)

        user.display_name = new_name
        user.last_display_name_change = timezone.now()
        user.save()

        return Response({'message': 'Username changed.', 'user': _get_full_user_data(user)})


class ChangePasswordView(views.APIView):
    """Change password with current password verification."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        current = request.data.get('current_password', '')
        new_pw = request.data.get('new_password', '')
        confirm = request.data.get('confirm_password', '')

        if not user.check_password(current):
            return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_pw != confirm:
            return Response({'error': 'New passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_pw, user)
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_pw)
        user.save()
        return Response({'message': 'Password changed successfully.'})


class UploadAvatarView(views.APIView):
    """Upload or remove profile picture."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user
        if 'avatar' not in request.FILES:
            return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        avatar = request.FILES['avatar']

        # Validate file
        if avatar.size > 5 * 1024 * 1024:
            return Response({'error': 'File too large. Maximum 5MB.'}, status=status.HTTP_400_BAD_REQUEST)
        if avatar.content_type not in ['image/jpeg', 'image/png', 'image/webp']:
            return Response({'error': 'Only JPEG, PNG, and WebP images are allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        # Delete old avatar
        if user.avatar:
            user.avatar.delete(save=False)

        user.avatar = avatar
        user.save()
        return Response({'message': 'Avatar uploaded.', 'avatar_url': user.avatar.url if user.avatar else None})

    def delete(self, request):
        user = request.user
        if user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
            user.save()
        return Response({'message': 'Avatar removed.'})


class UpdateNotificationPrefsView(views.APIView):
    """Update notification preferences (stored as JSON on the profile)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # For now, just acknowledge — full notification prefs would need a new model
        return Response({'message': 'Notification preferences updated.'})


class UpdateAccessibilityView(views.APIView):
    """Update accessibility preferences for students."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != 'student' or not hasattr(user, 'student_profile'):
            return Response({'error': 'Only students have accessibility settings.'}, status=status.HTTP_400_BAD_REQUEST)

        profile = user.student_profile
        for field in ['text_size', 'high_contrast', 'reduced_motion']:
            if field in request.data:
                setattr(profile, field, request.data[field])
        profile.save()

        return Response({'message': 'Accessibility settings updated.'})


class DeleteAccountView(views.APIView):
    """Permanently delete user account."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        password = request.data.get('password', '')
        if not request.user.check_password(password):
            return Response({'error': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.delete()
        return Response({'message': 'Account deleted.'})


def _get_full_user_data(user):
    """Helper to return user data with role-specific profile."""
    data = UserSerializer(user).data
    if user.role == 'student':
        try:
            data['student_profile'] = StudentProfileSerializer(user.student_profile).data
        except Exception:
            pass
    elif user.role == 'tutor':
        try:
            data['tutor_profile'] = TutorProfileSerializer(user.tutor_profile).data
        except Exception:
            pass
    data['can_change_display_name'] = user.can_change_display_name
    data['display_name_change_available_at'] = (
        user.display_name_change_available_at.isoformat()
        if user.display_name_change_available_at else None
    )
    return data
