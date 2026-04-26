from django.conf import settings

from accounts.models import User, Notification
from .models import Conversation, ConversationParticipant, ChatMessage
from .presence import is_user_connected_to_conversation
from .utils import serialize_message_payload



WELCOME_MESSAGE = """Welcome to StudySpace.

Before you get started:
- Keep conversations respectful and study-focused.
- Do not share passwords, payment details, or private documents in chat.
- Report behaviour that feels unsafe, abusive, or suspicious.
- Tutors and students should keep booking arrangements inside StudySpace where possible.

This is an automated admin message, so replies are disabled here.
"""

MAX_MESSAGE_BODY_LENGTH = 2000


class ChatMessageValidationError(ValueError):
    pass


def validate_chat_body(body):
    body = (body or '').strip()

    if not body:
        raise ChatMessageValidationError('Message cannot be empty.')

    if len(body) > MAX_MESSAGE_BODY_LENGTH:
        raise ChatMessageValidationError('Message exceeds 2000 characters.')

    return body


def create_chat_message(conversation, sender, body):
    body = validate_chat_body(body)

    message = ChatMessage.objects.create(
        conversation=conversation,
        sender=sender,
        body=body,
    )

    conversation.last_message_at = message.created_at
    conversation.save(update_fields=['last_message_at', 'updated_at'])

    ConversationParticipant.objects.get_or_create(
        conversation=conversation,
        user=sender,
    )[0].mark_read()

    recipient = conversation.other_participant(sender)

    if not is_user_connected_to_conversation(conversation.id, recipient.id):
        Notification.objects.create(
            user=recipient,
            notification_type=Notification.NotifType.MESSAGE,
            title=f'New message from {sender.display_name}',
            message=body[:120],
            link=f'/messages/{conversation.id}',
        )

    return message, serialize_message_payload(message, viewer=sender)


def _unique_admin_display_name():
    base = 'StudySpaceAdmin'
    candidate = base
    counter = 1

    while User.objects.filter(display_name=candidate).exists():
        counter += 1
        candidate = f'{base}{counter}'

    return candidate


def get_studyspace_admin_user():
    email = getattr(settings, 'STUDYSPACE_ADMIN_EMAIL', 'admin@studyspace.com')

    admin = User.objects.filter(email__iexact=email).first()
    if admin:
        return admin

    admin = User.objects.filter(role=User.Role.ADMIN, is_deleted=False).order_by('created_at').first()
    if admin:
        return admin

    admin = User(
        email=email,
        username=email,
        role=User.Role.ADMIN,
        display_name=_unique_admin_display_name(),
        is_active=True,
        is_email_verified=True,
        is_staff=True,
    )
    admin.set_unusable_password()
    admin.save()
    return admin


def create_welcome_conversation_for_user(user):
    if not user or user.role == User.Role.ADMIN:
        return None

    admin = get_studyspace_admin_user()
    if admin.id == user.id:
        return None

    conversation, _ = Conversation.get_or_create_direct(admin, user)
    conversation.is_system = True
    conversation.allow_replies = False
    conversation.save(update_fields=['is_system', 'allow_replies', 'updated_at'])

    if conversation.messages.filter(sender=admin).exists():
        return conversation

    message = ChatMessage.objects.create(
        conversation=conversation,
        sender=admin,
        body=WELCOME_MESSAGE,
    )

    conversation.last_message_at = message.created_at
    conversation.save(update_fields=['last_message_at', 'updated_at'])

    ConversationParticipant.objects.get_or_create(conversation=conversation, user=user)
    admin_participant, _ = ConversationParticipant.objects.get_or_create(conversation=conversation, user=admin)
    admin_participant.mark_read()

    Notification.objects.create(
        user=user,
        notification_type=Notification.NotifType.MESSAGE,
        title='Welcome to StudySpace',
        message='Read your StudySpace welcome message and community guidance.',
        link=f'/messages/{conversation.id}',
    )

    return conversation
