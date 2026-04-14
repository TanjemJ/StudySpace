"""Extra notification views — mark all read and unread count."""
from rest_framework import status, permissions, views
from rest_framework.response import Response
from .models import Notification


class MarkAllNotificationsReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read.'})


class UnreadCountView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})
