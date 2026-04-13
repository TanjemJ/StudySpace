from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from . import settings_views

urlpatterns = [
    # Multi-step registration
    path('register/step1/', views.RegisterStep1View.as_view(), name='register-step1'),
    path('register/verify-code/', views.VerifyEmailCodeView.as_view(), name='verify-code'),
    path('register/resend-code/', views.ResendCodeView.as_view(), name='resend-code'),
    path('register/step2/', views.RegisterStep2View.as_view(), name='register-step2'),
    path('register/step3/student/', views.RegisterStep3StudentView.as_view(), name='register-step3-student'),
    path('register/step3/tutor/', views.RegisterTutorStep3View.as_view(), name='register-step3-tutor'),
    path('register/step4/tutor/', views.RegisterTutorStep4View.as_view(), name='register-step4-tutor'),
    path('register/step5/tutor/', views.RegisterTutorStep5View.as_view(), name='register-step5-tutor'),
    # Auth
    path('login/', views.LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', views.MeView.as_view(), name='me'),
    # Utils
    path('check-username/', views.CheckUsernameView.as_view(), name='check-username'),
    # Tutors (public)
    path('tutors/', views.TutorSearchView.as_view(), name='tutor-search'),
    path('tutors/<uuid:user_id>/', views.TutorDetailView.as_view(), name='tutor-detail'),
    # Notifications
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/<uuid:pk>/read/', views.NotificationMarkReadView.as_view(), name='notification-read'),
    # Settings
    path('settings/profile/', settings_views.UpdateProfileView.as_view(), name='settings-profile'),
    path('settings/display-name/', settings_views.ChangeDisplayNameView.as_view(), name='settings-display-name'),
    path('settings/password/', settings_views.ChangePasswordView.as_view(), name='settings-password'),
    path('settings/avatar/', settings_views.UploadAvatarView.as_view(), name='settings-avatar'),
    path('settings/notifications/', settings_views.UpdateNotificationPrefsView.as_view(), name='settings-notifications'),
    path('settings/accessibility/', settings_views.UpdateAccessibilityView.as_view(), name='settings-accessibility'),
    path('settings/delete-account/', settings_views.DeleteAccountView.as_view(), name='settings-delete-account'),
]
