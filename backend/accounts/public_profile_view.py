"""Public user profile endpoint — viewable by anyone."""
from rest_framework import permissions, views
from rest_framework.response import Response
from rest_framework import status
from .models import User
from .serializers import UserSerializer, StudentProfileSerializer, TutorProfileSerializer
from .media_urls import safe_file_url


class PublicProfileView(views.APIView):
    """Returns public profile info for any user."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.', 'deleted': False},
                            status=status.HTTP_404_NOT_FOUND)

        if user.is_deleted:
            return Response({
                'deleted': True,
                'display_name': '[Deleted User]',
                'message': 'This user has deleted their account.'
            })

        data = {
            'id': str(user.id),
            'display_name': user.display_name,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'avatar': safe_file_url(user.avatar),
            'created_at': user.created_at.isoformat(),
            'deleted': False,
        }

        # Include role-specific public info
        if user.role == 'student':
            try:
                profile = user.student_profile
                data['student_info'] = {
                    'university': profile.university,
                    'university_verified': profile.university_verified,
                    'course': profile.course,
                    'year_of_study': profile.year_of_study,
                }
            except Exception:
                pass
        elif user.role == 'tutor':
            try:
                profile = user.tutor_profile
                data['tutor_info'] = {
                    'bio': profile.bio,
                    'subjects': profile.subjects,
                    'hourly_rate': str(profile.hourly_rate),
                    'experience_years': profile.experience_years,
                    'average_rating': profile.average_rating,
                    'total_reviews': profile.total_reviews,
                    'total_sessions': profile.total_sessions,
                    'verification_status': profile.verification_status,
                    'university': profile.university,
                    'university_verified': profile.university_verified,
                }
            except Exception:
                pass

        # Count forum activity
        from forum.models import ForumPost, ForumReply
        data['forum_stats'] = {
            'posts_count': ForumPost.objects.filter(author=user, is_flagged=False, is_anonymous=False).count(),
            'replies_count': ForumReply.objects.filter(author=user, is_flagged=False, is_anonymous=False).count(),
        }

        return Response(data)
