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

Drop this view into backend/accounts/views.py (replacing the old one) OR
import it from here into views.py.
"""
from rest_framework import permissions, status, views
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken

from .models import TutorProfile, VerificationDocument
from .serializers import UserSerializer


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class RegisterTutorStep5View(views.APIView):
    """Tutor registration final step — upload verification documents.

    Accepts up to 5 documents. Each is stored as a VerificationDocument row.
    After upload the tutor profile is flagged as PENDING review in the admin
    queue.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    MAX_DOCUMENTS = 5
    MAX_SIZE_MB = 10
    ALLOWED_TYPES = {'photo_id', 'qualification', 'dbs', 'other'}
    ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}

    def post(self, request):
        
        try:
            profile = request.user.tutor_profile
        except TutorProfile.DoesNotExist:
            return Response({'error': 'Tutor profile not found.'}, status=status.HTTP_404_NOT_FOUND)


        try:
            count = int(request.data.get('document_count', 0))
        except (TypeError, ValueError):
            return Response({'error': 'document_count must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        if count < 1:
            return Response({'error': 'Please upload at least one verification document.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if count > self.MAX_DOCUMENTS:
            return Response({'error': f'Maximum {self.MAX_DOCUMENTS} documents allowed.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Validate all files BEFORE saving any — atomic behaviour.
        uploaded = []
        for i in range(count):
            f = request.FILES.get(f'document_{i}')
            doc_type = (request.data.get(f'document_{i}_type') or 'other').strip()

            if not f:
                return Response({'error': f'Missing file at index {i}.'},
                                status=status.HTTP_400_BAD_REQUEST)

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

        # All validation passed — persist.
        for f, doc_type in uploaded:
            VerificationDocument.objects.create(
                tutor=profile,
                document_type=doc_type,
                file=f,
            )

        profile.verification_status = TutorProfile.VerificationStatus.PENDING
        profile.save()

        return Response({
            'message': 'Registration complete. Your documents are under review.',
            'user': UserSerializer(profile.user).data,
            'tokens': _tokens_for(profile.user),
            'documents_uploaded': len(uploaded),
        }, status=status.HTTP_201_CREATED)
