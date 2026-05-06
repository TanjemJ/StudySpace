
from rest_framework import permissions, status, views
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import TutorProfile, VerificationDocument, Notification
from .media_urls import safe_file_url


MAX_FILE_SIZE_MB = 10
MAX_DOCS_PER_UPLOAD = 5
MAX_TOTAL_DOCS = 10
ALLOWED_TYPES = {'photo_id', 'qualification', 'dbs', 'other'}
ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}


def _resolve_tutor(request):

    if not request.user.is_authenticated:
        return None, Response(
            {'error': 'Authentication required.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if request.user.role != 'tutor':
        return None, Response(
            {'error': 'Tutor account required.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        profile = request.user.tutor_profile
    except TutorProfile.DoesNotExist:
        return None, Response(
            {'error': 'Tutor profile not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    return profile, None


def _serialize_documents(profile, request):

    documents = []

    for d in VerificationDocument.objects.filter(tutor=profile).order_by('uploaded_at'):
        documents.append({
            'id': str(d.id),
            'type': d.document_type,
            'file_url': safe_file_url(d.file, request=request, absolute=True),
            'uploaded_at': d.uploaded_at.isoformat() if d.uploaded_at else None,
        })

    # Legacy single-file fields, for early-registered tutors who pre-date
    # the VerificationDocument model.
    for field_name, doc_type in [
        ('photo_id', 'photo_id'),
        ('qualifications_doc', 'qualification'),
        ('dbs_certificate', 'dbs'),
    ]:
        f = getattr(profile, field_name, None)
        if f:
            documents.append({
                'id': f'legacy-{field_name}',
                'type': doc_type,
                'file_url': safe_file_url(f, request=request, absolute=True),
                'uploaded_at': None,
            })

    return documents


class TutorVerificationOverviewView(views.APIView):
    """
    GET /api/auth/me/verification/

    Returns the authenticated tutor's verification overview: status, latest
    admin message, rejection reason, submission/approval timestamps, and the
    documents on file. Read-only; safe to poll.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, err = _resolve_tutor(request)
        if err:
            return err

        document_count = VerificationDocument.objects.filter(tutor=profile).count()

        return Response({
            'verification_status': profile.verification_status,
            'info_request_message': profile.info_request_message or '',
            'rejection_reason': profile.rejection_reason or '',
            'submitted_at': (
                profile.verification_submitted_at.isoformat()
                if profile.verification_submitted_at else None
            ),
            'approved_at': (
                profile.verification_approved_at.isoformat()
                if profile.verification_approved_at else None
            ),
            'documents': _serialize_documents(profile, request),
            'document_count': document_count,
            'max_total_documents': MAX_TOTAL_DOCS,
            'can_upload_more': (
                profile.verification_status == TutorProfile.VerificationStatus.INFO_REQUESTED
                and document_count < MAX_TOTAL_DOCS
            ),
        })


class TutorAdditionalDocumentsView(views.APIView):
    """
    POST /api/auth/me/verification/documents/

    Multipart form-data:
        document_count          int       1..MAX_DOCS_PER_UPLOAD
        document_<i>            file      one file per index 0..count-1
        document_<i>_type       string    optional: photo_id|qualification|dbs|other

    HTTP responses:
        200  on success — body includes the new documents list
        400  on validation failure or wrong status
        401  if unauthenticated
        403  if not a tutor
        404  if no TutorProfile exists for the user
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        profile, err = _resolve_tutor(request)
        if err:
            return err

        # The hard gate. We only accept additional uploads in response to
        # an admin info request. Without this, tutors could spam documents
        # at any point in the flow.
        if profile.verification_status != TutorProfile.VerificationStatus.INFO_REQUESTED:
            return Response(
                {'error': "Additional documents can only be uploaded when an "
                          "admin has requested more information."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            count = int(request.data.get('document_count', 0))
        except (TypeError, ValueError):
            return Response(
                {'error': 'document_count must be an integer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if count < 1:
            return Response(
                {'error': 'Please attach at least one document.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if count > MAX_DOCS_PER_UPLOAD:
            return Response(
                {'error': f'Maximum {MAX_DOCS_PER_UPLOAD} documents per upload.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Total cap. Existing + new must fit under MAX_TOTAL_DOCS.
        existing_count = VerificationDocument.objects.filter(tutor=profile).count()
        if existing_count + count > MAX_TOTAL_DOCS:
            remaining = max(0, MAX_TOTAL_DOCS - existing_count)
            return Response(
                {'error': f'You already have {existing_count} documents on file. '
                          f'You can attach at most {remaining} more in total. '
                          'Contact support if you need to replace a document.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate every file BEFORE persisting any of them. Partial writes
        # would leave the tutor in a confusing state.
        validated = []
        for i in range(count):
            f = request.FILES.get(f'document_{i}')
            doc_type = (request.data.get(f'document_{i}_type') or 'other').strip()

            if not f:
                return Response(
                    {'error': f'Missing file at index {i}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if f.size > MAX_FILE_SIZE_MB * 1024 * 1024:
                return Response(
                    {'error': f'{f.name} exceeds the {MAX_FILE_SIZE_MB}MB limit.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            ext = '.' + f.name.rsplit('.', 1)[-1].lower() if '.' in f.name else ''
            if ext not in ALLOWED_EXTENSIONS:
                return Response(
                    {'error': f'{f.name} is not a supported format. '
                              'Use PDF, JPG, or PNG.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if doc_type not in ALLOWED_TYPES:
                doc_type = 'other'

            validated.append((f, doc_type))

        # Persist files.
        for f, doc_type in validated:
            VerificationDocument.objects.create(
                tutor=profile,
                document_type=doc_type,
                file=f,
            )

        # State transition: info_requested → under_review.
        # We deliberately preserve info_request_message — the admin still
        # wants to see what they originally asked for when they re-review.
        # That field is cleared by AdminVerificationActionView on approve.
        profile.verification_status = TutorProfile.VerificationStatus.UNDER_REVIEW
        profile.save(update_fields=['verification_status'])

        # Confirmation back to the tutor.
        plural = 's' if len(validated) != 1 else ''
        Notification.objects.create(
            user=request.user,
            notification_type=Notification.NotifType.VERIFICATION_UPDATE,
            title='Documents received',
            message=f'Your {len(validated)} additional document{plural} '
                    f'will be reviewed by our admin team.',
            link='/tutor-dashboard',
        )

        return Response({
            'message': 'Documents uploaded. Your application is back under review.',
            'verification_status': profile.verification_status,
            'documents_uploaded': len(validated),
            'documents': _serialize_documents(profile, request),
        }, status=status.HTTP_200_OK)
