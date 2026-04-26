from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from accounts.models import User, Notification
from .models import Conversation, ConversationParticipant, ChatMessage
from .serializers import ConversationSerializer, ChatMessageSerializer, ChatUserSerializer
from .services import ChatMessageValidationError, create_chat_message
from .utils import serialize_message_payload


def get_user_conversations(user):
    return Conversation.objects.filter(
        Q(user_one=user) | Q(user_two=user),
        messages__isnull=False,
    ).distinct().select_related('user_one', 'user_two').prefetch_related('messages', 'participant_states')


def user_can_access_conversation(user, conversation):
    return conversation.user_one_id == user.id or conversation.user_two_id == user.id


class ConversationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return get_user_conversations(self.request.user)

    def get_serializer_context(self):
        return {'request': self.request}
    
class ConversationDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer
    lookup_url_kwarg = 'conversation_id'

    def get_queryset(self):
        return Conversation.objects.filter(
            Q(user_one=self.request.user) | Q(user_two=self.request.user)
        ).select_related('user_one', 'user_two').prefetch_related('messages', 'participant_states')

    def get_serializer_context(self):
        return {'request': self.request}


class StartConversationView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        other_user_id = request.data.get('user_id')

        try:
            other_user = User.objects.get(id=other_user_id, is_deleted=False, role__in=['student', 'tutor'])
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if other_user.id == request.user.id:
            return Response({'error': 'You cannot start a conversation with yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        conversation, _ = Conversation.get_or_create_direct(request.user, other_user)

        serializer = ConversationSerializer(conversation, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MessageListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_conversation(self, request, conversation_id):
        try:
            conversation = Conversation.objects.select_related('user_one', 'user_two').get(id=conversation_id)
        except Conversation.DoesNotExist:
            return None

        if not user_can_access_conversation(request.user, conversation):
            return None

        return conversation

    def get(self, request, conversation_id):
        conversation = self.get_conversation(request, conversation_id)
        if not conversation:
            return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        messages = conversation.messages.select_related('sender').order_by('created_at')
        return Response(ChatMessageSerializer(messages, many=True, context={'request': request}).data)

    def post(self, request, conversation_id):
        conversation = self.get_conversation(request, conversation_id)
        if not conversation:
            return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        if not conversation.allow_replies:
            return Response({'error': 'This conversation is read-only.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            message, payload = create_chat_message(
                conversation=conversation,
                sender=request.user,
                body=request.data.get('body'),
            )
        except ChatMessageValidationError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        data = ChatMessageSerializer(message, context={'request': request}).data

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'conversation_{conversation.id}',
            {
                'type': 'chat_message',
                'message': payload,
            },
        )

        return Response(data, status=status.HTTP_201_CREATED)


class MessageDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_message(self, request, conversation_id, message_id):
        try:
            message = ChatMessage.objects.select_related(
                'sender',
                'conversation__user_one',
                'conversation__user_two',
            ).get(id=message_id, conversation_id=conversation_id)
        except ChatMessage.DoesNotExist:
            return None

        if not user_can_access_conversation(request.user, message.conversation):
            return None

        return message

    def patch(self, request, conversation_id, message_id):
        message = self.get_message(request, conversation_id, message_id)
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not message.can_be_modified_by(request.user):
            return Response({'error': 'This message can no longer be edited.'}, status=status.HTTP_403_FORBIDDEN)

        body = (request.data.get('body') or '').strip()
        if not body:
            return Response({'error': 'Message cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        message.body = body
        message.edited_at = timezone.now()
        message.save(update_fields=['body', 'edited_at'])

        data = ChatMessageSerializer(message, context={'request': request}).data
        self.broadcast_update(message.conversation_id, serialize_message_payload(message, viewer=request.user))

        return Response(data)

    def delete(self, request, conversation_id, message_id):
        message = self.get_message(request, conversation_id, message_id)
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not message.can_be_modified_by(request.user):
            return Response({'error': 'This message can no longer be deleted.'}, status=status.HTTP_403_FORBIDDEN)

        message.body = ''
        message.deleted_at = timezone.now()
        message.save(update_fields=['body', 'deleted_at'])

        data = ChatMessageSerializer(message, context={'request': request}).data
        self.broadcast_update(message.conversation_id, serialize_message_payload(message, viewer=request.user))

        return Response(data)

    def broadcast_update(self, conversation_id, data):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'conversation_{conversation_id}',
            {
                'type': 'chat_message_updated',
                'message': data,
            },
        )


class MarkConversationReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id):
        try:
            conversation = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not user_can_access_conversation(request.user, conversation):
            return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        participant, _ = ConversationParticipant.objects.get_or_create(
            conversation=conversation,
            user=request.user,
        )
        participant.last_read_at = timezone.now()
        participant.save(update_fields=['last_read_at'])

        Notification.objects.filter(
            user=request.user,
            notification_type=Notification.NotifType.MESSAGE,
            link=f'/messages/{conversation.id}',
            is_read=False,
        ).update(is_read=True)

        return Response({'message': 'Conversation marked as read.'})


class ChatUserSearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatUserSerializer

    def get_queryset(self):
        q = (self.request.query_params.get('q') or '').strip()

        queryset = User.objects.filter(
            is_deleted=False,
            role__in=['student', 'tutor'],
        ).exclude(id=self.request.user.id)

        if q:
            queryset = queryset.filter(
                Q(display_name__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(email__icontains=q)
            )

        return queryset.order_by('display_name')[:20]
