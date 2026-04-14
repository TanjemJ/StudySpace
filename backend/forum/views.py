from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from django.db.models import Q
from .models import ForumCategory, ForumPost, ForumReply, PostVote
from .serializers import ForumCategorySerializer, ForumPostSerializer, ForumReplySerializer

FLAGGED_KEYWORDS = ['hate', 'kill', 'threat', 'abuse', 'harass', 'racist', 'sexist']


def _get_user_university(user):
    """Return the user's university — works for BOTH students AND tutors."""
    if not user or not user.is_authenticated:
        return ''
    # Check student profile first
    try:
        uni = user.student_profile.university
        if uni:
            return uni
    except Exception:
        pass
    # Check tutor profile
    try:
        uni = user.tutor_profile.university
        if uni:
            return uni
    except Exception:
        pass
    return ''


def _user_university_verified(user):
    """Check if user has verified their university — works for BOTH roles."""
    if not user or not user.is_authenticated:
        return False
    try:
        if user.student_profile.university_verified:
            return True
    except Exception:
        pass
    try:
        if user.tutor_profile.university_verified:
            return True
    except Exception:
        pass
    return False


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
        # Exclude soft-deleted users' non-anonymous posts from showing their name
        # (they still appear but author shows as deleted)

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


class PostCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        category_id = data.get('category_id')
        title = data.get('title', '')
        content = data.get('content', '')

        if not category_id or not title or not content:
            return Response({'error': 'category_id, title, and content are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            category = ForumCategory.objects.get(id=category_id)
        except ForumCategory.DoesNotExist:
            return Response({'error': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check university access for both students AND tutors
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

        return Response(ForumPostSerializer(post).data, status=status.HTTP_201_CREATED)


class ReplyListCreateView(generics.ListCreateAPIView):
    serializer_class = ForumReplySerializer

    def get_queryset(self):
        return ForumReply.objects.filter(post_id=self.kwargs['post_id'], is_flagged=False).select_related('author')

    def perform_create(self, serializer):
        from accounts.models import Notification
        post = ForumPost.objects.get(id=self.kwargs['post_id'])
        reply = serializer.save(author=self.request.user, post=post)
        post.reply_count = post.replies.filter(is_flagged=False).count()
        post.save()

        # Send notification to post author (if not replying to own post)
        if post.author != self.request.user:
            author_name = 'Someone' if reply.is_anonymous else self.request.user.display_name
            Notification.objects.create(
                user=post.author,
                notification_type='forum_reply',
                title='New reply to your post',
                message=f'{author_name} replied to "{post.title}"',
                link=f'/forum/post/{post.id}',
            )


class VoteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        vt = request.data.get('vote_type')
        if vt not in ('up', 'down'):
            return Response({'error': 'vote_type must be "up" or "down".'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            post = ForumPost.objects.get(id=post_id)
        except ForumPost.DoesNotExist:
            return Response({'error': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        existing = PostVote.objects.filter(user=request.user, post=post).first()
        if existing:
            if existing.vote_type == vt:
                existing.delete()
                if vt == 'up': post.upvotes = max(0, post.upvotes - 1)
                else: post.downvotes = max(0, post.downvotes - 1)
            else:
                if existing.vote_type == 'up': post.upvotes = max(0, post.upvotes - 1)
                else: post.downvotes = max(0, post.downvotes - 1)
                existing.vote_type = vt
                existing.save()
                if vt == 'up': post.upvotes += 1
                else: post.downvotes += 1
        else:
            PostVote.objects.create(user=request.user, post=post, vote_type=vt)
            if vt == 'up': post.upvotes += 1
            else: post.downvotes += 1

        post.save()
        return Response({'upvotes': post.upvotes, 'downvotes': post.downvotes})


class ReportPostView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        try:
            post = ForumPost.objects.get(id=post_id)
            post.is_flagged = True
            post.flag_reason = request.data.get('reason', 'Reported by user')
            post.save()
            return Response({'message': 'Post reported. Thank you for helping keep the community safe.'})
        except ForumPost.DoesNotExist:
            return Response({'error': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)


class ForumStatsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'total_posts': ForumPost.objects.filter(is_flagged=False).count(),
            'total_replies': ForumReply.objects.filter(is_flagged=False).count(),
            'total_categories': ForumCategory.objects.count(),
        })
