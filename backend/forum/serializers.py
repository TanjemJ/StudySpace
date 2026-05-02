from rest_framework import serializers
from accounts.media_urls import safe_file_url
from .models import ForumCategory, ForumPost, ForumReply, PostVote, Report


class ForumCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ForumCategory
        fields = '__all__'


class ForumReplySerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    author_id = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    is_editable = serializers.BooleanField(read_only=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = ForumReply
        fields = [
            'id', 'post', 'author', 'author_name', 'author_avatar', 'author_id', 'author_role',
            'parent', 'content', 'is_anonymous', 'is_flagged', 'upvotes', 'downvotes',
            'is_edited', 'edited_at', 'created_at', 'children', 'user_vote',
            'is_editable', 'can_edit',
        ]
        read_only_fields = [
            'id', 'author', 'post', 'upvotes', 'downvotes', 'is_flagged',
            'is_edited', 'edited_at', 'created_at',
        ]

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return 'Anonymous'
        if obj.author.is_deleted:
            return '[Deleted User]'
        return obj.author.display_name

    def get_author_avatar(self, obj):
        if obj.is_anonymous or obj.author.is_deleted:
            return None
        return safe_file_url(obj.author.avatar)

    def get_author_id(self, obj):
        if obj.is_anonymous or obj.author.is_deleted:
            return None
        return str(obj.author.id)

    def get_author_role(self, obj):
        if obj.is_anonymous or obj.author.is_deleted:
            return None
        return obj.author.role

    def get_children(self, obj):
        """Only include children for top-level replies (parent is None)."""
        if obj.parent is None:
            children = obj.children.filter(is_flagged=False).order_by('created_at')
            return ForumReplySerializer(children, many=True, context=self.context).data
        return []

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        vote = PostVote.objects.filter(user=request.user, reply=obj).first()
        return vote.vote_type if vote else None

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.author_id == request.user.id and obj.is_editable


class ForumPostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    author_id = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()
    author_university = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_icon = serializers.CharField(source='category.icon', read_only=True)
    user_vote = serializers.SerializerMethodField()
    is_editable = serializers.BooleanField(read_only=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = ForumPost
        fields = '__all__'
        read_only_fields = [
            'id', 'author', 'upvotes', 'downvotes', 'reply_count',
            'is_flagged', 'university', 'is_edited', 'edited_at',
            'created_at', 'updated_at',
        ]

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return 'Anonymous'
        if obj.author.is_deleted:
            return '[Deleted User]'
        return obj.author.display_name

    def get_author_avatar(self, obj):
        if obj.is_anonymous or obj.author.is_deleted:
            return None
        return safe_file_url(obj.author.avatar)

    def get_author_id(self, obj):
        if obj.is_anonymous or obj.author.is_deleted:
            return None
        return str(obj.author.id)

    def get_author_role(self, obj):
        if obj.is_anonymous or obj.author.is_deleted:
            return None
        return obj.author.role

    def get_author_university(self, obj):
        if obj.is_anonymous or obj.author.is_deleted:
            return None
        try:
            return obj.author.student_profile.university or None
        except Exception:
            pass
        try:
            return obj.author.tutor_profile.university or None
        except Exception:
            return None

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        vote = PostVote.objects.filter(user=request.user, post=obj).first()
        return vote.vote_type if vote else None

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.author_id == request.user.id and obj.is_editable


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['reason', 'details']
