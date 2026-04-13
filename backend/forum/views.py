from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from django.db.models import Q
from .models import ForumCategory, ForumPost, ForumReply, PostVote
from .serializers import ForumCategorySerializer, ForumPostSerializer, ForumReplySerializer

FLAGGED_KEYWORDS = ['hate', 'kill', 'threat', 'abuse', 'harass', 'racist', 'sexist']


def _get_user_university(user):
    """Return the user's university or empty string."""
    if not user or not user.is_authenticated:
        return ''
    try:
        return user.student_profile.university or ''
    except Exception:
        pass
    try:
        # Tutors have company_email but not a university field — check if they have one via user model
        return user.tutor_profile.company_email.split('@')[-1] if user.role == 'tutor' else ''
    except Exception:
        return ''


def _user_university_verified(user):
    """Check if user has verified their university."""
    if not user or not user.is_authenticated:
        return False
    try:
        return user.student_profile.university_verified
    except Exception:
        pass
    try:
        return user.tutor_profile.company_email_verified
    except Exception:
        return False


class CategoryListView(generics.ListAPIView):
    """
    List forum categories. Filters out university-only categories unless
    the user belongs to that university.
    """
    serializer_class = ForumCategorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = ForumCategory.objects.all()
        user = self.request.user
        university = self.request.query_params.get('university', None)

        if university:
            # Show global categories + categories for this specific university
            qs = qs.filter(Q(university='') | Q(university=university))
        else:
            if user.is_authenticated:
                user_uni = _get_user_university(user)
                if user_uni:
                    # Show global + user's own university categories
                    qs = qs.filter(Q(university='') | Q(university=user_uni))
                else:
                    # User has no university — only show global categories
                    qs = qs.filter(university='')
            else:
                # Anonymous users — only global categories
                qs = qs.filter(university='')

        return qs


class UniversityListView(views.APIView):
    """Return list of universities that have forum categories."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        universities = (
            ForumCategory.objects
            .exclude(university='')
            .values_list('university', flat=True)
            .distinct()
            .order_by('university')
        )
        return Response({'universities': list(universities)})


class PostListView(generics.ListAPIView):
    """
    List forum posts with filtering by category, university, search, and sort.

    Query params:
    - category: UUID — filter by category
    - university: string — filter by university
    - search: string — search in title and content
    - sort: latest|popular|unanswered|oldest (default: latest)
    - tags: comma-separated tag filter
    """
    serializer_class = ForumPostSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = ForumPost.objects.filter(is_flagged=False).select_related('author', 'category')

        # Category filter
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category_id=category)

        # University filter
        university = self.request.query_params.get('university')
        if university:
            if university == 'all':
                pass  # Show everything
            elif university == 'global':
                qs = qs.filter(university='')
            else:
                qs = qs.filter(university=university)
        else:
            # Default: show global posts + user's university posts
            user = self.request.user
            if user.is_authenticated:
                user_uni = _get_user_university(user)
                if user_uni:
                    qs = qs.filter(Q(university='') | Q(university=user_uni))
                else:
                    qs = qs.filter(university='')

        # Search
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(content__icontains=search))

        # Tag filter
        tags = self.request.query_params.get('tags')
        if tags:
            for tag in tags.split(','):
                qs = qs.filter(tags__contains=[tag.strip()])

        # Sort
        sort = self.request.query_params.get('sort', 'latest')
        if sort == 'popular':
            qs = qs.order_by('-upvotes', '-reply_count', '-created_at')
        elif sort == 'unanswered':
            qs = qs.filter(reply_count=0).order_by('-created_at')
        elif sort == 'oldest':
            qs = qs.order_by('created_at')
        elif sort == 'most_discussed':
            qs = qs.order_by('-reply_count', '-created_at')
        else:  # latest
            qs = qs.order_by('-is_pinned', '-created_at')

        return qs


class PostDetailView(generics.RetrieveAPIView):
    serializer_class = ForumPostSerializer
    permission_classes = [permissions.AllowAny]
    queryset = ForumPost.objects.select_related('author', 'category')


class PostCreateView(views.APIView):
    """Create a new forum post with auto-moderation and university tagging."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        category_id = data.get('category_id')
        title = data.get('title', '')
        content = data.get('content', '')
        is_anonymous = data.get('is_anonymous', False)
        tags = data.get('tags', [])

        if not category_id or not title or not content:
            return Response(
                {'error': 'category_id, title, and content are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if category is university-only
        try:
            category = ForumCategory.objects.get(id=category_id)
        except ForumCategory.DoesNotExist:
            return Response({'error': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        if category.is_university_only and category.university:
            user_uni = _get_user_university(request.user)
            if user_uni != category.university:
                return Response(
                    {'error': 'You must be a verified student at this university to post here.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Auto-moderation
        text = (title + ' ' + content).lower()
        is_flagged = any(kw in text for kw in FLAGGED_KEYWORDS)
        flag_reason = ''
        if is_flagged:
            matched = [kw for kw in FLAGGED_KEYWORDS if kw in text]
            flag_reason = f'Auto-flagged: keywords "{", ".join(matched)}"'

        # Set university from user's profile
        user_university = _get_user_university(request.user)

        post = ForumPost.objects.create(
            author=request.user,
            category=category,
            title=title,
            content=content,
            university=category.university or user_university,
            is_anonymous=is_anonymous,
            tags=tags if isinstance(tags, list) else [],
            is_flagged=is_flagged,
            flag_reason=flag_reason,
        )

        # Update category post count
        category.post_count = ForumPost.objects.filter(category=category, is_flagged=False).count()
        category.save()

        if is_flagged:
            return Response({
                'message': 'Your post has been submitted for review by our moderation team.',
                'post': ForumPostSerializer(post).data,
            }, status=status.HTTP_201_CREATED)

        return Response(ForumPostSerializer(post).data, status=status.HTTP_201_CREATED)


class ReplyListCreateView(generics.ListCreateAPIView):
    serializer_class = ForumReplySerializer

    def get_queryset(self):
        return ForumReply.objects.filter(
            post_id=self.kwargs['post_id'], is_flagged=False
        ).select_related('author')

    def perform_create(self, serializer):
        post = ForumPost.objects.get(id=self.kwargs['post_id'])
        serializer.save(author=self.request.user, post=post)
        post.reply_count = post.replies.filter(is_flagged=False).count()
        post.save()


class VoteView(views.APIView):
    """Toggle upvote/downvote on a post."""
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
                # Remove vote
                existing.delete()
                if vt == 'up':
                    post.upvotes = max(0, post.upvotes - 1)
                else:
                    post.downvotes = max(0, post.downvotes - 1)
            else:
                # Switch vote
                if existing.vote_type == 'up':
                    post.upvotes = max(0, post.upvotes - 1)
                else:
                    post.downvotes = max(0, post.downvotes - 1)
                existing.vote_type = vt
                existing.save()
                if vt == 'up':
                    post.upvotes += 1
                else:
                    post.downvotes += 1
        else:
            PostVote.objects.create(user=request.user, post=post, vote_type=vt)
            if vt == 'up':
                post.upvotes += 1
            else:
                post.downvotes += 1

        post.save()
        return Response({'upvotes': post.upvotes, 'downvotes': post.downvotes})


class ReportPostView(views.APIView):
    """Flag a post for moderation review."""
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
    """Return forum statistics for the sidebar."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        total_posts = ForumPost.objects.filter(is_flagged=False).count()
        total_replies = ForumReply.objects.filter(is_flagged=False).count()
        total_categories = ForumCategory.objects.count()
        return Response({
            'total_posts': total_posts,
            'total_replies': total_replies,
            'total_categories': total_categories,
        })
