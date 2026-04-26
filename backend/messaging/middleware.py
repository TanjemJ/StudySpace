from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


@database_sync_to_async
def get_user_from_token(token):
    if not token:
        return AnonymousUser()

    try:
        jwt_auth = JWTAuthentication()
        validated_token = jwt_auth.get_validated_token(token)
        return jwt_auth.get_user(validated_token)
    except (InvalidToken, TokenError, AuthenticationFailed):
        return AnonymousUser()


class JwtAuthMiddleware:
    """
    WebSocket middleware intentionally does not read JWTs from the query string.
    Chat sockets authenticate with a first message: {"type": "auth", "token": "..."}.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        scope['user'] = AnonymousUser()
        return await self.app(scope, receive, send)
