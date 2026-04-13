from django.contrib import admin
from .models import ForumCategory, ForumPost, ForumReply, ModerationLog


@admin.register(ForumCategory)
class ForumCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'university', 'is_university_only', 'post_count', 'order')
    list_filter = ('is_university_only', 'university')
    list_editable = ('order', 'is_university_only')
    search_fields = ('name', 'university')


@admin.register(ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'category', 'university', 'is_anonymous', 'is_flagged', 'is_pinned', 'upvotes', 'reply_count', 'created_at')
    list_filter = ('is_flagged', 'is_anonymous', 'is_pinned', 'category', 'university')
    search_fields = ('title', 'content', 'author__display_name')
    actions = ['unflag_posts', 'remove_posts', 'pin_posts', 'unpin_posts']

    def unflag_posts(self, request, queryset):
        queryset.update(is_flagged=False, flag_reason='')
    unflag_posts.short_description = 'Unflag selected posts'

    def remove_posts(self, request, queryset):
        queryset.delete()
    remove_posts.short_description = 'Delete selected posts'

    def pin_posts(self, request, queryset):
        queryset.update(is_pinned=True)
    pin_posts.short_description = 'Pin selected posts'

    def unpin_posts(self, request, queryset):
        queryset.update(is_pinned=False)
    unpin_posts.short_description = 'Unpin selected posts'


@admin.register(ForumReply)
class ForumReplyAdmin(admin.ModelAdmin):
    list_display = ('post', 'author', 'is_anonymous', 'is_flagged', 'upvotes', 'created_at')
    list_filter = ('is_flagged', 'is_anonymous')


@admin.register(ModerationLog)
class ModerationLogAdmin(admin.ModelAdmin):
    list_display = ('admin', 'target_type', 'action', 'reason', 'created_at')
    list_filter = ('action', 'target_type')
