from datetime import datetime, timedelta
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response
from django.db.models import Avg

from .models import AvailabilitySlot, Booking, PaymentRecord, Review
from accounts.models import Notification
from .serializers import (
    AvailabilitySlotSerializer, BookingSerializer, BookingCreateSerializer,
    ReviewSerializer, ReviewCreateSerializer,
)


# ============================================================================
# Availability
# ============================================================================

class AvailabilityListCreateView(generics.ListCreateAPIView):
    serializer_class = AvailabilitySlotSerializer

    def get_queryset(self):
        tutor_id = self.kwargs.get('tutor_id')
        if tutor_id:
            return AvailabilitySlot.objects.filter(
                tutor__user__id=tutor_id, is_booked=False,
            )
        if self.request.user.is_authenticated and self.request.user.role == 'tutor':
            qs = AvailabilitySlot.objects.filter(tutor=self.request.user.tutor_profile)
            date_from = self.request.query_params.get('from')
            date_to = self.request.query_params.get('to')
            if date_from:
                qs = qs.filter(date__gte=date_from)
            if date_to:
                qs = qs.filter(date__lte=date_to)
            return qs.order_by('date', 'start_time')
        return AvailabilitySlot.objects.none()

    def create(self, request, *args, **kwargs):
        """Create one slot, or 8 weekly-recurring slots if repeat_weekly=True."""
        data = request.data
        tutor_profile = request.user.tutor_profile
        repeat = str(data.get('repeat_weekly', '')).lower() in ('true', '1', 'yes')

        try:
            base_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except (KeyError, ValueError):
            return Response({'error': 'Valid date (YYYY-MM-DD) required.'}, status=400)

        iterations = 8 if repeat else 1
        created = []
        skipped = 0
        for i in range(iterations):
            d = base_date + timedelta(weeks=i)
            slot, was_new = AvailabilitySlot.objects.get_or_create(
                tutor=tutor_profile, date=d,
                start_time=data['start_time'],
                defaults={'end_time': data['end_time']},
            )
            if was_new:
                created.append(slot)
            else:
                skipped += 1

        return Response({
            'created': AvailabilitySlotSerializer(created, many=True).data,
            'created_count': len(created),
            'skipped': skipped,
        }, status=201)


class AvailabilityDeleteView(generics.DestroyAPIView):
    serializer_class = AvailabilitySlotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AvailabilitySlot.objects.filter(
            tutor=self.request.user.tutor_profile, is_booked=False,
        )


# ============================================================================
# Bookings
# ============================================================================

class BookingCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            slot = AvailabilitySlot.objects.get(id=data['slot_id'], is_booked=False)
        except AvailabilitySlot.DoesNotExist:
            return Response({'error': 'Slot not available.'}, status=400)

        if request.user.id == slot.tutor.user.id:
            return Response({'error': 'You cannot book a session with yourself.'}, status=400)

        booking = Booking.objects.create(
            student=request.user,
            tutor=slot.tutor,
            slot=slot,
            subject=data['subject'],
            session_type=data.get('session_type', 'video'),
            student_note=data.get('student_note', ''),
            price=slot.tutor.hourly_rate,
            status=Booking.Status.PENDING,
        )
        slot.is_booked = True
        slot.save()

        PaymentRecord.objects.create(
            booking=booking,
            amount=booking.price,
            transaction_id=f'test_txn_{booking.id}',
            status=PaymentRecord.PaymentStatus.COMPLETED,
        )

        Notification.objects.create(
            user=slot.tutor.user,
            notification_type='booking_confirmed',
            title='New booking request',
            message=f'{request.user.display_name} requested a {data["subject"]} session '
                    f'on {slot.date} at {slot.start_time}.',
            link='/tutor-dashboard',
        )

        return Response(BookingSerializer(booking).data, status=201)


class BookingListView(generics.ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            qs = Booking.objects.filter(student=user)
        elif user.role == 'tutor' and hasattr(user, 'tutor_profile'):
            qs = Booking.objects.filter(tutor=user.tutor_profile)
        elif user.role == 'admin':
            qs = Booking.objects.all()
        else:
            return Booking.objects.none()

        qs = qs.select_related('tutor__user', 'student', 'slot')

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs


class BookingActionView(views.APIView):
    """
    Mutate a booking's status.

    Permitted transitions:
        pending           -> confirmed        (tutor: accept)
        pending           -> cancelled        (tutor: decline)
        pending           -> change_requested (tutor: request_change)
        change_requested  -> confirmed        (student: accept_change)     NEW
        change_requested  -> cancelled        (student: decline_change)    NEW
        confirmed         -> cancelled        (either: cancel)
        pending           -> cancelled        (either: cancel)
        confirmed         -> completed        (tutor: complete)
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, action):
        try:
            booking = Booking.objects.select_related(
                'tutor__user', 'student', 'slot',
            ).get(id=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=404)

        user = request.user
        is_tutor = (hasattr(user, 'tutor_profile') and
                    booking.tutor == user.tutor_profile)
        is_student = booking.student == user

        # ---- accept (tutor) ----
        if action == 'accept':
            if not is_tutor:
                return Response({'error': 'Only the tutor can accept.'}, status=403)
            if booking.status != Booking.Status.PENDING:
                return Response({'error': 'Only pending bookings can be accepted.'}, status=400)
            booking.status = Booking.Status.CONFIRMED
            booking.save()
            Notification.objects.create(
                user=booking.student,
                notification_type='booking_confirmed',
                title='Booking confirmed',
                message=(f'{booking.tutor.user.display_name} accepted your session on '
                         f'{booking.slot.date} at {booking.slot.start_time}.'),
                link='/bookings',
            )
            return Response(BookingSerializer(booking).data)

        # ---- decline (tutor) ----
        if action == 'decline':
            if not is_tutor:
                return Response({'error': 'Only the tutor can decline.'}, status=403)
            if booking.status != Booking.Status.PENDING:
                return Response({'error': 'Only pending bookings can be declined.'}, status=400)
            reason = (request.data.get('reason') or '').strip()
            booking.status = Booking.Status.CANCELLED
            if hasattr(booking, 'tutor_note'):
                booking.tutor_note = reason
            booking.save()
            booking.slot.is_booked = False
            booking.slot.save()
            Notification.objects.create(
                user=booking.student,
                notification_type='booking_cancelled',
                title='Booking declined',
                message=(f'{booking.tutor.user.display_name} could not accept this booking. '
                         f'{"Reason: " + reason if reason else ""}'),
                link='/bookings',
            )
            return Response(BookingSerializer(booking).data)

        # ---- request_change (tutor) ----
        if action == 'request_change':
            if not is_tutor:
                return Response({'error': 'Only the tutor can request changes.'}, status=403)
            if booking.status != Booking.Status.PENDING:
                return Response({'error': 'Only pending bookings can have change requests.'},
                                status=400)
            message = (request.data.get('message') or '').strip()
            if not message:
                return Response({'error': 'A message is required when requesting a change.'},
                                status=400)

            booking.status = Booking.Status.CHANGE_REQUESTED
            if hasattr(booking, 'tutor_note'):
                booking.tutor_note = message
            booking.save()
            Notification.objects.create(
                user=booking.student,
                notification_type='booking_confirmed',
                title='Tutor requested a change to your booking',
                message=f'{booking.tutor.user.display_name}: "{message}". '
                        f'Open Bookings to respond.',
                link='/bookings',
            )
            return Response(BookingSerializer(booking).data)

        # ---- accept_change (student) [NEW] ----
        if action == 'accept_change':
            if not is_student:
                return Response({'error': 'Only the student can accept the change.'},
                                status=403)
            if booking.status != Booking.Status.CHANGE_REQUESTED:
                return Response({'error': 'This booking has no pending change request.'},
                                status=400)
            booking.status = Booking.Status.CONFIRMED
            booking.save()
            Notification.objects.create(
                user=booking.tutor.user,
                notification_type='booking_confirmed',
                title='Student accepted the changes',
                message=(f'{booking.student.display_name} agreed to your suggested change. '
                         f'The session is now confirmed.'),
                link='/tutor-dashboard',
            )
            return Response(BookingSerializer(booking).data)

        # ---- decline_change (student) [NEW] ----
        if action == 'decline_change':
            if not is_student:
                return Response({'error': 'Only the student can decline the change.'},
                                status=403)
            if booking.status != Booking.Status.CHANGE_REQUESTED:
                return Response({'error': 'This booking has no pending change request.'},
                                status=400)
            booking.status = Booking.Status.CANCELLED
            booking.save()
            booking.slot.is_booked = False
            booking.slot.save()
            Notification.objects.create(
                user=booking.tutor.user,
                notification_type='booking_cancelled',
                title='Student declined the changes',
                message=(f'{booking.student.display_name} could not accept your suggested '
                         f'change, so the booking has been cancelled.'),
                link='/tutor-dashboard',
            )
            return Response(BookingSerializer(booking).data)

        # ---- cancel (student or tutor) ----
        if action == 'cancel':
            if not (is_student or is_tutor):
                return Response({'error': 'You are not part of this booking.'}, status=403)
            if booking.status == Booking.Status.COMPLETED:
                return Response({'error': 'Cannot cancel a completed session.'}, status=400)
            booking.status = Booking.Status.CANCELLED
            booking.save()
            if booking.slot.is_booked:
                booking.slot.is_booked = False
                booking.slot.save()
            other_user = booking.tutor.user if is_student else booking.student
            Notification.objects.create(
                user=other_user,
                notification_type='booking_cancelled',
                title='Session cancelled',
                message=f'The session on {booking.slot.date} at {booking.slot.start_time} was cancelled.',
                link='/bookings',
            )
            return Response(BookingSerializer(booking).data)

        # ---- complete (tutor) ----
        if action == 'complete':
            if not is_tutor:
                return Response({'error': 'Only the tutor can complete a session.'},
                                status=403)
            if booking.status != Booking.Status.CONFIRMED:
                return Response({'error': 'Only confirmed sessions can be completed.'},
                                status=400)
            booking.status = Booking.Status.COMPLETED
            booking.save()
            booking.tutor.total_sessions = Booking.objects.filter(
                tutor=booking.tutor, status='completed',
            ).count()
            booking.tutor.save()
            Notification.objects.create(
                user=booking.student,
                notification_type='forum_reply',
                title='How was your session?',
                message=f'Leave a review for {booking.tutor.user.display_name}.',
                link='/bookings',
            )
            return Response(BookingSerializer(booking).data)

        return Response({'error': 'Unknown action.'}, status=400)


# ============================================================================
# Reviews
# ============================================================================

class ReviewCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            booking = Booking.objects.get(
                id=data['booking_id'], student=request.user, status='completed',
            )
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found or not completed.'}, status=400)

        if Review.objects.filter(booking=booking).exists():
            return Response({'error': 'Already reviewed.'}, status=400)

        review = Review.objects.create(
            booking=booking, student=request.user, tutor=booking.tutor,
            rating=data['rating'], comment=data['comment'],
        )

        tutor = booking.tutor
        avg = Review.objects.filter(tutor=tutor).aggregate(avg=Avg('rating'))['avg']
        tutor.average_rating = round(avg, 1) if avg else 0
        tutor.total_reviews = Review.objects.filter(tutor=tutor).count()
        tutor.save()

        Notification.objects.create(
            user=tutor.user,
            notification_type='forum_reply',
            title=f'{request.user.display_name} left you a {data["rating"]}-star review',
            message=(data['comment'] or '')[:100],
            link=f'/tutors/{tutor.user.id}',
        )

        return Response(ReviewSerializer(review).data, status=201)


class TutorReviewsView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        tutor_id = self.kwargs['tutor_id']
        return Review.objects.filter(tutor__user__id=tutor_id)
