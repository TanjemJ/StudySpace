def serialize_message_payload(message, viewer=None):
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
        'can_modify': message.can_be_modified_by(viewer) if viewer else False,
    }
