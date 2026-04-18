from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from django.db.models import Q, Prefetch
from django.utils import timezone
from .models import ForumCategory, ForumPost, ForumReply, PostVote, Report
from .serializers import ForumCategorySerializer, ForumPostSerializer, ForumReplySerializer, ReportSerializer

FLAGGED_KEYWORDS = ['hate', 'kill', 'threat', 'abuse', 'harass', 'racist', 'sexist']


def _get_user_university(user):
    if not user or not user.is_authenticated:
        return ''
    try:
        uni = user.student_profile.university
        if uni:
            return uni
    except Exception:
        pass
    try:
        uni = user.tutor_profile.university
        if uni:
            return uni
    except Exception:
        pass
    return ''


class CategoryListView(generics.ListAPIView):
    serializer_class = ForumCategorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = ForumCategory.objects.all()
        user = self.request.user
        university = self.request.query_params.get('university', None)
        if university:
            qs = qs.filter(Q(university='') | Q(university=university))
        else:
            if user.is_authenticated:
                user_uni = _get_user_university(user)
                if user_uni:
                    qs = qs.filter(Q(university='') | Q(university=user_uni))
                else:
                    qs = qs.filter(university='')
            else:
                qs = qs.filter(university='')
        return qs


class UniversityListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        universities = (
            ForumCategory.objects.exclude(university='')
            .values_list('university', flat=True).distinct().order_by('university')
        )
        return Response({'universities': list(universities)})


class PostListView(generics.ListAPIView):
    serializer_class = ForumPostSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = ForumPost.objects.filter(is_flagged=False).select_related('author', 'category')

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category_id=category)

        university = self.request.query_params.get('university')
        if university:
            if university == 'all':
                pass
            elif university == 'global':
                qs = qs.filter(university='')
            else:
                qs = qs.filter(university=university)
        else:
            user = self.request.user
            if user.is_authenticated:
                user_uni = _get_user_university(user)
                if user_uni:
                    qs = qs.filter(Q(university='') | Q(university=user_uni))
                else:
                    qs = qs.filter(university='')

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(content__icontains=search))

        tags = self.request.query_params.get('tags')
        if tags:
            for tag in tags.split(','):
                qs = qs.filter(tags__contains=[tag.strip()])

        sort = self.request.query_params.get('sort', 'latest')
        if sort == 'popular':
            qs = qs.order_by('-upvotes', '-reply_count', '-created_at')
        elif sort == 'unanswered':
            qs = qs.filter(reply_count=0).order_by('-created_at')
        elif sort == 'oldest':
            qs = qs.order_by('created_at')
        elif sort == 'most_discussed':
            qs = qs.order_by('-reply_count', '-created_at')
        else:
            qs = qs.order_by('-is_pinned', '-created_at')
        return qs


class PostDetailView(generics.RetrieveAPIView):
    serializer_class = ForumPostSerializer
    permission_classes = [permissions.AllowAny]
    queryset = ForumPost.objects.select_related('author', 'category')


class PostEditView(views.APIView):
    """Edit a post within 24 hours of creation."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            post = ForumPost.objects.get(id=pk)
        except ForumPost.DoesNotExist:
            return Response({'error': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        if post.author != request.user:
            return Response({'error': 'You can only edit your own posts.'}, status=status.HTTP_403_FORBIDDEN)

        if not post.is_editable:
            return Response({'error': 'Posts can only be edited within 24 hours of creation.'},
                            status=status.HTTP_403_FORBIDDEN)

        if 'title' in request.data:
            post.title = request.data['title']
        if 'content' in request.data:
            post.content = request.data['content']
        if 'tags' in request.data:
            post.tags = request.data['tags']

        post.is_edited = True
        post.edited_at = timezone.now()
        post.save()

        return Response(ForumPostSerializer(post, context={'request': request}).data)


class PostCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        category_id = data.get('category_id')
        title = data.get('title', '')
        content = data.get('content', '')

        if not category_id or not title or not content:
            return Response({'error': 'category_id, title, and content are required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            category = ForumCategory.objects.get(id=category_id)
        except ForumCategory.DoesNotExist:
            return Response({'error': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        if category.is_university_only and category.university:
            user_uni = _get_user_university(request.user)
            if user_uni != category.university:
                return Response(
                    {'error': 'You must be a verified member of this university to post here.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        text = (title + ' ' + content).lower()
        is_flagged = any(kw in text for kw in FLAGGED_KEYWORDS)
        flag_reason = ''
        if is_flagged:
            matched = [kw for kw in FLAGGED_KEYWORDS if kw in text]
            flag_reason = f'Auto-flagged: keywords "{", ".join(matched)}"'

        user_university = _get_user_university(request.user)

        post = ForumPost.objects.create(
            author=request.user, category=category,
            title=title, content=content,
            university=category.university or user_university,
            is_anonymous=data.get('is_anonymous', False),
            tags=data.get('tags', []) if isinstance(data.get('tags', []), list) else [],
            is_flagged=is_flagged, flag_reason=flag_reason,
        )

        category.post_count = ForumPost.objects.filter(category=category, is_flagged=False).count()
        category.save()

        return Response(ForumPostSerializer(post, context={'request': request}).data,
                        status=status.HTTP_201_CREATED)


class ReplyListCreateView(generics.ListCreateAPIView):
    """List replies for a post (only top-level; children are nested in response)."""
    serializer_class = ForumReplySerializer

    def get_serializer_context(self):
        return {'request': self.request}

    def get_queryset(self):
        # Only return top-level replies; children are nested inside
        return ForumReply.objects.filter(
            post_id=self.kwargs['post_id'],
            parent=None,
            is_flagged=False
        ).select_related('author').prefetch_related('children__author')

    def perform_create(self, serializer):
        from accounts.models import Notification
        post = ForumPost.objects.get(id=self.kwargs['post_id'])
        parent_id = self.request.data.get('parent_id')
        parent = None
        if parent_id:
            try:
                parent = ForumReply.objects.get(id=parent_id, post=post)
                # Prevent deep nesting — if parent already has a parent, attach to same parent
                if parent.parent is not None:
                    parent = parent.parent
            except ForumReply.DoesNotExist:
                pass

        reply = serializer.save(author=self.request.user, post=post, parent=parent)

        post.reply_count = ForumReply.objects.filter(post=post, is_flagged=False).count()
        post.save()

        # Notify original author (post or parent reply)
        notify_target = parent.author if parent else post.author
        if notify_target != self.request.user:
            author_name = 'Someone' if reply.is_anonymous else self.request.user.display_name
            if parent:
                title = 'New reply to your comment'
                message = f'{author_name} replied to your comment on "{post.title}"'
            else:
                title = 'New reply to your post'
                message = f'{author_name} replied to "{post.title}"'
            Notification.objects.create(
                user=notify_target,
                notification_type='forum_reply',
                title=title,
                message=message,
                link=f'/forum/post/{post.id}',
            )


class ReplyEditView(views.APIView):
    """Edit a reply within 24 hours of creation."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            reply = ForumReply.objects.get(id=pk)
        except ForumReply.DoesNotExist:
            return Response({'error': 'Reply not found.'}, status=status.HTTP_404_NOT_FOUND)

        if reply.author != request.user:
            return Response({'error': 'You can only edit your own replies.'},
                            status=status.HTTP_403_FORBIDDEN)

        if not reply.is_editable:
            return Response({'error': 'Replies can only be edited within 24 hours.'},
                            status=status.HTTP_403_FORBIDDEN)

        if 'content' in request.data:
            reply.content = request.data['content']

        reply.is_edited = True
        reply.edited_at = timezone.now()
        reply.save()

        return Response(ForumReplySerializer(reply, context={'request': request}).data)


class PostVoteView(views.APIView):
    """Vote on a post."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        vt = request.data.get('vote_type')
        if vt not in ('up', 'down'):
            return Response({'error': 'vote_type must be "up" or "down".'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            post = ForumPost.objects.get(id=post_id)
        except ForumPost.DoesNotExist:
            return Response({'error': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        existing = PostVote.objects.filter(user=request.user, post=post).first()
        user_vote = None
        if existing:
            if existing.vote_type == vt:
                existing.delete()
                if vt == 'up': post.upvotes = max(0, post.upvotes - 1)
                else: post.downvotes = max(0, post.downvotes - 1)
                user_vote = None
            else:
                if existing.vote_type == 'up': post.upvotes = max(0, post.upvotes - 1)
                else: post.downvotes = max(0, post.downvotes - 1)
                existing.vote_type = vt
                existing.save()
                if vt == 'up': post.upvotes += 1
                else: post.downvotes += 1
                user_vote = vt
        else:
            PostVote.objects.create(user=request.user, post=post, vote_type=vt)
            if vt == 'up': post.upvotes += 1
            else: post.downvotes += 1
            user_vote = vt
        post.save()
        return Response({'upvotes': post.upvotes, 'downvotes': post.downvotes, 'user_vote': user_vote})


class ReplyVoteView(views.APIView):
    """Vote on a reply."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, reply_id):
        vt = request.data.get('vote_type')
        if vt not in ('up', 'down'):
            return Response({'error': 'vote_type must be "up" or "down".'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            reply = ForumReply.objects.get(id=reply_id)
        except ForumReply.DoesNotExist:
            return Response({'error': 'Reply not found.'}, status=status.HTTP_404_NOT_FOUND)

        existing = PostVote.objects.filter(user=request.user, reply=reply).first()
        user_vote = None
        if existing:
            if existing.vote_type == vt:
                existing.delete()
                if vt == 'up': reply.upvotes = max(0, reply.upvotes - 1)
                else: reply.downvotes = max(0, reply.downvotes - 1)
                user_vote = None
            else:
                if existing.vote_type == 'up': reply.upvotes = max(0, reply.upvotes - 1)
                else: reply.downvotes = max(0, reply.downvotes - 1)
                existing.vote_type = vt
                existing.save()
                if vt == 'up': reply.upvotes += 1
                else: reply.downvotes += 1
                user_vote = vt
        else:
            PostVote.objects.create(user=request.user, reply=reply, vote_type=vt)
            if vt == 'up': reply.upvotes += 1
            else: reply.downvotes += 1
            user_vote = vt
        reply.save()
        return Response({'upvotes': reply.upvotes, 'downvotes': reply.downvotes, 'user_vote': user_vote})


class ReportPostView(views.APIView):
    """Report a post with a reason."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            post = ForumPost.objects.get(id=post_id)
        except ForumPost.DoesNotExist:
            return Response({'error': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        Report.objects.create(
            reporter=request.user,
            post=post,
            reason=serializer.validated_data['reason'],
            details=serializer.validated_data.get('details', ''),
        )

        # Auto-flag if 3+ reports
        if Report.objects.filter(post=post, status='pending').count() >= 3:
            post.is_flagged = True
            post.flag_reason = f'Auto-flagged: 3+ user reports'
            post.save()

        return Response({'message': 'Report submitted. Our moderation team will review it.'},
                        status=status.HTTP_201_CREATED)


class ReportReplyView(views.APIView):
    """Report a reply with a reason."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, reply_id):
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reply = ForumReply.objects.get(id=reply_id)
        except ForumReply.DoesNotExist:
            return Response({'error': 'Reply not found.'}, status=status.HTTP_404_NOT_FOUND)

        Report.objects.create(
            reporter=request.user,
            reply=reply,
            reason=serializer.validated_data['reason'],
            details=serializer.validated_data.get('details', ''),
        )

        if Report.objects.filter(reply=reply, status='pending').count() >= 3:
            reply.is_flagged = True
            reply.flag_reason = f'Auto-flagged: 3+ user reports'
            reply.save()

        return Response({'message': 'Report submitted. Our moderation team will review it.'},
                        status=status.HTTP_201_CREATED)


class ForumStatsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'total_posts': ForumPost.objects.filter(is_flagged=False).count(),
            'total_replies': ForumReply.objects.filter(is_flagged=False).count(),
            'total_categories': ForumCategory.objects.count(),
        })
