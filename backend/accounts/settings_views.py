"""Settings views — profile, password, avatar, accessibility, delete account, contact."""
from rest_framework import status, permissions, views
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import User, StudentProfile, TutorProfile, ContactMessage
from .serializers import UserSerializer, StudentProfileSerializer, TutorProfileSerializer, ContactMessageSerializer


class UpdateProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        user = request.user
        for field in ['first_name', 'last_name', 'date_of_birth']:
            if field in request.data:
                setattr(user, field, request.data[field] if request.data[field] else None)
        user.save()

        if user.role == 'student' and hasattr(user, 'student_profile'):
            profile = user.student_profile
            for field in ['university', 'course', 'year_of_study']:
                if field in request.data:
                    setattr(profile, field, request.data[field])
            profile.save()

        if user.role == 'tutor' and hasattr(user, 'tutor_profile'):
            profile = user.tutor_profile
            for field in ['bio', 'hourly_rate', 'experience_years', 'personal_statement', 'university']:
                if field in request.data:
                    setattr(profile, field, request.data[field])
            if 'subjects' in request.data:
                subjects = request.data['subjects']
                profile.subjects = [s.strip() for s in subjects.split(',')] if isinstance(subjects, str) else subjects
            profile.save()

        return Response({'message': 'Profile updated.', 'user': _get_full_user_data(user)})


class ChangeDisplayNameView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        new_name = request.data.get('display_name', '').strip()

        if not new_name or len(new_name) < 3:
            return Response({'error': 'Username must be at least 3 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_name == user.display_name:
            return Response({'error': 'This is already your username.'}, status=status.HTTP_400_BAD_REQUEST)
        if not user.can_change_display_name:
            return Response({
                'error': 'You can only change your username once every 90 days.',
                'available_at': user.display_name_change_available_at.isoformat() if user.display_name_change_available_at else None,
            }, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(display_name=new_name).exclude(id=user.id).exists():
            return Response({'error': 'This username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)

        user.display_name = new_name
        user.last_display_name_change = timezone.now()
        user.save()
        return Response({'message': 'Username changed.', 'user': _get_full_user_data(user)})


class ChangePasswordView(views.APIView):
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
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if 'avatar' not in request.FILES:
            return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        avatar = request.FILES['avatar']
        if avatar.size > 5 * 1024 * 1024:
            return Response({'error': 'File too large. Maximum 5MB.'}, status=status.HTTP_400_BAD_REQUEST)
        if avatar.content_type not in ['image/jpeg', 'image/png', 'image/webp']:
            return Response({'error': 'Only JPEG, PNG, and WebP images are allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
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


class UpdateAccessibilityView(views.APIView):
    """Update accessibility preferences — available to ALL user roles."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        for field in ['text_size', 'high_contrast', 'reduced_motion']:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        return Response({'message': 'Accessibility settings updated.', 'user': _get_full_user_data(user)})


class UpdateNotificationPrefsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({'message': 'Notification preferences updated.'})


class DeleteAccountView(views.APIView):
    """Soft-delete account. Posts remain but profile becomes '[Deleted User]'."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        password = request.data.get('password', '')
        reason = request.data.get('reason', '')

        if not request.user.check_password(password):
            return Response({'error': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.is_deleted = True
        user.is_active = False
        user.deletion_reason = reason
        user.display_name = f'deleted_{str(user.id)[:8]}'
        user.first_name = ''
        user.last_name = ''
        if user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
        user.save()

        return Response({'message': 'Account deleted.'})


class ContactFormView(views.APIView):
    """Submit a contact form message."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ContactMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user if request.user.is_authenticated else None
        ContactMessage.objects.create(
            user=user,
            email=serializer.validated_data['email'],
            name=serializer.validated_data['name'],
            subject=serializer.validated_data['subject'],
            message=serializer.validated_data['message'],
        )
        return Response({'message': 'Your message has been sent. We will get back to you shortly.'}, status=status.HTTP_201_CREATED)


def _get_full_user_data(user):
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
    return data
