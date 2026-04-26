from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
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
from urllib.request import Request, urlopen
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jwt import InvalidTokenError, PyJWKClient
import jwt



from .university_email_service import validate_university_email, university_email_is_verified_elsewhere
from .registration_services import (
    PendingRegistrationError,
    create_user_from_pending,
    display_name_is_reserved_for_pending,
    get_verified_pending_registration,
    pending_has_personal_details,
    reset_pending_registration_details,
)
from messaging.services import create_welcome_conversation_for_user
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
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

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
            reset_pending_registration_details(stale)
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
    """Verify the 6-digit code without creating the real User yet."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'verify_code'

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

        if User.objects.filter(email=email).exists():
            pending.delete()
            return Response(
                {'error': 'An account with this email already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pending.email_verified_at = timezone.now()
        pending.attempts = 0
        pending.save(update_fields=['email_verified_at', 'attempts', 'updated_at'])

        return Response({
            'message': 'Email verified successfully. Continue registration.',
            'registration_id': str(pending.id),
            'email': pending.email,
            'role': pending.role,
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

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Email verified successfully.',
            'user_id': str(user.id),
            'user': UserSerializer(user).data,
            'tokens': tokens,
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

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Email verified successfully.',
            'user_id': str(user.id),
            'user': UserSerializer(user).data,
            'tokens': tokens,
        })



class ResendCodeView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'resend_code'

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
        try:
            pending = get_verified_pending_registration(request.data.get('registration_id'))
        except PendingRegistrationError as exc:
            return Response({'error': str(exc)}, status=exc.status_code)

        serializer = RegisterStep2Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        display_name = data['display_name'].strip()

        if display_name_is_reserved_for_pending(display_name, pending):
            return Response(
                {'display_name': ['This username is already taken.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pending.first_name = data['first_name'].strip()
        pending.last_name = data['last_name'].strip()
        pending.display_name = display_name
        pending.date_of_birth = data['date_of_birth']
        pending.save(update_fields=[
            'first_name',
            'last_name',
            'display_name',
            'date_of_birth',
            'updated_at',
        ])

        return Response({
            'message': 'Personal info saved.',
            'registration_id': str(pending.id),
        })



class RegisterStep3StudentView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            pending = get_verified_pending_registration(request.data.get('registration_id'))
        except PendingRegistrationError as exc:
            return Response({'error': str(exc)}, status=exc.status_code)

        if pending.role != User.Role.STUDENT:
            return Response({'error': 'Student registration not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not pending_has_personal_details(pending):
            return Response(
                {'error': 'Please complete your personal details first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RegisterStep3StudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        provided_university = data.get('university', '')
        provided_university_email = (data.get('university_email') or '').strip().lower()

        candidate_university_email = provided_university_email or pending.email.lower()
        validation = (
            validate_university_email(candidate_university_email)
            if candidate_university_email
            else {'ok': False}
        )

        if provided_university_email and not validation['ok']:
            return Response(
                {'error': validation['error']},
                status=validation.get('status_code', status.HTTP_400_BAD_REQUEST),
            )

        if validation['ok'] and university_email_is_verified_elsewhere(candidate_university_email, None):
            return Response(
                {'error': 'This university email is already verified on another StudySpace account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if display_name_is_reserved_for_pending(pending.display_name, pending):
            return Response(
                {'display_name': ['This username is already taken.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if User.objects.filter(email=pending.email).exists():
                pending.delete()
                return Response(
                    {'error': 'An account with this email already exists.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = create_user_from_pending(pending)

            profile = StudentProfile(
                user=user,
                university=provided_university,
                course=data.get('course', ''),
                year_of_study=data.get('year_of_study'),
                university_email='',
                university_verified=False,
                university_verified_at=None,
            )

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
            pending.delete()

        try:
            create_welcome_conversation_for_user(user)
        except Exception as e:
            print("WELCOME MESSAGE ERROR:", repr(e))

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
        try:
            pending = get_verified_pending_registration(request.data.get('registration_id'))
        except PendingRegistrationError as exc:
            return Response({'error': str(exc)}, status=exc.status_code)

        if pending.role != User.Role.TUTOR:
            return Response({'error': 'Tutor registration not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RegisterTutorStep3Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        pending.company_email = data['company_email'].strip().lower()
        pending.subjects = data['subjects']
        pending.save(update_fields=['company_email', 'subjects', 'updated_at'])

        return Response({
            'message': 'Subjects and email saved.',
            'registration_id': str(pending.id),
        })



class RegisterTutorStep4View(views.APIView):
    """
    Tutor step 4 - rate, experience, personal statement, and approximate location.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            pending = get_verified_pending_registration(request.data.get('registration_id'))
        except PendingRegistrationError as exc:
            return Response({'error': str(exc)}, status=exc.status_code)

        if pending.role != User.Role.TUTOR:
            return Response({'error': 'Tutor registration not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not pending_has_personal_details(pending):
            return Response(
                {'error': 'Please complete your personal details first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not pending.company_email or not pending.subjects:
            return Response(
                {'error': 'Please complete your tutor subjects and email first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RegisterTutorStep4Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        pending.hourly_rate = data['hourly_rate']
        pending.experience_years = data['experience_years']
        pending.personal_statement = data.get('personal_statement', '')
        pending.location_city = (data.get('location_city') or '').strip()
        pending.location_postcode_area = (data.get('location_postcode_area') or '').strip().upper()
        pending.save(update_fields=[
            'hourly_rate',
            'experience_years',
            'personal_statement',
            'location_city',
            'location_postcode_area',
            'updated_at',
        ])

        return Response({
            'message': 'Rate, experience, and location saved.',
            'registration_id': str(pending.id),
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
            token_payload = json.loads(response.read().decode('utf-8'))

        userinfo_request = Request(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
        )
        with urlopen(userinfo_request, timeout=5) as response:
            user_payload = json.loads(response.read().decode('utf-8'))
    except (OSError, URLError, ValueError):
        raise ValueError('Invalid Google access token.')

    if token_payload.get('aud') != settings.GOOGLE_OAUTH_CLIENT_ID:
        raise ValueError('Google token was not issued for this app.')

    return user_payload



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

    allowed_tenants = getattr(settings, 'MICROSOFT_ALLOWED_TENANT_IDS', [])
    if allowed_tenants and tenant_id not in allowed_tenants:
        raise InvalidTokenError('Microsoft tenant is not allowed.')

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
                    clock_skew_in_seconds=10,
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
            return Response(
                {'error': 'Please verify your StudySpace email address before using social login.'},
                status=status.HTTP_403_FORBIDDEN,
            )

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
            return Response(
                {'error': 'Please verify your StudySpace email address before using social login.'},
                status=status.HTTP_403_FORBIDDEN,
            )


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
