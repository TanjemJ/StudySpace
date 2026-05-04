"""
Dashboard stats endpoints.

Provides real-time stat counts for the Student, Tutor, and Admin dashboards.
Previously these values were hardcoded in the frontend (e.g. `value: '—'`,
`value: 2`), so they never updated after the user performed actions.

Endpoints:
    GET /api/auth/dashboard-stats/student/  — student dashboard counters
    GET /api/auth/dashboard-stats/tutor/    — tutor dashboard counters
    GET /api/auth/dashboard-stats/admin/    — admin dashboard counters
"""
from datetime import date
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import permissions, views
from rest_framework.response import Response

from .models import User, TutorProfile, Notification


class StudentDashboardStatsView(views.APIView):
    """Counts shown on the Student dashboard stat cards."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'student':
            return Response({'error': 'Students only.'}, status=403)

        from tutoring.models import Booking
        from forum.models import ForumPost, ForumReply
        from ai_assistant.models import AIConversation

        today = date.today()

        active_student_statuses = [
            Booking.Status.PENDING_PAYMENT,
            Booking.Status.PENDING,
            Booking.Status.CONFIRMED,
            Booking.Status.CHANGE_REQUESTED,
        ]

        upcoming = Booking.objects.filter(
            student=user,
            status__in=active_student_statuses,
            slot__date__gte=today,
        ).count()

        # "Forum activity" counts both posts and replies by this student
        # (excluding deleted/flagged).
        forum_posts = ForumPost.objects.filter(
            author=user, is_flagged=False,
        ).count()
        forum_replies = ForumReply.objects.filter(
            author=user, is_flagged=False,
        ).count()

        ai_chats = AIConversation.objects.filter(user=user).count()

        hours_tutored = Booking.objects.filter(
            student=user, status='completed',
        ).count()

        return Response({
            'upcoming_sessions': upcoming,
            'forum_posts': forum_posts,
            'forum_replies': forum_replies,
            'ai_chats': ai_chats,
            'hours_tutored': hours_tutored,
        })


class TutorDashboardStatsView(views.APIView):
    """Counts shown on the Tutor dashboard stat cards."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'tutor' or not hasattr(user, 'tutor_profile'):
            return Response({'error': 'Tutors only.'}, status=403)

        from tutoring.models import Booking

        tutor_profile = user.tutor_profile
        today = date.today()
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        pending = Booking.objects.filter(
            tutor=tutor_profile, status='pending',
        ).count()

        upcoming = Booking.objects.filter(
            tutor=tutor_profile, status='confirmed', slot__date__gte=today,
        ).count()

        earnings_month = Booking.objects.filter(
            tutor=tutor_profile, status='completed',
            created_at__gte=month_start,
        ).aggregate(total=Sum('price'))['total'] or 0

        total_students = Booking.objects.filter(
            tutor=tutor_profile, status='completed',
        ).values('student').distinct().count()

        return Response({
            'pending_requests': pending,
            'upcoming_sessions': upcoming,
            'earnings_this_month': float(earnings_month),
            'total_students': total_students,
            'average_rating': tutor_profile.average_rating,
            'total_reviews': tutor_profile.total_reviews,
            'total_sessions': tutor_profile.total_sessions,
        })


class AdminDashboardStatsView(views.APIView):
    """Counts shown on the Admin dashboard stat cards."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Admin only.'}, status=403)

        from tutoring.models import Booking, PaymentRecord
        from forum.models import ForumPost

        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        pending_verifications = TutorProfile.objects.filter(
            verification_status__in=['pending', 'under_review', 'info_requested'],
        ).count()

        fp_qs = ForumPost.objects.filter(is_flagged=True)
        if 'is_deleted' in [f.name for f in ForumPost._meta.get_fields()]:
            fp_qs = fp_qs.filter(is_deleted=False)
        flagged_posts = fp_qs.count()

        active_reports = 0
        try:
            from forum.models import Report
            if 'status' in [f.name for f in Report._meta.get_fields()]:
                active_reports = Report.objects.filter(status='pending').count()
            else:
                active_reports = Report.objects.count()
        except ImportError:
            pass

        total_users = User.objects.filter(is_deleted=False).count()
        total_students = User.objects.filter(role='student', is_deleted=False).count()
        total_tutors = User.objects.filter(role='tutor', is_deleted=False).count()

        revenue_month = PaymentRecord.objects.filter(
            status='completed', created_at__gte=month_start,
        ).aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'pending_verifications': pending_verifications,
            'flagged_posts': flagged_posts,
            'active_reports': active_reports,
            'total_users': total_users,
            'total_students': total_students,
            'total_tutors': total_tutors,
            'revenue_this_month': float(revenue_month),
        })

