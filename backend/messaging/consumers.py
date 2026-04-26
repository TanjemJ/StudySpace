from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from accounts.models import Notification
from .models import Conversation, ConversationParticipant, ChatMessage
from .presence import (
    add_user_to_conversation,
    remove_user_from_conversation,
    is_user_connected_to_conversation,
)

def serialize_chat_message(message):
    sender = message.sender

    return {
        'id': str(message.id),
        'conversation': str(message.conversation_id),
        'sender': {
            'id': str(sender.id),
            'display_name': sender.display_name,
            'first_name': sender.first_name,
            'last_name': sender.last_name,
            'role': sender.role,
            'avatar_url': sender.avatar.url if sender.avatar else '',
        },
        'body': message.body,
        'created_at': message.created_at.isoformat(),
        'edited_at': message.edited_at.isoformat() if message.edited_at else None,
        'deleted_at': message.deleted_at.isoformat() if message.deleted_at else None,
        'is_deleted': message.is_deleted,
    }



class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.group_name = f'conversation_{self.conversation_id}'

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        is_allowed = await self.user_can_access_conversation()
        if not is_allowed:
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        add_user_to_conversation(self.conversation_id, self.user.id)
        await self.mark_conversation_read()
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if hasattr(self, 'conversation_id') and hasattr(self, 'user'):
            remove_user_from_conversation(self.conversation_id, self.user.id)

    async def receive_json(self, content):
        event_type = content.get('type')

        if event_type == 'typing':
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'typing_event',
                    'user_id': str(self.user.id),
                    'is_typing': bool(content.get('is_typing')),
                },
            )
            return

        if event_type != 'message':
            return

        body = (content.get('body') or '').strip()
        if not body:
            return
        
        if not await self.conversation_allows_replies():
            await self.send_json({
                'type': 'error',
                'message': 'This conversation is read-only.',
            })
            return

        try:
            message_data = await self.create_message(body)

            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'chat_message',
                    'message': message_data,
                },
            )
        except Exception:
            await self.send_json({
                'type': 'error',
                'message': 'Message was saved, but real-time delivery failed.',
            })
            raise

    async def chat_message(self, event):
        message = event['message']
        if str(message['sender']['id']) != str(self.user.id):
            await self.mark_conversation_read()

        await self.send_json({
            'type': 'message',
            'message': message,
        })

    async def chat_message_updated(self, event):
        await self.send_json({
            'type': 'message_updated',
            'message': event['message'],
        })



    async def typing_event(self, event):
        if event['user_id'] == str(self.user.id):
            return

        await self.send_json({
            'type': 'typing',
            'user_id': event['user_id'],
            'is_typing': event['is_typing'],
        })

    @database_sync_to_async
    def user_can_access_conversation(self):
        return Conversation.objects.filter(
            id=self.conversation_id,
            user_one=self.user,
        ).exists() or Conversation.objects.filter(
            id=self.conversation_id,
            user_two=self.user,
        ).exists()
    
    @database_sync_to_async
    def conversation_allows_replies(self):
        return Conversation.objects.filter(
            id=self.conversation_id,
            allow_replies=True,
        ).exists()


    @database_sync_to_async
    def mark_conversation_read(self):
        participant, _ = ConversationParticipant.objects.get_or_create(
            conversation_id=self.conversation_id,
            user=self.user,
        )
        participant.last_read_at = timezone.now()
        participant.save(update_fields=['last_read_at'])

        Notification.objects.filter(
            user=self.user,
            notification_type=Notification.NotifType.MESSAGE,
            link=f'/messages/{self.conversation_id}',
            is_read=False,
        ).update(is_read=True)

    @database_sync_to_async
    def create_message(self, body):
        conversation = Conversation.objects.select_related('user_one', 'user_two').get(id=self.conversation_id)

        message = ChatMessage.objects.create(
            conversation=conversation,
            sender=self.user,
            body=body,
        )

        conversation.last_message_at = message.created_at
        conversation.save(update_fields=['last_message_at', 'updated_at'])

        ConversationParticipant.objects.get_or_create(
            conversation=conversation,
            user=self.user,
        )[0].mark_read()

        recipient = conversation.other_participant(self.user)

        if not is_user_connected_to_conversation(conversation.id, recipient.id):
            Notification.objects.create(
                user=recipient,
                notification_type=Notification.NotifType.MESSAGE,
                title=f'New message from {self.user.display_name}',
                message=body[:120],
                link=f'/messages/{conversation.id}',
            )

        return serialize_chat_message(message)
