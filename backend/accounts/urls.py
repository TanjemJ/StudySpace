"""
Updated accounts URL routes.

Changes vs. previous version:
- Added dashboard stats endpoints (student/tutor/admin)
- Added admin verification queue + action endpoints
- RegisterTutorStep5View now points at the multi-document version

All other routes are unchanged so existing API callers keep working.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views
from . import settings_views
from . import views_notifications
from . import public_profile_view
from . import dashboard_views
from . import admin_views
from .tutor_docs_view import RegisterTutorStep5View

urlpatterns = [
    # ===== Multi-step registration =====
    path('register/step1/', views.RegisterStep1View.as_view(), name='register-step1'),
    path('register/verify-code/', views.VerifyEmailCodeView.as_view(), name='verify-code'),
    path('register/resend-code/', views.ResendCodeView.as_view(), name='resend-code'),
    path('register/step2/', views.RegisterStep2View.as_view(), name='register-step2'),
    path('register/step3/student/', views.RegisterStep3StudentView.as_view(), name='register-step3-student'),
    path('register/step3/tutor/', views.RegisterTutorStep3View.as_view(), name='register-step3-tutor'),
    path('register/step4/tutor/', views.RegisterTutorStep4View.as_view(), name='register-step4-tutor'),
    # Step 5 now uses the multi-document upload view
    path('register/step5/tutor/', RegisterTutorStep5View.as_view(), name='register-step5-tutor'),

    # ===== Auth =====
    path('login/', views.LoginView.as_view(), name='login'),
    path('google/', views.GoogleLoginView.as_view(), name='google-login'),
    path('microsoft/', views.MicrosoftLoginView.as_view(), name='microsoft-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', views.MeView.as_view(), name='me'),

    # ===== Dashboard stats (NEW) =====
    path('dashboard-stats/student/', dashboard_views.StudentDashboardStatsView.as_view(),
         name='dashboard-stats-student'),
    path('dashboard-stats/tutor/', dashboard_views.TutorDashboardStatsView.as_view(),
         name='dashboard-stats-tutor'),
    path('dashboard-stats/admin/', dashboard_views.AdminDashboardStatsView.as_view(),
         name='dashboard-stats-admin'),

    # ===== Admin verification (NEW) =====
    path('admin/verification-queue/', admin_views.AdminVerificationQueueView.as_view(),
         name='admin-verification-queue'),
    path('admin/verification/<uuid:tutor_id>/<str:action>/',
         admin_views.AdminVerificationActionView.as_view(),
         name='admin-verification-action'),

    # ===== Utils =====
    path('check-username/', views.CheckUsernameView.as_view(), name='check-username'),

    # ===== Tutors (public) =====
    path('tutors/', views.TutorSearchView.as_view(), name='tutor-search'),
    path('tutors/<uuid:user_id>/', views.TutorDetailView.as_view(), name='tutor-detail'),

    # ===== Public user profile (any role) =====
    path('users/<uuid:user_id>/', public_profile_view.PublicProfileView.as_view(),
         name='user-public-profile'),

    # ===== Notifications =====
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/<uuid:pk>/read/', views.NotificationMarkReadView.as_view(),
         name='notification-read'),
    path('notifications/mark-all-read/', views_notifications.MarkAllNotificationsReadView.as_view(),
         name='notifications-mark-all'),
    path('notifications/unread-count/', views_notifications.UnreadCountView.as_view(),
         name='notifications-unread'),

    # ===== Settings =====
    path('settings/profile/', settings_views.UpdateProfileView.as_view(), name='settings-profile'),
    path('settings/display-name/', settings_views.ChangeDisplayNameView.as_view(),
         name='settings-display-name'),
    path('settings/password/', settings_views.ChangePasswordView.as_view(),
         name='settings-password'),
    path('settings/avatar/', settings_views.UploadAvatarView.as_view(), name='settings-avatar'),
    path('settings/notifications/', settings_views.UpdateNotificationPrefsView.as_view(),
         name='settings-notifications'),
    path('settings/accessibility/', settings_views.UpdateAccessibilityView.as_view(),
         name='settings-accessibility'),
    path('settings/delete-account/', settings_views.DeleteAccountView.as_view(),
         name='settings-delete-account'),
    path('settings/university-email/send/', settings_views.SendUniversityVerificationCodeView.as_view(),
         name='settings-university-email-send'),
    path('settings/university-email/verify/', settings_views.VerifyUniversityEmailCodeView.as_view(),
         name='settings-university-email-verify'),


    # ===== Contact =====
    path('contact/', settings_views.ContactFormView.as_view(), name='contact'),
]
