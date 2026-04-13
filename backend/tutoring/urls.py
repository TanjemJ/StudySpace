from django.urls import path
from . import views

urlpatterns = [
    path('availability/', views.AvailabilityListCreateView.as_view(), name='my-availability'),
    path('availability/<uuid:tutor_id>/', views.AvailabilityListCreateView.as_view(), name='tutor-availability'),
    path('availability/<uuid:pk>/delete/', views.AvailabilityDeleteView.as_view(), name='delete-availability'),
    path('bookings/', views.BookingListView.as_view(), name='booking-list'),
    path('bookings/create/', views.BookingCreateView.as_view(), name='booking-create'),
    path('bookings/<uuid:pk>/<str:action>/', views.BookingActionView.as_view(), name='booking-action'),
    path('reviews/create/', views.ReviewCreateView.as_view(), name='review-create'),
    path('reviews/<uuid:tutor_id>/', views.TutorReviewsView.as_view(), name='tutor-reviews'),
]
