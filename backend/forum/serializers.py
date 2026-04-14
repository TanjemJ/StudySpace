from rest_framework import serializers
from .models import ForumCategory, ForumPost, ForumReply


class ForumCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ForumCategory
        fields = '__all__'


class ForumPostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    author_university = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_icon = serializers.CharField(source='category.icon', read_only=True)

    class Meta:
        model = ForumPost
        fields = '__all__'
        read_only_fields = [
            'id', 'author', 'upvotes', 'downvotes', 'reply_count',
            'is_flagged', 'university', 'created_at', 'updated_at',
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
        return obj.author.avatar.url if obj.author.avatar else None

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


class ForumReplySerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()

    class Meta:
        model = ForumReply
        fields = '__all__'
        read_only_fields = [
            'id', 'author', 'post', 'upvotes', 'downvotes', 'is_flagged', 'created_at',
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
        return obj.author.avatar.url if obj.author.avatar else None
