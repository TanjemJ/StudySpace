"""
Admin forum moderation views.

Lets admins soft-delete forum posts and replies with a reason. The author
receives a notification explaining why their content was removed.

Endpoints:
    DELETE /api/forum/admin/posts/<post_id>/delete/
    DELETE /api/forum/admin/replies/<reply_id>/delete/
    GET    /api/forum/admin/flagged/             — list flagged posts/replies
"""
from rest_framework import permissions, status, views
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import ForumPost, ForumReply, Report
from accounts.models import Notification


def _require_admin(request):
    if not request.user.is_authenticated or request.user.role != 'admin':
        return Response({'error': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
    return None


class AdminDeletePostView(views.APIView):
    """Soft-delete a forum post and notify the author."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        denied = _require_admin(request)
        if denied:
            return denied

        post = get_object_or_404(ForumPost, id=pk)
        reason = (request.data.get('reason') or '').strip() or 'violated community guidelines'

        # Prefer soft-delete if the model supports it; fall back to flagging.
        if hasattr(post, 'is_deleted'):
            post.is_deleted = True
            post.deleted_by = request.user
            post.deletion_reason = reason
        else:
            post.is_flagged = True
            if hasattr(post, 'flag_reason'):
                post.flag_reason = f'Removed by admin: {reason}'
        post.save()

        # Update category post count
        cat = post.category
        cat.post_count = ForumPost.objects.filter(
            category=cat, is_flagged=False,
        ).count()
        cat.save()

        # Notify author (unless anonymous — still notify, they can find it)
        Notification.objects.create(
            user=post.author,
            notification_type='forum_reply',  # reuse existing choice
            title='Your post was removed by a moderator',
            message=f'"{post.title[:60]}" was removed. Reason: {reason}',
            link='/forum',
        )

        return Response({'message': 'Post deleted. Author notified.'})


class AdminDeleteReplyView(views.APIView):
    """Soft-delete a forum reply and notify the author."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        denied = _require_admin(request)
        if denied:
            return denied

        reply = get_object_or_404(ForumReply, id=pk)
        reason = (request.data.get('reason') or '').strip() or 'violated community guidelines'

        if hasattr(reply, 'is_deleted'):
            reply.is_deleted = True
            reply.deleted_by = request.user
            reply.deletion_reason = reason
        else:
            reply.is_flagged = True
        reply.save()

        # Decrement parent post's reply count
        post = reply.post
        post.reply_count = ForumReply.objects.filter(
            post=post, is_flagged=False,
        ).count()
        post.save()

        Notification.objects.create(
            user=reply.author,
            notification_type='forum_reply',
            title='Your comment was removed by a moderator',
            message=f'A comment you made was removed. Reason: {reason}',
            link=f'/forum/post/{post.id}',
        )

        return Response({'message': 'Reply deleted. Author notified.'})


class AdminFlaggedContentView(views.APIView):
    """List all flagged posts + replies for admin review."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied

        posts = ForumPost.objects.filter(is_flagged=True).order_by('-created_at')[:50]
        replies = ForumReply.objects.filter(is_flagged=True).order_by('-created_at')[:50]

        post_data = [{
            'id': str(p.id),
            'type': 'post',
            'title': p.title,
            'content_preview': p.content[:200],
            'author_name': '[Anonymous]' if p.is_anonymous else p.author.display_name,
            'category': p.category.name if p.category else '',
            'flag_reason': getattr(p, 'flag_reason', ''),
            'created_at': p.created_at.isoformat(),
            'is_deleted': getattr(p, 'is_deleted', False),
        } for p in posts]

        reply_data = [{
            'id': str(r.id),
            'type': 'reply',
            'post_id': str(r.post.id),
            'post_title': r.post.title,
            'content_preview': r.content[:200],
            'author_name': r.author.display_name,
            'created_at': r.created_at.isoformat(),
            'is_deleted': getattr(r, 'is_deleted', False),
        } for r in replies]

        return Response({
            'flagged_posts': post_data,
            'flagged_replies': reply_data,
            'total': len(post_data) + len(reply_data),
        })
