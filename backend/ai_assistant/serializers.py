from rest_framework import serializers
from .models import AIConversation

class AIConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIConversation
        fields = "__all__"
        read_only_fields = ["id", "user", "created_at", "updated_at"]

class AIMessageSerializer(serializers.Serializer):
    conversation_id = serializers.UUIDField(required=False)
    message = serializers.CharField(max_length=5000)
