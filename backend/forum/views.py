from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from .models import ForumCategory, ForumPost, ForumReply, PostVote
from .serializers import ForumCategorySerializer, ForumPostSerializer, ForumReplySerializer

FLAGGED_KEYWORDS = ["hate", "kill", "threat", "abuse", "harass"]

class CategoryListView(generics.ListAPIView):
    serializer_class = ForumCategorySerializer
    permission_classes = [permissions.AllowAny]
    queryset = ForumCategory.objects.all()

class PostListView(generics.ListAPIView):
    serializer_class = ForumPostSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        qs = ForumPost.objects.filter(is_flagged=False).select_related("author")
        cat = self.request.query_params.get("category")
        if cat: qs = qs.filter(category_id=cat)
        return qs

class PostDetailView(generics.RetrieveAPIView):
    serializer_class = ForumPostSerializer
    permission_classes = [permissions.AllowAny]
    queryset = ForumPost.objects.all()

class PostCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        data = request.data
        text = (data.get("title","") + " " + data.get("content","")).lower()
        flagged = any(kw in text for kw in FLAGGED_KEYWORDS)
        post = ForumPost.objects.create(
            author=request.user, category_id=data["category_id"],
            title=data["title"], content=data["content"],
            is_anonymous=data.get("is_anonymous", False),
            tags=data.get("tags", []), is_flagged=flagged,
        )
        return Response(ForumPostSerializer(post).data, status=status.HTTP_201_CREATED)

class ReplyListCreateView(generics.ListCreateAPIView):
    serializer_class = ForumReplySerializer
    def get_queryset(self):
        return ForumReply.objects.filter(post_id=self.kwargs["post_id"], is_flagged=False)
    def perform_create(self, serializer):
        post = ForumPost.objects.get(id=self.kwargs["post_id"])
        serializer.save(author=self.request.user, post=post)
        post.reply_count = post.replies.filter(is_flagged=False).count()
        post.save()

class VoteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, post_id):
        vt = request.data.get("vote_type")
        post = ForumPost.objects.get(id=post_id)
        existing = PostVote.objects.filter(user=request.user, post=post).first()
        if existing:
            if existing.vote_type == vt:
                existing.delete()
                if vt=="up": post.upvotes=max(0,post.upvotes-1)
                else: post.downvotes=max(0,post.downvotes-1)
            else:
                if existing.vote_type=="up": post.upvotes=max(0,post.upvotes-1)
                else: post.downvotes=max(0,post.downvotes-1)
                existing.vote_type=vt; existing.save()
                if vt=="up": post.upvotes+=1
                else: post.downvotes+=1
        else:
            PostVote.objects.create(user=request.user, post=post, vote_type=vt)
            if vt=="up": post.upvotes+=1
            else: post.downvotes+=1
        post.save()
        return Response({"upvotes": post.upvotes, "downvotes": post.downvotes})
