"""
Replacement for RegisterTutorStep5View.

The previous version accepted exactly three specific files:
    - photo_id
    - qualifications_doc
    - dbs_certificate

The new version accepts up to 5 arbitrary documents uploaded via multipart/form-data
with keys:
    - document_count: total number (1-5)
    - document_0, document_1, ...: the files
    - document_0_type, document_1_type, ...: one of 'photo_id', 'qualification',
      'dbs', 'other'

Tutors must upload at least one document before their profile enters the admin
verification queue. Use VerificationDocument rows so the admin side can list
everything cleanly.
"""


from django.db import transaction
from rest_framework import permissions, status, views
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, TutorProfile, VerificationDocument
from .serializers import UserSerializer
from .registration_services import (
    PendingRegistrationError,
    create_user_from_pending,
    display_name_is_reserved_for_pending,
    get_verified_pending_registration,
    pending_has_personal_details,
)
from messaging.services import create_welcome_conversation_for_user




def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class RegisterTutorStep5View(views.APIView):
    """Tutor registration final step - upload verification documents."""
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    MAX_DOCUMENTS = 5
    MAX_SIZE_MB = 10
    ALLOWED_TYPES = {'photo_id', 'qualification', 'dbs', 'other'}
    ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}

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

        if pending.hourly_rate is None or pending.experience_years is None or not pending.location_city:
            return Response(
                {'error': 'Please complete your tutor rate, experience, and location first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            count = int(request.data.get('document_count', 0))
        except (TypeError, ValueError):
            return Response({'error': 'document_count must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        if count < 1:
            return Response(
                {'error': 'Please upload at least one verification document.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if count > self.MAX_DOCUMENTS:
            return Response(
                {'error': f'Maximum {self.MAX_DOCUMENTS} documents allowed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded = []
        for i in range(count):
            f = request.FILES.get(f'document_{i}')
            doc_type = (request.data.get(f'document_{i}_type') or 'other').strip()

            if not f:
                return Response({'error': f'Missing file at index {i}.'}, status=status.HTTP_400_BAD_REQUEST)

            if f.size > self.MAX_SIZE_MB * 1024 * 1024:
                return Response(
                    {'error': f'{f.name} exceeds the {self.MAX_SIZE_MB}MB limit.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            ext = '.' + f.name.rsplit('.', 1)[-1].lower() if '.' in f.name else ''
            if ext not in self.ALLOWED_EXTENSIONS:
                return Response(
                    {'error': f'{f.name} is not a supported format. Use PDF, JPG, or PNG.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if doc_type not in self.ALLOWED_TYPES:
                doc_type = 'other'

            uploaded.append((f, doc_type))

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

            profile = TutorProfile.objects.create(
                user=user,
                subjects=pending.subjects,
                hourly_rate=pending.hourly_rate,
                experience_years=pending.experience_years,
                company_email=pending.company_email,
                personal_statement=pending.personal_statement,
                location_city=pending.location_city,
                location_postcode_area=pending.location_postcode_area,
                verification_status=TutorProfile.VerificationStatus.PENDING,
            )

            for f, doc_type in uploaded:
                VerificationDocument.objects.create(
                    tutor=profile,
                    document_type=doc_type,
                    file=f,
                )

            pending.delete()

        try:
            create_welcome_conversation_for_user(user)
        except Exception as e:
            print("WELCOME MESSAGE ERROR:", repr(e))

        return Response({
            'message': 'Registration complete. Your documents are under review.',
            'user': UserSerializer(user).data,
            'tokens': _tokens_for(user),
            'documents_uploaded': len(uploaded),
        }, status=status.HTTP_201_CREATED)

