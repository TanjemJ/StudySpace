from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/tutoring/', include('tutoring.urls')),
    path('api/forum/', include('forum.urls')),
    path('api/ai/', include('ai_assistant.urls')),
    path('api/messages/', include('messaging.urls')),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
