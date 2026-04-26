from django.urls import path

from .consumers import ChatConsumer

websocket_urlpatterns = [
    path('ws/messages/<uuid:conversation_id>/', ChatConsumer.as_asgi()),
]
