import uuid
from django.db import models
from django.utils import timezone
from accounts.models import User


class ForumCategory(models.Model):
    """Forum categories — can be global or university-specific."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, max_length=500)
    university = models.CharField(
        max_length=200, blank=True,
        help_text="If set, only students from this university can see and post here."
    )
    icon = models.CharField(max_length=50, blank=True, default='forum')
    post_count = models.IntegerField(default=0)
    is_university_only = models.BooleanField(
        default=False,
        help_text="If True, only verified university students can access this category."
    )
    order = models.IntegerField(default=0, help_text="Display order, lower = first")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Forum Categories'
        ordering = ['order', 'name']

    def __str__(self):
        suffix = f" [{self.university}]" if self.university else ""
        return f"{self.name}{suffix}"


class ForumPost(models.Model):
    """A forum post/thread."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_posts')
    category = models.ForeignKey(ForumCategory, on_delete=models.CASCADE, related_name='posts')
    title = models.CharField(max_length=200)
    content = models.TextField(max_length=10000)
    university = models.CharField(
        max_length=200, blank=True,
        help_text="The university this post belongs to (auto-set from author's profile)."
    )
    is_anonymous = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.CharField(max_length=200, blank=True)
    upvotes = models.IntegerField(default=0)
    downvotes = models.IntegerField(default=0)
    reply_count = models.IntegerField(default=0)
    tags = models.JSONField(default=list, blank=True)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_deleted = models.BooleanField(default=False)
    deleted_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='+',
    )
    deletion_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        return self.title

    @property
    def author_display(self):
        return 'Anonymous' if self.is_anonymous else self.author.display_name

    @property
    def is_editable(self):
        """A post is editable within 24 hours of creation."""
        return timezone.now() < self.created_at + timezone.timedelta(hours=24)


class ForumReply(models.Model):
    """A reply to a forum post. Supports one level of nesting (reply-to-reply)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name='replies')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_replies')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE,
                                related_name='children',
                                help_text="Parent reply for nested comments")
    content = models.TextField(max_length=5000)
    is_anonymous = models.BooleanField(default=False)
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.CharField(max_length=200, blank=True)
    upvotes = models.IntegerField(default=0)
    downvotes = models.IntegerField(default=0)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False)
    deleted_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='+',
    )
    deletion_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['created_at']

    @property
    def is_editable(self):
        return timezone.now() < self.created_at + timezone.timedelta(hours=24)


class PostVote(models.Model):
    """Tracks individual user votes on posts AND replies to prevent double-voting."""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, null=True, blank=True)
    reply = models.ForeignKey(ForumReply, on_delete=models.CASCADE, null=True, blank=True)
    vote_type = models.CharField(max_length=4, choices=[('up', 'Upvote'), ('down', 'Downvote')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'post'], ['user', 'reply']]


class Report(models.Model):
    """User reports on posts/replies with reasons."""

    class Reason(models.TextChoices):
        SPAM = 'spam', 'Spam or misleading'
        HARASSMENT = 'harassment', 'Harassment or bullying'
        HATE_SPEECH = 'hate_speech', 'Hate speech'
        INAPPROPRIATE = 'inappropriate', 'Inappropriate or offensive'
        MISINFORMATION = 'misinformation', 'Misinformation'
        ACADEMIC_DISHONESTY = 'academic_dishonesty', 'Academic dishonesty'
        OTHER = 'other', 'Other'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        REVIEWED = 'reviewed', 'Reviewed'
        DISMISSED = 'dismissed', 'Dismissed'
        ACTIONED = 'actioned', 'Action Taken'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_filed')
    post = models.ForeignKey(ForumPost, null=True, blank=True, on_delete=models.CASCADE, related_name='reports')
    reply = models.ForeignKey(ForumReply, null=True, blank=True, on_delete=models.CASCADE, related_name='reports')
    reason = models.CharField(max_length=30, choices=Reason.choices)
    details = models.TextField(blank=True, max_length=1000)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='reports_reviewed')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class ModerationLog(models.Model):
    """Records admin moderation actions."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin = models.ForeignKey(User, on_delete=models.CASCADE, related_name='moderation_actions')
    target_type = models.CharField(max_length=10)
    target_id = models.UUIDField()
    action = models.CharField(max_length=20)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
