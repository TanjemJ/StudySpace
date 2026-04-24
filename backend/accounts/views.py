from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import uuid


from .models import User, StudentProfile, TutorProfile, EmailVerificationCode, Notification
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


# --- Step 1: Create user with email + password, send verification code ---
class RegisterStep1View(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterStep1Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        temp_display_name = f"user_{uuid.uuid4().hex[:8]}"
        while User.objects.filter(display_name=temp_display_name).exists():
            temp_display_name = f"user_{uuid.uuid4().hex[:8]}"


        user = User.objects.create_user(
            email=data['email'],
            username=data['email'],  # use email as username internally
            password=data['password'],
            role=data['role'],
            display_name=temp_display_name,
            is_active=True,
            is_email_verified=False,
        )

        # Generate and "send" verification code
        code = EmailVerificationCode.generate_code()
        EmailVerificationCode.objects.create(
            user=user,
            code=code,
            purpose=EmailVerificationCode.Purpose.ACCOUNT_EMAIL,
            target_email=user.email,
        )

        try:
            send_verification_email(
                recipient_email=user.email,
                code=code,
                subject_line='StudySpace - Verify your email',
                intro_line='Use this 6-digit code to verify your email address and continue setting up your StudySpace account.',
            )

        except Exception as e:
            import traceback
            print("SENDGRID REGISTER EMAIL ERROR:", repr(e))
            traceback.print_exc()
            user.delete()
            return Response(
                {'error': 'Verification email failed to send. Check backend terminal output.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


        return Response({
            'message': 'Account created. Check your email for the verification code.',
            'user_id': str(user.id),
            'email': user.email,
            'role': user.role,
            # In dev, include the code so you can test without email
            'dev_code': code if settings.DEBUG and not getattr(settings, 'USE_SENDGRID_EMAIL', False) else None,
        }, status=status.HTTP_201_CREATED)


# --- Step 1b: Verify the email code ---
class VerifyEmailCodeView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(email=serializer.validated_data['email'])
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        verification = EmailVerificationCode.objects.filter(
            user=user,
            code=serializer.validated_data['code'],
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


# --- Resend verification code ---
class ResendCodeView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        code = EmailVerificationCode.generate_code()
        EmailVerificationCode.objects.create(
            user=user,
            code=code,
            purpose=EmailVerificationCode.Purpose.ACCOUNT_EMAIL,
            target_email=user.email,
        )

        try:
            send_verification_email(
                recipient_email=user.email,
                code=code,
                subject_line='StudySpace - New verification code',
                intro_line='Here is your new 6-digit StudySpace verification code.',
            )

        except Exception as e:
            import traceback
            print("SENDGRID RESEND EMAIL ERROR:", repr(e))
            traceback.print_exc()
            return Response(
                {'error': 'Verification email failed to send. Check backend terminal output.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        
        return Response({
            'message': 'New code sent.',
            'dev_code': code if settings.DEBUG and not getattr(settings, 'USE_SENDGRID_EMAIL', False) else None,
        })


# --- Step 2: Personal info ---
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


# --- Step 3: Student university info ---
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
        profile.university = data.get('university', '')
        profile.university_email = data.get('university_email', '')
        profile.course = data.get('course', '')
        profile.year_of_study = data.get('year_of_study')
        profile.save()

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Registration complete!',
            'user': UserSerializer(user).data,
            'tokens': tokens,
        })


# --- Tutor Step 3: Company email + subjects ---
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


# --- Tutor Step 4: Rate, experience, statement ---
class RegisterTutorStep4View(views.APIView):
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
        profile.save()

        return Response({'message': 'Rate and experience saved.', 'user_id': str(profile.user_id)})


# --- Tutor Step 5: Document upload + finish ---
class RegisterTutorStep5View(views.APIView):
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


# --- Login ---
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
            return Response({'error': 'Invalid email or password.'}, status=status.HTTP_401_UNAUTHORIZED)

        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': tokens,
        })


# --- Current user profile ---
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


# --- Tutor search (public) ---
class TutorSearchView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = TutorCardSerializer
    filterset_fields = ['verification_status']
    search_fields = ['user__display_name', 'subjects', 'bio']
    ordering_fields = ['hourly_rate', 'average_rating', 'total_sessions']

    def get_queryset(self):
        qs = TutorProfile.objects.filter(
            verification_status=TutorProfile.VerificationStatus.APPROVED
        ).select_related('user')

        subject = self.request.query_params.get('subject')
        if subject:
            qs = qs.filter(subjects__contains=[subject])

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


# --- Tutor detail (public) ---
class TutorDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = TutorProfileSerializer
    queryset = TutorProfile.objects.select_related('user')
    lookup_field = 'user__id'
    lookup_url_kwarg = 'user_id'


# --- Notifications ---
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


# --- Check username availability ---
class CheckUsernameView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CheckUsernameSerializer(data=request.data)
        if serializer.is_valid():
            return Response({'available': True})
        return Response({'available': False, 'errors': serializer.errors})
