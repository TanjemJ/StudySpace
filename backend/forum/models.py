import uuid
from django.db import models
from accounts.models import User


class ForumCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, max_length=500)
    university = models.CharField(max_length=200, blank=True)
    icon = models.CharField(max_length=50, blank=True, default='forum')
    post_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Forum Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class ForumPost(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_posts')
    category = models.ForeignKey(ForumCategory, on_delete=models.CASCADE, related_name='posts')
    title = models.CharField(max_length=200)
    content = models.TextField(max_length=10000)
    is_anonymous = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.CharField(max_length=200, blank=True)
    upvotes = models.IntegerField(default=0)
    downvotes = models.IntegerField(default=0)
    reply_count = models.IntegerField(default=0)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        return self.title


class ForumReply(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name='replies')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_replies')
    content = models.TextField(max_length=5000)
    is_anonymous = models.BooleanField(default=False)
    is_flagged = models.BooleanField(default=False)
    upvotes = models.IntegerField(default=0)
    downvotes = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class PostVote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, null=True, blank=True)
    reply = models.ForeignKey(ForumReply, on_delete=models.CASCADE, null=True, blank=True)
    vote_type = models.CharField(max_length=4, choices=[('up', 'Upvote'), ('down', 'Downvote')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'post'], ['user', 'reply']]


class ModerationLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin = models.ForeignKey(User, on_delete=models.CASCADE, related_name='moderation_actions')
    target_type = models.CharField(max_length=10)
    target_id = models.UUIDField()
    action = models.CharField(max_length=20)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
