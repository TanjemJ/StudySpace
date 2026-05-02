from rest_framework import serializers

from accounts.models import User
from accounts.media_urls import safe_file_url
from .models import Conversation, ConversationParticipant, ChatMessage


class ChatUserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'display_name', 'first_name', 'last_name', 'role', 'avatar_url']

    def get_avatar_url(self, obj):
        return safe_file_url(obj.avatar, fallback='')


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    is_deleted = serializers.SerializerMethodField()
    can_modify = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'conversation', 'sender', 'body',
            'created_at', 'edited_at', 'deleted_at', 'is_deleted',
            'can_modify',
        ]
        read_only_fields = [
            'id', 'conversation', 'sender',
            'created_at', 'edited_at', 'deleted_at', 'is_deleted',
            'can_modify',
        ]

    def get_is_deleted(self, obj):
        return obj.is_deleted
    
    def get_can_modify(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return obj.can_be_modified_by(user)



class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'other_user', 'last_message', 'unread_count',
            'last_message_at', 'updated_at', 'is_system', 'allow_replies'
        ]

    def get_other_user(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        return ChatUserSerializer(obj.other_participant(request.user)).data

    def get_last_message(self, obj):
        message = obj.messages.order_by('-created_at').first()
        return ChatMessageSerializer(message, context=self.context).data if message else None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request:
            return 0

        participant = ConversationParticipant.objects.filter(
            conversation=obj,
            user=request.user,
        ).first()

        qs = obj.messages.filter(deleted_at__isnull=True).exclude(sender=request.user)
        if participant and participant.last_read_at:
            qs = qs.filter(created_at__gt=participant.last_read_at)

        return qs.count()
