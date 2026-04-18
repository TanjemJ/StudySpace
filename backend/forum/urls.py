"""
Forum URL routes.

Adds admin moderation endpoints. All other routes are unchanged.
"""
from django.urls import path
from . import views
from . import admin_views

urlpatterns = [
    # Existing public routes
    path('categories/', views.CategoryListView.as_view()),
    path('universities/', views.UniversityListView.as_view()),
    path('stats/', views.ForumStatsView.as_view()),

    # Posts
    path('posts/', views.PostListView.as_view()),
    path('posts/create/', views.PostCreateView.as_view()),
    path('posts/<uuid:pk>/', views.PostDetailView.as_view()),
    path('posts/<uuid:pk>/edit/', views.PostEditView.as_view()),
    path('posts/<uuid:post_id>/vote/', views.PostVoteView.as_view()),
    path('posts/<uuid:post_id>/report/', views.ReportPostView.as_view()),

    # Replies
    path('posts/<uuid:post_id>/replies/', views.ReplyListCreateView.as_view()),
    path('replies/<uuid:pk>/edit/', views.ReplyEditView.as_view()),
    path('replies/<uuid:reply_id>/vote/', views.ReplyVoteView.as_view()),
    path('replies/<uuid:reply_id>/report/', views.ReportReplyView.as_view()),

    # ===== NEW: Admin moderation =====
    path('admin/flagged/', admin_views.AdminFlaggedContentView.as_view(),
         name='admin-flagged-content'),
    path('admin/posts/<uuid:pk>/delete/', admin_views.AdminDeletePostView.as_view(),
         name='admin-delete-post'),
    path('admin/replies/<uuid:pk>/delete/', admin_views.AdminDeleteReplyView.as_view(),
         name='admin-delete-reply'),
]
