from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.conf import settings
import uuid
import json
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jwt import InvalidTokenError, PyJWKClient
import jwt



from .university_email_service import validate_university_email, university_email_is_verified_elsewhere
from .models import (
    User, StudentProfile, TutorProfile,
    EmailVerificationCode, PendingRegistration, Notification,
)
from .serializers import (
    RegisterStep1Serializer, VerifyCodeSerializer, RegisterStep2Serializer,
    RegisterStep3StudentSerializer, RegisterTutorStep3Serializer,
    RegisterTutorStep4Serializer, LoginSerializer, UserSerializer,
    StudentProfileSerializer, TutorProfileSerializer, TutorCardSerializer,
    NotificationSerializer, CheckUsernameSerializer,
)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def send_verification_email(recipient_email, code, subject_line, intro_line):
    context = {
        'subject_line': subject_line,
        'intro_line': intro_line,
        'code': code,
    }

    text_body = render_to_string('emails/verification_code.txt', context)
    html_body = render_to_string('emails/verification_code.html', context)

    message = EmailMultiAlternatives(
        subject=subject_line,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient_email],
    )

    message.attach_alternative(html_body, 'text/html')
    message.send()


def _unique_temp_display_name():
    """Generate a unique temp display name — avoids display_name collision."""
    while True:
        candidate = f"user_{uuid.uuid4().hex[:8]}"
        if not User.objects.filter(display_name=candidate).exists():
            return candidate


class RegisterStep1View(views.APIView):
    """Stash a pending registration; no User created yet (see v1 update)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterStep1Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        email = data['email']

        stale = PendingRegistration.objects.filter(email=email).first()
        if stale and stale.is_expired:
            stale.delete()
            stale = None

        code = PendingRegistration.generate_code()
        hashed = make_password(data['password'])

        if stale:
            stale.hashed_password = hashed
            stale.role = data['role']
            stale.code = code
            stale.attempts = 0
            stale.save()
            pending = stale
        else:
            pending = PendingRegistration.objects.create(
                email=email,
                hashed_password=hashed,
                role=data['role'],
                code=code,
            )

        try:
            send_verification_email(
                recipient_email=email,
                code=code,
                subject_line='StudySpace - Verify your email',
                intro_line='Use this 6-digit code to verify your email address and continue setting up your StudySpace account.',
            )
        except Exception as e:
            import traceback
            print("SENDGRID REGISTER EMAIL ERROR:", repr(e))
            traceback.print_exc()
            pending.delete()
            return Response(
                {'error': 'Verification email failed to send. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'message': 'Check your email for the verification code.',
            'registration_id': str(pending.id),
            'email': email,
            'role': data['role'],
            'dev_code': code if settings.DEBUG and not getattr(settings, 'USE_SENDGRID_EMAIL', False) else None,
        }, status=status.HTTP_201_CREATED)


class VerifyEmailCodeView(views.APIView):
    """Verify the 6-digit code and atomically promote the pending row to a real User."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        submitted_code = serializer.validated_data['code']

        try:
            pending = PendingRegistration.objects.get(email=email)
        except PendingRegistration.DoesNotExist:
            return self._legacy_verify(email, submitted_code)

        if pending.is_expired:
            pending.delete()
            return Response(
                {'error': 'This code has expired. Please start again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if pending.attempts >= 6:
            pending.delete()
            return Response(
                {'error': 'Too many failed attempts. Please start again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if pending.code != submitted_code:
            pending.attempts += 1
            pending.save(update_fields=['attempts', 'updated_at'])
            return Response(
                {'error': 'Invalid verification code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if User.objects.filter(email=email).exists():
                pending.delete()
                return Response(
                    {'error': 'An account with this email already exists.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = User(
                email=email,
                username=email,
                role=pending.role,
                display_name=_unique_temp_display_name(),
                is_active=True,
                is_email_verified=True,
            )
            user.password = pending.hashed_password
            user.save()
            pending.delete()

        return Response({
            'message': 'Email verified successfully.',
            'user_id': str(user.id),
        })

    def _legacy_verify(self, email, submitted_code):
        """Fallback for users created before the PendingRegistration migration."""
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        verification = EmailVerificationCode.objects.filter(
            user=user,
            code=submitted_code,
            purpose=EmailVerificationCode.Purpose.ACCOUNT_EMAIL,
            target_email=user.email,
            is_used=False,
        ).order_by('-created_at').first()

        if not verification:
            return Response({'error': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)
        if verification.is_expired:
            return Response({'error': 'Code has expired. Request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

        verification.is_used = True
        verification.save()
        user.is_email_verified = True
        user.save()

        return Response({'message': 'Email verified successfully.', 'user_id': str(user.id)})


class ResendCodeView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()

        pending = PendingRegistration.objects.filter(email=email).first()

        if pending:
            if pending.is_expired:
                pending.delete()
                return Response(
                    {'error': 'Your registration has expired. Please start again.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            pending.code = PendingRegistration.generate_code()
            pending.attempts = 0
            pending.save(update_fields=['code', 'attempts', 'updated_at'])
            code = pending.code
            target_email = pending.email
        else:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return Response({'error': 'No pending signup found for this email.'},
                                status=status.HTTP_404_NOT_FOUND)

            code = EmailVerificationCode.generate_code()
            EmailVerificationCode.objects.create(
                user=user,
                code=code,
                purpose=EmailVerificationCode.Purpose.ACCOUNT_EMAIL,
                target_email=user.email,
            )
            target_email = user.email

        try:
            send_verification_email(
                recipient_email=target_email,
                code=code,
                subject_line='StudySpace - New verification code',
                intro_line='Here is your new 6-digit StudySpace verification code.',
            )
        except Exception as e:
            import traceback
            print("SENDGRID RESEND EMAIL ERROR:", repr(e))
            traceback.print_exc()
            return Response(
                {'error': 'Verification email failed to send. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'message': 'New code sent.',
            'dev_code': code if settings.DEBUG and not getattr(settings, 'USE_SENDGRID_EMAIL', False) else None,
        })


class RegisterStep2View(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterStep2Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        user.first_name = data['first_name']
        user.last_name = data['last_name']
        user.display_name = data['display_name']
        if data.get('date_of_birth'):
            user.date_of_birth = data['date_of_birth']
        user.save()

        return Response({'message': 'Personal info saved.', 'user_id': str(user.id)})


class RegisterStep3StudentView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterStep3StudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id, role=User.Role.STUDENT)
        except User.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = StudentProfile.objects.get_or_create(user=user)

        provided_university = data.get('university', '')
        provided_university_email = (data.get('university_email') or '').strip().lower()

        profile.university = provided_university
        profile.course = data.get('course', '')
        profile.year_of_study = data.get('year_of_study')

        candidate_university_email = provided_university_email or user.email.lower()
        validation = (
            validate_university_email(candidate_university_email)
            if candidate_university_email
            else {'ok': False}
        )

        if provided_university_email and not validation['ok']:
            return Response(
                {'error': validation['error']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if validation['ok'] and university_email_is_verified_elsewhere(candidate_university_email, user):
            return Response(
                {'error': 'This university email is already verified on another StudySpace account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


        profile.university_email = ''
        profile.university_verified = False
        profile.university_verified_at = None

        if (
            user.is_email_verified
            and candidate_university_email == user.email.lower()
            and validation['ok']
        ):
            profile.university = validation['university_name']
            profile.university_email = candidate_university_email
            profile.university_verified = True
            profile.university_verified_at = timezone.now()
        elif provided_university_email:
            profile.university_email = provided_university_email

        profile.save()

        user_data = UserSerializer(user).data
        user_data['student_profile'] = StudentProfileSerializer(profile).data

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Registration complete!',
            'user': user_data,
            'tokens': tokens,
        })


class RegisterTutorStep3View(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterTutorStep3Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id, role=User.Role.TUTOR)
        except User.DoesNotExist:
            return Response({'error': 'Tutor not found.'}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = TutorProfile.objects.get_or_create(user=user)
        profile.company_email = data['company_email']
        profile.subjects = data['subjects']
        profile.save()

        return Response({'message': 'Subjects and email saved.', 'user_id': str(user.id)})


class RegisterTutorStep4View(views.APIView):
    """
    Tutor step 4 — rate, experience, personal statement, and approximate location.
    Location is now collected here so students can see where the tutor is based
    when browsing tutor cards / profiles.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterTutorStep4Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_id = request.data.get('user_id')
        try:
            profile = TutorProfile.objects.get(user_id=user_id)
        except TutorProfile.DoesNotExist:
            return Response({'error': 'Tutor profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        profile.hourly_rate = data['hourly_rate']
        profile.experience_years = data['experience_years']
        profile.personal_statement = data.get('personal_statement', '')
        profile.location_city = (data.get('location_city') or '').strip()
        profile.location_postcode_area = (data.get('location_postcode_area') or '').strip().upper()
        profile.save()

        return Response({'message': 'Rate, experience, and location saved.', 'user_id': str(profile.user_id)})


class RegisterTutorStep5View(views.APIView):
    """Legacy single-file version — see tutor_docs_view.py for the multi-doc one."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user_id = request.data.get('user_id')
        try:
            profile = TutorProfile.objects.get(user_id=user_id)
        except TutorProfile.DoesNotExist:
            return Response({'error': 'Tutor profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.FILES.get('photo_id'):
            profile.photo_id = request.FILES['photo_id']
        if request.FILES.get('qualifications_doc'):
            profile.qualifications_doc = request.FILES['qualifications_doc']
        if request.FILES.get('dbs_certificate'):
            profile.dbs_certificate = request.FILES['dbs_certificate']

        profile.verification_status = TutorProfile.VerificationStatus.PENDING
        profile.save()

        tokens = get_tokens_for_user(profile.user)
        return Response({
            'message': 'Registration complete! Your profile is pending verification.',
            'user': UserSerializer(profile.user).data,
            'tokens': tokens,
        })


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=serializer.validated_data['email'],
            password=serializer.validated_data['password']
        )
        if not user:
            return Response({'error': 'Invalid email or password.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        if user.is_deleted:
            return Response({'error': 'This account has been deleted.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Login successful.',
            'user': UserSerializer(user).data,
            'tokens': tokens,
        })


def _verify_google_access_token(access_token):
    query = urlencode({'access_token': access_token})

    try:
        with urlopen(f'https://oauth2.googleapis.com/tokeninfo?{query}', timeout=5) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except (OSError, URLError, ValueError):
        raise ValueError('Invalid Google access token.')

    if payload.get('aud') != settings.GOOGLE_OAUTH_CLIENT_ID:
        raise ValueError('Google token was not issued for this app.')

    return payload


MICROSOFT_JWKS_URL = 'https://login.microsoftonline.com/common/discovery/v2.0/keys'

def _verify_microsoft_id_token(microsoft_id_token):
    jwks_client = PyJWKClient(MICROSOFT_JWKS_URL)
    signing_key = jwks_client.get_signing_key_from_jwt(microsoft_id_token)

    payload = jwt.decode(
        microsoft_id_token,
        signing_key.key,
        algorithms=['RS256'],
        audience=settings.MICROSOFT_CLIENT_ID,
        options={'verify_iss': False},
    )

    tenant_id = payload.get('tid')
    issuer = payload.get('iss')
    expected_issuer = f'https://login.microsoftonline.com/{tenant_id}/v2.0'

    if not tenant_id or issuer != expected_issuer:
        raise InvalidTokenError('Invalid Microsoft token issuer.')

    return payload


class GoogleLoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        credential = request.data.get('credential')
        access_token = request.data.get('access_token')

        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            return Response(
                {'error': 'Google login is not configured.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not credential and not access_token:
            return Response(
                {'error': 'Missing Google credential.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if credential:
                payload = id_token.verify_oauth2_token(
                    credential,
                    google_requests.Request(),
                    settings.GOOGLE_OAUTH_CLIENT_ID,
                )
            else:
                payload = _verify_google_access_token(access_token)
        except ValueError:
            return Response(
                {'error': 'Invalid Google login token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


        email = (payload.get('email') or '').strip().lower()
        email_verified = payload.get('email_verified')

        if not email or str(email_verified).lower() != 'true':
            return Response(
                {'error': 'Google did not return a verified email address.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'No StudySpace account exists for this Google email. Please sign up first.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.is_deleted:
            return Response(
                {'error': 'This account has been deleted.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified'])

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Google login successful.',
            'user': UserSerializer(user).data,
            'tokens': tokens,
        })

class MicrosoftLoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        microsoft_id_token = request.data.get('id_token')

        if not settings.MICROSOFT_CLIENT_ID:
            return Response({'error': 'Microsoft login is not configured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not microsoft_id_token:
            return Response({'error': 'Missing Microsoft credential.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = _verify_microsoft_id_token(microsoft_id_token)
        except InvalidTokenError:
            return Response({'error': 'Invalid Microsoft login token.'}, status=status.HTTP_400_BAD_REQUEST)

        email = (
            payload.get('email') or
            payload.get('preferred_username') or
            payload.get('upn') or
            ''
        ).strip().lower()

        if not email:
            return Response({'error': 'Microsoft did not return an email address.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'No StudySpace account exists for this Microsoft email. Please sign up first.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.is_deleted:
            return Response({'error': 'This account has been deleted.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified'])

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Microsoft login successful.',
            'user': UserSerializer(user).data,
            'tokens': tokens,
        })


class MeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        data = UserSerializer(user).data

        if user.role == User.Role.STUDENT:
            try:
                profile = user.student_profile
                data['student_profile'] = StudentProfileSerializer(profile).data
            except StudentProfile.DoesNotExist:
                pass
        elif user.role == User.Role.TUTOR:
            try:
                profile = user.tutor_profile
                data['tutor_profile'] = TutorProfileSerializer(profile).data
            except TutorProfile.DoesNotExist:
                pass

        return Response(data)


class TutorSearchView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = TutorCardSerializer
    filterset_fields = ['verification_status']
    search_fields = ['user__display_name', 'subjects', 'bio', 'location_city']
    ordering_fields = ['hourly_rate', 'average_rating', 'total_sessions']

    def get_queryset(self):
        qs = TutorProfile.objects.filter(
            verification_status=TutorProfile.VerificationStatus.APPROVED
        ).select_related('user')

        subject = self.request.query_params.get('subject')
        if subject:
            qs = qs.filter(subjects__contains=[subject])

        # New: optional location filter — case-insensitive city match.
        location = self.request.query_params.get('location')
        if location:
            qs = qs.filter(location_city__icontains=location)

        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        if min_price:
            qs = qs.filter(hourly_rate__gte=min_price)
        if max_price:
            qs = qs.filter(hourly_rate__lte=max_price)

        min_rating = self.request.query_params.get('min_rating')
        if min_rating:
            qs = qs.filter(average_rating__gte=min_rating)

        return qs


class TutorDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = TutorProfileSerializer
    queryset = TutorProfile.objects.select_related('user')
    lookup_field = 'user__id'
    lookup_url_kwarg = 'user_id'


class NotificationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationMarkReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notif = Notification.objects.get(id=pk, user=request.user)
            notif.is_read = True
            notif.save()
            return Response({'message': 'Marked as read.'})
        except Notification.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


class CheckUsernameView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CheckUsernameSerializer(data=request.data)
        if serializer.is_valid():
            return Response({'available': True})
        return Response({'available': False, 'errors': serializer.errors})
