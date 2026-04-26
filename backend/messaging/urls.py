from django.urls import path

from .views import (
    ConversationListView,
    ConversationDetailView,
    StartConversationView,
    MessageListCreateView,
    MessageDetailView,
    MarkConversationReadView,
    ChatUserSearchView,
)




urlpatterns = [
    path('conversations/', ConversationListView.as_view(), name='conversation-list'),
    path('conversations/start/', StartConversationView.as_view(), name='conversation-start'),
    path('conversations/<uuid:conversation_id>/', ConversationDetailView.as_view(), name='conversation-detail'),
    path('conversations/<uuid:conversation_id>/messages/', MessageListCreateView.as_view(), name='conversation-messages'),
    path('conversations/<uuid:conversation_id>/messages/<uuid:message_id>/', MessageDetailView.as_view(), name='conversation-message-detail'),
    path('conversations/<uuid:conversation_id>/read/', MarkConversationReadView.as_view(), name='conversation-read'),
    path('users/', ChatUserSearchView.as_view(), name='chat-user-search'),
]

