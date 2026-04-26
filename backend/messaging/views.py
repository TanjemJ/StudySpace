from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from accounts.models import User, Notification
from .models import Conversation, ConversationParticipant, ChatMessage
from .presence import is_user_connected_to_conversation
from .serializers import ConversationSerializer, ChatMessageSerializer, ChatUserSerializer


def get_user_conversations(user):
    return Conversation.objects.filter(
        Q(user_one=user) | Q(user_two=user)
    ).select_related('user_one', 'user_two').prefetch_related('messages', 'participant_states')


def user_can_access_conversation(user, conversation):
    return conversation.user_one_id == user.id or conversation.user_two_id == user.id


class ConversationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return get_user_conversations(self.request.user)

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
        return Response(ChatMessageSerializer(messages, many=True).data)

    def post(self, request, conversation_id):
        conversation = self.get_conversation(request, conversation_id)
        if not conversation:
            return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        body = (request.data.get('body') or '').strip()
        if not body:
            return Response({'error': 'Message cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        message = ChatMessage.objects.create(
            conversation=conversation,
            sender=request.user,
            body=body,
        )

        conversation.last_message_at = message.created_at
        conversation.save(update_fields=['last_message_at', 'updated_at'])

        ConversationParticipant.objects.get_or_create(
            conversation=conversation,
            user=request.user,
        )[0].mark_read()

        recipient = conversation.other_participant(request.user)

        if not is_user_connected_to_conversation(conversation.id, recipient.id):
            Notification.objects.create(
                user=recipient,
                notification_type=Notification.NotifType.MESSAGE,
                title=f'New message from {request.user.display_name}',
                message=body[:120],
                link=f'/messages/{conversation.id}',
            )

        data = ChatMessageSerializer(message).data

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'conversation_{conversation.id}',
            {
                'type': 'chat_message',
                'message': data,
            },
        )

        return Response(data, status=status.HTTP_201_CREATED)


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
