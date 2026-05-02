from django.urls import path
from . import views

urlpatterns = [
    # Availability
    path('availability/', views.AvailabilityListCreateView.as_view(), name='my-availability'),
    path('availability/<uuid:tutor_id>/', views.AvailabilityListCreateView.as_view(),
         name='tutor-availability'),
    path('availability/<uuid:pk>/delete/', views.AvailabilityDeleteView.as_view(),
         name='delete-availability'),

    # Stripe payments
    path('payments/stripe/connect/status/', views.StripeConnectStatusView.as_view(),
         name='stripe-connect-status'),
    path('payments/stripe/connect/onboarding/', views.StripeConnectOnboardingView.as_view(),
         name='stripe-connect-onboarding'),
    path('payments/stripe/webhook/', views.StripeWebhookView.as_view(),
         name='stripe-webhook'),

    # Bookings
    path('bookings/', views.BookingListView.as_view(), name='booking-list'),
    path('bookings/create/', views.BookingCreateView.as_view(), name='booking-create'),
    path('bookings/<uuid:pk>/', views.BookingDetailView.as_view(), name='booking-detail'),
    path('bookings/<uuid:pk>/checkout/', views.BookingCheckoutResumeView.as_view(),
         name='booking-checkout-resume'),
    path('bookings/<uuid:pk>/<str:action>/', views.BookingActionView.as_view(),
         name='booking-action'),

    # Change requests (NEW in Update 7)
    path('bookings/<uuid:booking_id>/change-requests/',
         views.BookingChangeRequestCreateView.as_view(),
         name='change-request-create'),
    path('change-requests/<uuid:cr_id>/<str:action>/',
         views.BookingChangeRequestActionView.as_view(),
         name='change-request-action'),

    # Documents (NEW in Update 7)
    path('bookings/<uuid:booking_id>/documents/',
         views.BookingDocumentListCreateView.as_view(),
         name='booking-documents'),
    path('bookings/documents/<uuid:doc_id>/',
         views.BookingDocumentDeleteView.as_view(),
         name='booking-document-delete'),

    # Reviews
    path('reviews/create/', views.ReviewCreateView.as_view(), name='review-create'),
    path('reviews/<uuid:tutor_id>/', views.TutorReviewsView.as_view(), name='tutor-reviews'),
]
