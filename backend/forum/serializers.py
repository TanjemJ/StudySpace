from rest_framework import serializers
from .models import ForumCategory, ForumPost, ForumReply

class ForumCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ForumCategory
        fields = "__all__"

class ForumPostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    class Meta:
        model = ForumPost
        fields = "__all__"
        read_only_fields = ["id", "author", "upvotes", "downvotes", "reply_count", "is_flagged", "created_at"]
    def get_author_name(self, obj):
        return "Anonymous" if obj.is_anonymous else obj.author.display_name

class ForumReplySerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    class Meta:
        model = ForumReply
        fields = "__all__"
        read_only_fields = ["id", "author", "post", "upvotes", "downvotes", "is_flagged", "created_at"]
    def get_author_name(self, obj):
        return "Anonymous" if obj.is_anonymous else obj.author.display_name
