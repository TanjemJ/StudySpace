"""
Admin-only API endpoints.

Powers the new Admin Dashboard's Verification Queue and Forum Moderation tabs.

Endpoints:
    GET  /api/auth/admin/verification-queue/
    POST /api/auth/admin/verification/<tutor_id>/<action>/    (approve | request_info | reject)
    DELETE /api/forum/admin/posts/<post_id>/delete/
    DELETE /api/forum/admin/replies/<reply_id>/delete/
"""
from rest_framework import permissions, views
from rest_framework.response import Response

from .models import User, TutorProfile, Notification


def _require_admin(request):
    """Return a 403 Response if the caller is not an admin, else None."""
    if not request.user.is_authenticated or request.user.role != 'admin':
        return Response({'error': 'Admin only.'}, status=403)
    return None


class AdminVerificationQueueView(views.APIView):
    """List all tutor profiles that need verification action."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied

        # Include VerificationDocument rows if that model exists;
        # otherwise fall back to the three legacy file fields.
        try:
            from .models import VerificationDocument
            has_doc_model = True
        except ImportError:
            has_doc_model = False

        profiles = TutorProfile.objects.filter(
            verification_status__in=['pending', 'under_review', 'info_requested'],
        ).select_related('user').order_by('user__created_at')

        data = []
        for p in profiles:
            documents = []

            if has_doc_model:
                for d in VerificationDocument.objects.filter(tutor=p):
                    documents.append({
                        'id': str(d.id),
                        'type': d.document_type,
                        'file_url': request.build_absolute_uri(d.file.url) if d.file else None,
                        'uploaded_at': d.uploaded_at.isoformat() if d.uploaded_at else None,
                    })

            # Legacy single-file fields (backwards compatibility)
            for field_name, doc_type in [
                ('photo_id', 'photo_id'),
                ('qualifications_doc', 'qualification'),
                ('dbs_certificate', 'dbs'),
            ]:
                f = getattr(p, field_name, None)
                if f:
                    documents.append({
                        'id': f'legacy-{field_name}',
                        'type': doc_type,
                        'file_url': request.build_absolute_uri(f.url),
                        'uploaded_at': None,
                    })

            data.append({
                'id': str(p.user.id),
                'display_name': p.user.display_name,
                'first_name': p.user.first_name,
                'last_name': p.user.last_name,
                'email': p.user.email,
                'subjects': p.subjects,
                'hourly_rate': str(p.hourly_rate),
                'experience_years': p.experience_years,
                'bio': p.bio,
                'personal_statement': p.personal_statement,
                'verification_status': p.verification_status,
                'rejection_reason': p.rejection_reason,
                'submitted_at': p.user.created_at.isoformat() if p.user.created_at else None,
                'documents': documents,
            })
        return Response(data)


class AdminVerificationActionView(views.APIView):
    """Approve, reject, or request more info for a tutor verification."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, tutor_id, action):
        denied = _require_admin(request)
        if denied:
            return denied

        try:
            profile = TutorProfile.objects.get(user_id=tutor_id)
        except TutorProfile.DoesNotExist:
            return Response({'error': 'Tutor not found.'}, status=404)

        message = request.data.get('message', '').strip()
        reason = request.data.get('reason', '').strip()

        if action == 'approve':
            profile.verification_status = 'approved'
            profile.rejection_reason = ''
            profile.save()
            Notification.objects.create(
                user=profile.user,
                notification_type='verification_approved',
                title='Your tutor profile has been approved!',
                message='You can now receive booking requests from students.',
                link='/tutor-dashboard',
            )

        elif action == 'request_info':
            if not message:
                return Response({'error': 'A message is required when requesting more info.'}, status=400)
            profile.verification_status = 'info_requested'
            profile.rejection_reason = message  # reuse field to carry the message
            profile.save()
            Notification.objects.create(
                user=profile.user,
                notification_type='verification_info_requested',
                title='Additional information needed',
                message=f'An admin has requested more information: {message}',
                link='/tutor-dashboard',
            )

        elif action == 'reject':
            if not reason:
                return Response({'error': 'A reason is required when rejecting.'}, status=400)
            profile.verification_status = 'rejected'
            profile.rejection_reason = reason
            profile.save()
            Notification.objects.create(
                user=profile.user,
                notification_type='verification_rejected',
                title='Verification application rejected',
                message=f'Reason: {reason}. Please contact support if you wish to appeal.',
                link='/tutor-dashboard',
            )

        else:
            return Response({'error': 'Unknown action.'}, status=400)

        return Response({
            'message': f'Action "{action}" completed.',
            'verification_status': profile.verification_status,
        })
