import asyncio
from collections import deque

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from accounts.models import Notification
from .middleware import get_user_from_token
from .models import Conversation, ConversationParticipant
from .services import ChatMessageValidationError, create_chat_message
from .presence import (
    add_user_to_conversation,
    remove_user_from_conversation,
)


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.group_name = f'conversation_{self.conversation_id}'
        self.is_authenticated = False
        self.message_timestamps = deque()

        await self.accept()
        self.auth_timeout_task = asyncio.create_task(self.close_if_not_authenticated())

    async def disconnect(self, close_code):
        if hasattr(self, 'auth_timeout_task'):
            self.auth_timeout_task.cancel()

        if getattr(self, 'is_authenticated', False) and hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        if getattr(self, 'is_authenticated', False) and hasattr(self, 'conversation_id') and hasattr(self, 'user'):
            remove_user_from_conversation(self.conversation_id, self.user.id, self.channel_name)

    async def close_if_not_authenticated(self):
        await asyncio.sleep(5)
        if not getattr(self, 'is_authenticated', False):
            await self.close(code=4001)

    async def authenticate_socket(self, token):
        if self.is_authenticated:
            return

        self.user = await get_user_from_token(token)
        self.scope['user'] = self.user

        if not self.user or not self.user.is_authenticated:
            await self.send_json({
                'type': 'error',
                'message': 'Live chat authentication failed. Please log in again.',
            })
            await self.close(code=4001)
            return

        is_allowed = await self.user_can_access_conversation()
        if not is_allowed:
            await self.send_json({
                'type': 'error',
                'message': 'You do not have access to this conversation.',
            })
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        add_user_to_conversation(self.conversation_id, self.user.id, self.channel_name)
        await self.mark_conversation_read()

        self.is_authenticated = True

        if hasattr(self, 'auth_timeout_task'):
            self.auth_timeout_task.cancel()

        await self.send_json({'type': 'auth_ok'})

    def message_rate_limited(self):
        now = timezone.now()
        window = timezone.timedelta(seconds=10)

        while self.message_timestamps and now - self.message_timestamps[0] > window:
            self.message_timestamps.popleft()

        if len(self.message_timestamps) >= 30:
            return True

        self.message_timestamps.append(now)
        return False

    async def receive_json(self, content):
        event_type = content.get('type')

        if event_type == 'auth':
            await self.authenticate_socket(content.get('token'))
            return

        if not getattr(self, 'is_authenticated', False):
            await self.close(code=4001)
            return

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

        if self.message_rate_limited():
            await self.send_json({
                'type': 'error',
                'message': 'You are sending messages too quickly. Please slow down.',
            })
            return

        if not await self.conversation_allows_replies():
            await self.send_json({
                'type': 'error',
                'message': 'This conversation is read-only.',
            })
            return

        try:
            message_data = await self.create_message(body)
        except ChatMessageValidationError as exc:
            await self.send_json({
                'type': 'error',
                'message': str(exc),
            })
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'chat_message',
                'message': message_data,
            },
        )


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
        conversation = Conversation.objects.select_related('user_one', 'user_two').get(
            id=self.conversation_id
        )
        _, payload = create_chat_message(conversation, self.user, body)
        return payload
