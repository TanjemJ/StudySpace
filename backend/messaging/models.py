import uuid
from django.db import models
from django.db.models import Q
from django.utils import timezone

from accounts.models import User


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_one = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_as_user_one')
    user_two = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_as_user_two')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    is_system = models.BooleanField(default=False)
    allow_replies = models.BooleanField(default=True)

    class Meta:
        ordering = ['-last_message_at', '-updated_at']
        constraints = [
            models.UniqueConstraint(fields=['user_one', 'user_two'], name='unique_direct_conversation'),
            models.CheckConstraint(check=~Q(user_one=models.F('user_two')), name='conversation_users_must_differ'),
        ]

    def __str__(self):
        return f'{self.user_one.display_name} <-> {self.user_two.display_name}'

    @staticmethod
    def ordered_users(a, b):
        return (a, b) if str(a.id) < str(b.id) else (b, a)

    @classmethod
    def get_or_create_direct(cls, user_a, user_b):
        user_one, user_two = cls.ordered_users(user_a, user_b)
        conversation, created = cls.objects.get_or_create(user_one=user_one, user_two=user_two)
        ConversationParticipant.objects.get_or_create(conversation=conversation, user=user_a)
        ConversationParticipant.objects.get_or_create(conversation=conversation, user=user_b)
        return conversation, created

    def has_participant(self, user):
        return self.user_one_id == user.id or self.user_two_id == user.id

    def other_participant(self, user):
        return self.user_two if self.user_one_id == user.id else self.user_one


class ConversationParticipant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='participant_states')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversation_states')
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['conversation', 'user']

    def mark_read(self):
        self.last_read_at = timezone.now()
        self.save(update_fields=['last_read_at'])


class ChatMessage(models.Model):
    EDIT_WINDOW_MINUTES = 3

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_chat_messages')
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    def can_be_modified_by(self, user):
        if not user or not user.is_authenticated:
            return False
        if self.sender_id != user.id or self.is_deleted:
            return False
        return timezone.now() <= self.created_at + timezone.timedelta(minutes=self.EDIT_WINDOW_MINUTES)

    def __str__(self):
        preview = 'deleted' if self.is_deleted else self.body[:40]
        return f'{self.sender.display_name}: {preview}'

