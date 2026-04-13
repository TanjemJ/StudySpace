from django.urls import path
from . import views
urlpatterns = [
    path("conversations/", views.ConversationListView.as_view()),
    path("conversations/<uuid:pk>/", views.ConversationDetailView.as_view()),
    path("send/", views.SendMessageView.as_view()),
]
