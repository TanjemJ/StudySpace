"""Settings views — profile, password, avatar, accessibility, delete account, contact."""
from rest_framework import status, permissions, views
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.conf import settings


from .models import User, StudentProfile, TutorProfile, ContactMessage, EmailVerificationCode
from .serializers import UserSerializer, StudentProfileSerializer, TutorProfileSerializer, ContactMessageSerializer
from .university_email_service import validate_university_email, university_email_is_verified_elsewhere
from .views import send_verification_email


def _get_university_profile(user):
    if user.role == User.Role.STUDENT:
        profile, _ = StudentProfile.objects.get_or_create(user=user)
        return profile, 'student'

    if user.role == User.Role.TUTOR:
        profile, _ = TutorProfile.objects.get_or_create(user=user)
        return profile, 'tutor'

    return None, None

def _apply_verified_university_email(profile, profile_type, verified_email, university_name):
    if profile_type == 'student':
        profile.university = university_name
        profile.university_email = verified_email
        profile.university_verified = True
        profile.university_verified_at = timezone.now()
    else:
        profile.university = university_name
        profile.company_email = verified_email
        profile.company_email_verified = True
        profile.university_verified = True
        profile.university_verified_at = timezone.now()

    profile.save()


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

            if 'university' in request.data:
                requested_university = request.data['university']
                if profile.university_verification_active and requested_university != profile.university:
                    return Response(
                        {'error': 'You cannot change your university while an active verified university email is linked to your account.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                profile.university = requested_university

            for field in ['course', 'year_of_study']:
                if field in request.data:
                    setattr(profile, field, request.data[field])

            profile.save()


        if user.role == 'tutor' and hasattr(user, 'tutor_profile'):
            profile = user.tutor_profile

            for field in ['bio', 'hourly_rate', 'experience_years', 'personal_statement',
              'location_city', 'location_postcode_area']:
                if field in request.data:
                    setattr(profile, field, request.data[field])

            if 'university' in request.data:
                requested_university = request.data['university']
                if profile.university_verification_active and requested_university != profile.university:
                    return Response(
                        {'error': 'You cannot change your institution while an active verified university email is linked to your account.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                profile.university = requested_university

            if 'subjects' in request.data:
                subjects = request.data['subjects']
                profile.subjects = [s.strip() for s in subjects.split(',')] if isinstance(subjects, str) else subjects

            profile.save()


        return Response({'message': 'Profile updated.', 'user': _get_full_user_data(user)})

class SendUniversityVerificationCodeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'university_send'

    def post(self, request):
        user = request.user
        profile, profile_type = _get_university_profile(user)

        if not profile:
            return Response(
                {'error': 'This account cannot verify a university email.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = (request.data.get('email') or '').strip().lower()
        validation = validate_university_email(email)
        if not validation['ok']:
            return Response(
                {'error': validation['error']},
                status=validation.get('status_code', status.HTTP_400_BAD_REQUEST),
            )
        
        if university_email_is_verified_elsewhere(email, user):
            return Response(
                {'error': 'This university email is already verified on another StudySpace account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_verified_email = (
            profile.university_email if profile_type == 'student' else profile.company_email
        )

        if profile.university_verification_active and current_verified_email == email:
            return Response({
                'message': 'This university email is already actively verified.',
                'already_verified': True,
                'user': _get_full_user_data(user),
            })

        if (
            current_verified_email
            and profile.university_verified
            and current_verified_email != email
            and not profile.university_email_can_change
        ):
            available_at = (
                profile.university_verified_at + timezone.timedelta(days=30)
                if profile.university_verified_at else None
            )
            return Response(
                {
                    'error': 'You can only change your verified university email once every 30 days.',
                    'available_at': available_at.isoformat() if available_at else None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.is_email_verified and email == user.email.lower():
            _apply_verified_university_email(
                profile=profile,
                profile_type=profile_type,
                verified_email=email,
                university_name=validation['university_name'],
            )
            return Response({
                'message': 'Your university email matches your already verified account email, so it has been verified automatically.',
                'auto_verified': True,
                'user': _get_full_user_data(user),
            })

        
        EmailVerificationCode.objects.filter(
            user=user,
            purpose=EmailVerificationCode.Purpose.UNIVERSITY_EMAIL,
            is_used=False,
        ).update(is_used=True)

        code = EmailVerificationCode.generate_code()
        EmailVerificationCode.objects.create(
            user=user,
            code=code,
            purpose=EmailVerificationCode.Purpose.UNIVERSITY_EMAIL,
            target_email=email,
        )

        try:
            send_verification_email(
                recipient_email=email,
                code=code,
                subject_line='StudySpace - Verify your university email',
                intro_line='Use this 6-digit code to verify your university email and unlock university-only features on StudySpace.',
            )
        except Exception as e:
            import traceback
            print("UNIVERSITY EMAIL SEND ERROR:", repr(e))
            traceback.print_exc()
            return Response(
                {'error': 'University verification email failed to send. Check backend terminal output.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'message': 'University verification code sent.',
            'university_name': validation['university_name'],
            'dev_code': code if settings.DEBUG and not getattr(settings, 'USE_SENDGRID_EMAIL', False) else None,
        })


class VerifyUniversityEmailCodeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        profile, profile_type = _get_university_profile(user)

        if not profile:
            return Response(
                {'error': 'This account cannot verify a university email.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        code = (request.data.get('code') or '').strip()
        if not code:
            return Response({'error': 'Verification code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        record = EmailVerificationCode.objects.filter(
            user=user,
            code=code,
            purpose=EmailVerificationCode.Purpose.UNIVERSITY_EMAIL,
            is_used=False,
        ).order_by('-created_at').first()

        if not record:
            return Response({'error': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        if record.is_expired:
            return Response({'error': 'Code has expired. Request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

        validation = validate_university_email(record.target_email)
        if not validation['ok']:
            return Response(
                {'error': validation['error']},
                status=validation.get('status_code', status.HTTP_400_BAD_REQUEST),
            )
                
        if university_email_is_verified_elsewhere(record.target_email, user):
            return Response(
                {'error': 'This university email is already verified on another StudySpace account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


        _apply_verified_university_email(
            profile=profile,
            profile_type=profile_type,
            verified_email=record.target_email,
            university_name=validation['university_name'],
        )

        profile.save()

        record.is_used = True
        record.save()

        EmailVerificationCode.objects.filter(
            user=user,
            purpose=EmailVerificationCode.Purpose.UNIVERSITY_EMAIL,
            is_used=False,
        ).exclude(id=record.id).update(is_used=True)

        return Response({
            'message': 'University email verified successfully.',
            'user': _get_full_user_data(user),
        })


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

    # Fields a client is allowed to write. Any other key in request.data
    # is silently ignored so no one can smuggle writes to arbitrary User fields.
    ALLOWED_FIELDS = {
        'text_size',
        'high_contrast',
        'reduced_motion',
        # NEW — added 2026-04-24
        'underline_links',
        'dyslexia_font',
        'focus_ring_boost',
    }

    def post(self, request):
        user = request.user
        for field in self.ALLOWED_FIELDS:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        return Response({
            'message': 'Accessibility settings updated.',
            'user': _get_full_user_data(user),
        })



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
