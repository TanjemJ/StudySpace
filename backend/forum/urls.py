from django.urls import path
from . import views
urlpatterns = [
    path("categories/", views.CategoryListView.as_view()),
    path("posts/", views.PostListView.as_view()),
    path("posts/create/", views.PostCreateView.as_view()),
    path("posts/<uuid:pk>/", views.PostDetailView.as_view()),
    path("posts/<uuid:post_id>/replies/", views.ReplyListCreateView.as_view()),
    path("posts/<uuid:post_id>/vote/", views.VoteView.as_view()),
]
