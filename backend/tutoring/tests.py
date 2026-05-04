from django.test import SimpleTestCase
from django.urls import resolve

from . import views


BOOKING_ID = '00000000-0000-0000-0000-000000000001'
CHANGE_REQUEST_ID = '00000000-0000-0000-0000-000000000002'
REVIEW_ID = '00000000-0000-0000-0000-000000000003'
TUTOR_USER_ID = '00000000-0000-0000-0000-000000000004'


class TutoringUrlRoutingTests(SimpleTestCase):
    def test_change_request_create_route_is_not_caught_by_booking_action(self):
        match = resolve(f'/api/tutoring/bookings/{BOOKING_ID}/change-requests/')

        self.assertIs(match.func.view_class, views.BookingChangeRequestCreateView)

    def test_booking_documents_route_is_not_caught_by_booking_action(self):
        match = resolve(f'/api/tutoring/bookings/{BOOKING_ID}/documents/')

        self.assertIs(match.func.view_class, views.BookingDocumentListCreateView)

    def test_generic_booking_action_route_still_resolves(self):
        match = resolve(f'/api/tutoring/bookings/{BOOKING_ID}/accept/')

        self.assertIs(match.func.view_class, views.BookingActionView)

    def test_change_request_action_route_resolves(self):
        match = resolve(f'/api/tutoring/change-requests/{CHANGE_REQUEST_ID}/accept/')

        self.assertIs(match.func.view_class, views.BookingChangeRequestActionView)

    def test_review_manage_route_resolves(self):
        match = resolve(f'/api/tutoring/reviews/manage/{REVIEW_ID}/')

        self.assertIs(match.func.view_class, views.ReviewDetailView)

    def test_tutor_reviews_route_still_resolves(self):
        match = resolve(f'/api/tutoring/reviews/{TUTOR_USER_ID}/')

        self.assertIs(match.func.view_class, views.TutorReviewsView)
