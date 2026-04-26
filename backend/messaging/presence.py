from collections import defaultdict

from django.conf import settings


ACTIVE_CHAT_USERS = defaultdict(lambda: defaultdict(set))
_redis_client = None


def _presence_key(conversation_id, user_id):
    return f'presence:conversation:{conversation_id}:user:{user_id}'


def _get_redis_client():
    global _redis_client

    if not getattr(settings, 'USE_REDIS_CHANNEL_LAYER', False):
        return None

    if _redis_client is None:
        import redis
        _redis_client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )

    return _redis_client


def add_user_to_conversation(conversation_id, user_id, connection_id=None):
    conversation_id = str(conversation_id)
    user_id = str(user_id)
    connection_id = str(connection_id or user_id)

    client = _get_redis_client()
    if client:
        key = _presence_key(conversation_id, user_id)
        client.sadd(key, connection_id)
        client.expire(key, settings.CHAT_PRESENCE_TTL_SECONDS)
        return

    ACTIVE_CHAT_USERS[conversation_id][user_id].add(connection_id)


def remove_user_from_conversation(conversation_id, user_id, connection_id=None):
    conversation_id = str(conversation_id)
    user_id = str(user_id)
    connection_id = str(connection_id or user_id)

    client = _get_redis_client()
    if client:
        key = _presence_key(conversation_id, user_id)
        client.srem(key, connection_id)
        if client.scard(key) == 0:
            client.delete(key)
        return

    users = ACTIVE_CHAT_USERS.get(conversation_id)
    if not users:
        return

    connections = users.get(user_id)
    if not connections:
        return

    connections.discard(connection_id)

    if not connections:
        users.pop(user_id, None)

    if not users:
        ACTIVE_CHAT_USERS.pop(conversation_id, None)


def is_user_connected_to_conversation(conversation_id, user_id):
    conversation_id = str(conversation_id)
    user_id = str(user_id)

    client = _get_redis_client()
    if client:
        return client.exists(_presence_key(conversation_id, user_id)) > 0

    return bool(ACTIVE_CHAT_USERS.get(conversation_id, {}).get(user_id))
