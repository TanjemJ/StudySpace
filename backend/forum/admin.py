from django.contrib import admin
from .models import ForumCategory, ForumPost, ForumReply, ModerationLog, Report


@admin.register(ForumCategory)
class ForumCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'university', 'is_university_only', 'post_count', 'order')
    list_filter = ('is_university_only', 'university')
    list_editable = ('order', 'is_university_only')
    search_fields = ('name', 'university')


@admin.register(ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'category', 'university', 'is_anonymous',
                    'is_flagged', 'is_pinned', 'upvotes', 'reply_count', 'created_at')
    list_filter = ('is_flagged', 'is_anonymous', 'is_pinned', 'category', 'university')
    search_fields = ('title', 'content', 'author__display_name')
    actions = ['unflag_posts', 'remove_posts', 'pin_posts', 'unpin_posts']

    def unflag_posts(self, request, queryset):
        queryset.update(is_flagged=False, flag_reason='')
    def remove_posts(self, request, queryset):
        queryset.delete()
    def pin_posts(self, request, queryset):
        queryset.update(is_pinned=True)
    def unpin_posts(self, request, queryset):
        queryset.update(is_pinned=False)


@admin.register(ForumReply)
class ForumReplyAdmin(admin.ModelAdmin):
    list_display = ('post', 'author', 'parent', 'is_anonymous', 'is_flagged', 'upvotes', 'created_at')
    list_filter = ('is_flagged', 'is_anonymous')


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('reason', 'reporter', 'post', 'reply', 'status', 'created_at')
    list_filter = ('status', 'reason')
    actions = ['mark_dismissed', 'mark_actioned']

    def mark_dismissed(self, request, queryset):
        queryset.update(status='dismissed', reviewed_by=request.user)
    def mark_actioned(self, request, queryset):
        queryset.update(status='actioned', reviewed_by=request.user)


@admin.register(ModerationLog)
class ModerationLogAdmin(admin.ModelAdmin):
    list_display = ('admin', 'target_type', 'action', 'reason', 'created_at')
    list_filter = ('action', 'target_type')
