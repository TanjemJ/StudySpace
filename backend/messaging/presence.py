from collections import defaultdict

ACTIVE_CHAT_USERS = defaultdict(set)


def add_user_to_conversation(conversation_id, user_id):
    ACTIVE_CHAT_USERS[str(conversation_id)].add(str(user_id))


def remove_user_from_conversation(conversation_id, user_id):
    users = ACTIVE_CHAT_USERS.get(str(conversation_id))
    if not users:
        return
    users.discard(str(user_id))
    if not users:
        ACTIVE_CHAT_USERS.pop(str(conversation_id), None)


def is_user_connected_to_conversation(conversation_id, user_id):
    return str(user_id) in ACTIVE_CHAT_USERS.get(str(conversation_id), set())
