from django.contrib import admin
from .models import Conversation, ConversationParticipant, ChatMessage


class ConversationParticipantInline(admin.TabularInline):
    model = ConversationParticipant
    extra = 0
    readonly_fields = ['last_read_at']


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ['sender', 'body', 'created_at']


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_one', 'user_two', 'last_message_at', 'updated_at']
    search_fields = ['user_one__email', 'user_one__display_name', 'user_two__email', 'user_two__display_name']
    inlines = [ConversationParticipantInline, ChatMessageInline]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'conversation', 'sender', 'created_at']
    search_fields = ['sender__email', 'sender__display_name', 'body']
