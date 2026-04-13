from django.contrib import admin
from .models import ForumCategory, ForumPost, ForumReply, ModerationLog
admin.site.register(ForumCategory)
admin.site.register(ForumPost)
admin.site.register(ForumReply)
admin.site.register(ModerationLog)
