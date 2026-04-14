from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from django.db.models import Avg
from .models import AvailabilitySlot, Booking, PaymentRecord, Review
from accounts.models import TutorProfile
from .serializers import (
    AvailabilitySlotSerializer, BookingSerializer, BookingCreateSerializer,
    ReviewSerializer, ReviewCreateSerializer, PaymentRecordSerializer
)

class AvailabilityListCreateView(generics.ListCreateAPIView):
    serializer_class = AvailabilitySlotSerializer

    def get_queryset(self):
        tutor_id = self.kwargs.get('tutor_id')
        if tutor_id:
            return AvailabilitySlot.objects.filter(tutor__user__id=tutor_id, is_booked=False)
        if self.request.user.role == 'tutor':
            return AvailabilitySlot.objects.filter(tutor=self.request.user.tutor_profile)
        return AvailabilitySlot.objects.none()

    def perform_create(self, serializer):
        serializer.save(tutor=self.request.user.tutor_profile)

class AvailabilityDeleteView(generics.DestroyAPIView):
    serializer_class = AvailabilitySlotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AvailabilitySlot.objects.filter(tutor=self.request.user.tutor_profile, is_booked=False)

class BookingCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            slot = AvailabilitySlot.objects.get(id=data['slot_id'], is_booked=False)
        except AvailabilitySlot.DoesNotExist:
            return Response({'error': 'Slot not available.'}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent tutors from booking themselves
        if request.user.id == slot.tutor.user.id:
            return Response({'error': 'You cannot book a session with yourself.'}, status=status.HTTP_400_BAD_REQUEST)

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

        # Create mock payment
        PaymentRecord.objects.create(
            booking=booking,
            amount=booking.price,
            transaction_id=f'test_txn_{booking.id}',
            status=PaymentRecord.PaymentStatus.COMPLETED,
        )
        booking.status = Booking.Status.CONFIRMED
        booking.save()

        # Notify the tutor about the new booking
        from accounts.models import Notification
        Notification.objects.create(
            user=slot.tutor.user,
            notification_type='booking_confirmed',
            title='New Booking',
            message=f'{request.user.display_name} booked a {data["subject"]} session on {slot.date} at {slot.start_time}.',
            link='/tutor-dashboard',
        )

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)

class BookingListView(generics.ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return Booking.objects.filter(student=user).select_related('tutor__user', 'slot')
        elif user.role == 'tutor':
            return Booking.objects.filter(tutor=user.tutor_profile).select_related('student', 'slot')
        return Booking.objects.none()

class BookingActionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, action):
        try:
            booking = Booking.objects.get(id=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if action == 'accept' and request.user.role == 'tutor':
            booking.status = Booking.Status.CONFIRMED
        elif action == 'cancel':
            booking.status = Booking.Status.CANCELLED
            booking.slot.is_booked = False
            booking.slot.save()
        elif action == 'complete' and request.user.role == 'tutor':
            booking.status = Booking.Status.COMPLETED
        else:
            return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

        booking.save()
        return Response(BookingSerializer(booking).data)

class ReviewCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            booking = Booking.objects.get(id=data['booking_id'], student=request.user, status='completed')
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found or not completed.'}, status=status.HTTP_400_BAD_REQUEST)

        if Review.objects.filter(booking=booking).exists():
            return Response({'error': 'Already reviewed.'}, status=status.HTTP_400_BAD_REQUEST)

        review = Review.objects.create(
            booking=booking, student=request.user, tutor=booking.tutor,
            rating=data['rating'], comment=data['comment'],
        )

        # Update tutor average rating
        tutor = booking.tutor
        avg = Review.objects.filter(tutor=tutor).aggregate(avg=Avg('rating'))['avg']
        tutor.average_rating = avg or 0
        tutor.total_reviews = Review.objects.filter(tutor=tutor).count()
        tutor.save()

        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)

class TutorReviewsView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        tutor_id = self.kwargs['tutor_id']
        return Review.objects.filter(tutor__user__id=tutor_id)
