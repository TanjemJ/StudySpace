from datetime import datetime, timedelta
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.db.models import Avg

from .models import (
    AvailabilitySlot, Booking, PaymentRecord, Review,
    BookingChangeRequest, BookingDocument,
)
from accounts.models import Notification
from .serializers import (
    AvailabilitySlotSerializer, BookingSerializer, BookingCreateSerializer,
    ReviewSerializer, ReviewCreateSerializer,
    BookingChangeRequestSerializer, BookingDocumentSerializer,
)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

MAX_DOCS_PER_BOOKING = 5
MAX_DOC_SIZE_MB = 10
ALLOWED_DOC_EXTS = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.txt'}


def _hours_until(booking):
    """Hours (float) from now until the session starts. Negative = past."""
    try:
        dt = datetime.combine(booking.slot.date, booking.slot.start_time)
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return (dt - timezone.now()).total_seconds() / 3600
    except Exception:
        return 0


def _refund_tier(booking):
    """Tiered refund logic — returns (percent, label)."""
    h = _hours_until(booking)
    if h > 72:
        return 100, 'Full refund'
    if h > 24:
        return 50, '50% refund'
    return 0, 'No refund'


def _is_tutor_of(user, booking):
    return hasattr(user, 'tutor_profile') and booking.tutor == user.tutor_profile


def _is_student_of(user, booking):
    return booking.student == user


# --------------------------------------------------------------------------
# Availability
# --------------------------------------------------------------------------

class AvailabilityListCreateView(generics.ListCreateAPIView):
    serializer_class = AvailabilitySlotSerializer

    def get_queryset(self):
        tutor_id = self.kwargs.get('tutor_id')
        today = timezone.localdate()
        if tutor_id:
            # Public endpoint: only show future unbooked slots
            return AvailabilitySlot.objects.filter(
                tutor__user__id=tutor_id,
                is_booked=False,
                date__gte=today,
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
        data = request.data
        tutor_profile = request.user.tutor_profile
        repeat = str(data.get('repeat_weekly', '')).lower() in ('true', '1', 'yes')

        try:
            base_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except (KeyError, ValueError):
            return Response({'error': 'Valid date (YYYY-MM-DD) required.'}, status=400)

        if base_date < timezone.localdate():
            return Response({'error': 'Cannot create availability in the past.'}, status=400)

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


# --------------------------------------------------------------------------
# Bookings
# --------------------------------------------------------------------------

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

        if slot.date < timezone.localdate():
            return Response({'error': 'Cannot book a slot in the past.'}, status=400)

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
            message=(f'{request.user.display_name} requested a {data["subject"]} session '
                     f'on {slot.date} at {slot.start_time}.'),
            link='/tutor-dashboard',
        )

        return Response(BookingSerializer(booking, context={'request': request}).data, status=201)


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

        qs = qs.select_related('tutor__user', 'student', 'slot').prefetch_related(
            'documents', 'change_requests',
        )

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    def get_serializer_context(self):
        return {'request': self.request}


class BookingDetailView(generics.RetrieveAPIView):
    """Single booking detail — used to refetch after actions."""
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        if user.role == 'admin':
            return Booking.objects.all()
        q = Q(student=user)
        if hasattr(user, 'tutor_profile'):
            q |= Q(tutor=user.tutor_profile)
        return Booking.objects.filter(q).select_related(
            'tutor__user', 'student', 'slot',
        ).prefetch_related('documents', 'change_requests')

    def get_serializer_context(self):
        return {'request': self.request}


class BookingActionView(views.APIView):
    """
    Mutate a booking's status.

    Actions:
        accept (tutor only, pending -> confirmed)
        decline (tutor only, pending -> cancelled)
        complete (tutor only, confirmed -> completed)
        cancel (either side — uses tiered refund logic)
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
        is_tutor = _is_tutor_of(user, booking)
        is_student = _is_student_of(user, booking)

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
            return Response(BookingSerializer(booking, context={'request': request}).data)

        # ---- decline (tutor) ----
        if action == 'decline':
            if not is_tutor:
                return Response({'error': 'Only the tutor can decline.'}, status=403)
            if booking.status != Booking.Status.PENDING:
                return Response({'error': 'Only pending bookings can be declined.'}, status=400)
            reason = (request.data.get('reason') or '').strip()
            with transaction.atomic():
                booking.status = Booking.Status.CANCELLED
                booking.cancelled_at = timezone.now()
                booking.cancelled_by = user
                booking.refund_percent = 100  # tutor declined — student gets full refund
                booking.tutor_note = reason
                booking.save()
                booking.slot.is_booked = False
                booking.slot.save()
                _apply_refund(booking, 100)
            Notification.objects.create(
                user=booking.student,
                notification_type='booking_cancelled',
                title='Booking declined',
                message=(f'{booking.tutor.user.display_name} could not accept this booking — '
                         f'you will receive a full refund.'
                         f'{" Reason: " + reason if reason else ""}'),
                link='/bookings',
            )
            return Response(BookingSerializer(booking, context={'request': request}).data)

        # ---- complete (tutor) ----
        if action == 'complete':
            if not is_tutor:
                return Response({'error': 'Only the tutor can complete a session.'}, status=403)
            if booking.status != Booking.Status.CONFIRMED:
                return Response({'error': 'Only confirmed sessions can be completed.'}, status=400)
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
            return Response(BookingSerializer(booking, context={'request': request}).data)

        # ---- cancel (either side, with tiered refund) ----
        if action == 'cancel':
            if not (is_student or is_tutor):
                return Response({'error': 'You are not part of this booking.'}, status=403)
            if booking.status == Booking.Status.COMPLETED:
                return Response({'error': 'Cannot cancel a completed session.'}, status=400)
            if booking.status == Booking.Status.CANCELLED:
                return Response({'error': 'Booking is already cancelled.'}, status=400)

            # Tutors declining a booking they haven't yet accepted should use /decline/
            # which always gives a full refund. Cancel is for after-accept cancellations.

            # Calculate refund tier — if the tutor is cancelling, always full refund;
            # otherwise use time-based tiering.
            if is_tutor:
                refund_pct, refund_label = 100, 'Full refund (tutor cancelled)'
            else:
                refund_pct, refund_label = _refund_tier(booking)

            with transaction.atomic():
                booking.status = Booking.Status.CANCELLED
                booking.cancelled_at = timezone.now()
                booking.cancelled_by = user
                booking.refund_percent = refund_pct
                booking.save()
                booking.slot.is_booked = False
                booking.slot.save()
                _apply_refund(booking, refund_pct)

            # Withdraw any pending change requests
            BookingChangeRequest.objects.filter(
                booking=booking, status='pending',
            ).update(status='withdrawn', resolved_at=timezone.now())

            other_user = booking.tutor.user if is_student else booking.student
            Notification.objects.create(
                user=other_user,
                notification_type='booking_cancelled',
                title='Session cancelled',
                message=(f'The session on {booking.slot.date} at {booking.slot.start_time} '
                         f'was cancelled by {user.display_name}. {refund_label}.'),
                link='/bookings',
            )
            return Response(BookingSerializer(booking, context={'request': request}).data)

        return Response({'error': 'Unknown action.'}, status=400)


def _apply_refund(booking, percent):
    """Record the refund against the payment."""
    try:
        payment = booking.payment
    except PaymentRecord.DoesNotExist:
        return
    if percent >= 100:
        payment.refunded_amount = payment.amount
        payment.status = PaymentRecord.PaymentStatus.REFUNDED
    elif percent > 0:
        payment.refunded_amount = (payment.amount * Decimal(percent) / Decimal(100)).quantize(Decimal('0.01'))
        payment.status = PaymentRecord.PaymentStatus.PARTIALLY_REFUNDED
    else:
        payment.refunded_amount = Decimal(0)
    payment.save()


# --------------------------------------------------------------------------
# Change requests
# --------------------------------------------------------------------------

class BookingChangeRequestCreateView(views.APIView):
    """
    Create a change request on a booking.

    Either party can request changes to date, time, or session_type on
    bookings that are pending or confirmed. At least one proposed field
    must differ from the current booking.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        try:
            booking = Booking.objects.select_related('slot').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=404)

        user = request.user
        is_tutor = _is_tutor_of(user, booking)
        is_student = _is_student_of(user, booking)

        if not (is_tutor or is_student):
            return Response({'error': 'You are not part of this booking.'}, status=403)

        if booking.status not in (Booking.Status.PENDING, Booking.Status.CONFIRMED):
            return Response({
                'error': f'Changes cannot be requested on a {booking.get_status_display().lower()} booking.',
            }, status=400)

        # Block new change requests if one is already pending
        if booking.change_requests.filter(status='pending').exists():
            return Response({
                'error': 'There is already a pending change request on this booking.',
            }, status=400)

        # Parse proposed values
        proposed_date = request.data.get('proposed_date') or None
        proposed_start = request.data.get('proposed_start_time') or None
        proposed_end = request.data.get('proposed_end_time') or None
        proposed_type = request.data.get('proposed_session_type') or ''
        message = (request.data.get('message') or '').strip()

        if not (proposed_date or proposed_start or proposed_session_type_set(proposed_type, booking)):
            return Response({
                'error': 'Please propose at least one change (date, time, or session type).',
            }, status=400)

        if proposed_type and proposed_type not in dict(Booking.SessionType.choices):
            return Response({'error': 'Invalid session type.'}, status=400)

        # Parse date/time for comparison
        try:
            pd = datetime.strptime(proposed_date, '%Y-%m-%d').date() if proposed_date else None
        except ValueError:
            return Response({'error': 'proposed_date must be YYYY-MM-DD.'}, status=400)

        if pd and pd < timezone.localdate():
            return Response({'error': 'Proposed date cannot be in the past.'}, status=400)

        cr = BookingChangeRequest.objects.create(
            booking=booking,
            requested_by=(BookingChangeRequest.RequestedBy.TUTOR if is_tutor
                          else BookingChangeRequest.RequestedBy.STUDENT),
            requested_by_user=user,
            proposed_date=pd,
            proposed_start_time=proposed_start or None,
            proposed_end_time=proposed_end or None,
            proposed_session_type=proposed_type or '',
            message=message,
        )

        # Also flip the booking status so the other side sees a clear signal.
        # (We don't change the underlying slot until the proposal is accepted.)
        if booking.status == Booking.Status.PENDING:
            booking.status = Booking.Status.CHANGE_REQUESTED
            booking.save()
        # Confirmed bookings stay confirmed visually; the pending change is
        # shown via the `pending_change` field on the serialized booking.

        other_user = booking.student if is_tutor else booking.tutor.user
        Notification.objects.create(
            user=other_user,
            notification_type='booking_confirmed',
            title=f'{user.display_name} proposed a change to your booking',
            message=(message[:120] if message else 'Open Bookings to review the proposal.'),
            link='/bookings' if other_user == booking.student else '/tutor-dashboard',
        )

        return Response(
            BookingChangeRequestSerializer(cr, context={'request': request}).data,
            status=201,
        )


def proposed_session_type_set(proposed_type, booking):
    """True if a session-type change is actually a change."""
    return bool(proposed_type) and proposed_type != booking.session_type


class BookingChangeRequestActionView(views.APIView):
    """
    Accept / decline / withdraw a pending change request.

    Rules:
      accept    — must be the OTHER party from the requester
      decline   — must be the OTHER party from the requester
      withdraw  — must be the requester themself
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, cr_id, action):
        try:
            cr = BookingChangeRequest.objects.select_related(
                'booking__slot', 'booking__tutor__user', 'booking__student',
            ).get(id=cr_id)
        except BookingChangeRequest.DoesNotExist:
            return Response({'error': 'Change request not found.'}, status=404)

        if cr.status != BookingChangeRequest.Status.PENDING:
            return Response({'error': 'This change request has already been resolved.'},
                            status=400)

        booking = cr.booking
        user = request.user
        is_tutor = _is_tutor_of(user, booking)
        is_student = _is_student_of(user, booking)
        is_requester = (cr.requested_by_user_id == user.id)

        if not (is_tutor or is_student):
            return Response({'error': 'You are not part of this booking.'}, status=403)

        # ---- withdraw (requester only) ----
        if action == 'withdraw':
            if not is_requester:
                return Response({'error': 'Only the requester can withdraw.'}, status=403)
            cr.status = BookingChangeRequest.Status.WITHDRAWN
            cr.resolved_at = timezone.now()
            cr.save()
            _restore_booking_status(booking)
            return Response(BookingChangeRequestSerializer(cr, context={'request': request}).data)

        # For accept / decline, the OTHER party must be acting
        if is_requester:
            return Response({'error': 'You cannot respond to your own change request.'},
                            status=403)

        if action == 'decline':
            cr.status = BookingChangeRequest.Status.DECLINED
            cr.resolved_at = timezone.now()
            cr.save()
            _restore_booking_status(booking)
            Notification.objects.create(
                user=cr.requested_by_user,
                notification_type='booking_confirmed',
                title='Your proposed change was declined',
                message=(f'{user.display_name} declined your change request. '
                         f'The booking continues as originally scheduled.'),
                link='/bookings' if cr.requested_by_user == booking.student else '/tutor-dashboard',
            )
            return Response(BookingChangeRequestSerializer(cr, context={'request': request}).data)

        if action == 'accept':
            with transaction.atomic():
                _apply_change_request(cr)
                cr.status = BookingChangeRequest.Status.ACCEPTED
                cr.resolved_at = timezone.now()
                cr.save()

            Notification.objects.create(
                user=cr.requested_by_user,
                notification_type='booking_confirmed',
                title='Your proposed change was accepted',
                message=(f'{user.display_name} accepted the change. '
                         f'The booking has been updated.'),
                link='/bookings' if cr.requested_by_user == booking.student else '/tutor-dashboard',
            )
            return Response(BookingChangeRequestSerializer(cr, context={'request': request}).data)

        return Response({'error': 'Unknown action.'}, status=400)


def _restore_booking_status(booking):
    """When a change is declined/withdrawn, revert CHANGE_REQUESTED -> PENDING."""
    if booking.status == Booking.Status.CHANGE_REQUESTED:
        booking.status = Booking.Status.PENDING
        booking.save()


def _apply_change_request(cr):
    """Rewrite the booking to the proposed values. Move the slot if needed."""
    booking = cr.booking
    slot = booking.slot

    new_date = cr.proposed_date or slot.date
    new_start = cr.proposed_start_time or slot.start_time
    new_end = cr.proposed_end_time or slot.end_time
    new_type = cr.proposed_session_type or booking.session_type

    date_or_time_changed = (
        new_date != slot.date or
        new_start != slot.start_time or
        new_end != slot.end_time
    )

    if date_or_time_changed:
        # Free the original slot and create a new one (or reuse existing)
        old_slot = slot
        new_slot, _ = AvailabilitySlot.objects.get_or_create(
            tutor=booking.tutor,
            date=new_date,
            start_time=new_start,
            defaults={'end_time': new_end},
        )
        # If new slot existed and is already booked by someone else — problem
        if new_slot.is_booked and new_slot.booking_id != booking.id:
            raise ValueError('Target slot is already booked.')

        new_slot.is_booked = True
        new_slot.end_time = new_end
        new_slot.save()

        # Move the booking to the new slot (OneToOneField)
        booking.slot = new_slot
        old_slot.is_booked = False
        old_slot.save()

    if new_type != booking.session_type:
        booking.session_type = new_type

    # Restore status: CHANGE_REQUESTED -> PENDING or CONFIRMED depending on prior
    if booking.status == Booking.Status.CHANGE_REQUESTED:
        booking.status = Booking.Status.PENDING
    booking.save()


# --------------------------------------------------------------------------
# Documents
# --------------------------------------------------------------------------

class BookingDocumentListCreateView(views.APIView):
    """
    GET  /bookings/<id>/documents/  — list documents on a booking
    POST /bookings/<id>/documents/  — upload a document (multipart)
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _get_booking_or_403(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return None, Response({'error': 'Booking not found.'}, status=404)
        if not (_is_tutor_of(request.user, booking)
                or _is_student_of(request.user, booking)
                or request.user.role == 'admin'):
            return None, Response({'error': 'You are not part of this booking.'}, status=403)
        return booking, None

    def get(self, request, booking_id):
        booking, err = self._get_booking_or_403(request, booking_id)
        if err:
            return err
        docs = booking.documents.all().order_by('created_at')
        return Response(BookingDocumentSerializer(docs, many=True, context={'request': request}).data)

    def post(self, request, booking_id):
        booking, err = self._get_booking_or_403(request, booking_id)
        if err:
            return err

        if booking.status == Booking.Status.COMPLETED:
            return Response({'error': 'Cannot add documents to a completed session.'}, status=400)
        if booking.status == Booking.Status.CANCELLED:
            return Response({'error': 'Cannot add documents to a cancelled booking.'}, status=400)

        if booking.documents.count() >= MAX_DOCS_PER_BOOKING:
            return Response(
                {'error': f'Maximum {MAX_DOCS_PER_BOOKING} documents per booking.'},
                status=400,
            )

        f = request.FILES.get('file')
        if not f:
            return Response({'error': 'No file provided.'}, status=400)

        if f.size > MAX_DOC_SIZE_MB * 1024 * 1024:
            return Response({'error': f'Max file size is {MAX_DOC_SIZE_MB}MB.'}, status=400)

        ext = '.' + f.name.rsplit('.', 1)[-1].lower() if '.' in f.name else ''
        if ext not in ALLOWED_DOC_EXTS:
            return Response(
                {'error': f'Allowed types: {", ".join(sorted(ALLOWED_DOC_EXTS))}'},
                status=400,
            )

        doc = BookingDocument.objects.create(
            booking=booking,
            uploaded_by=request.user,
            file=f,
            original_name=f.name,
            description=(request.data.get('description') or '').strip()[:200],
        )

        # Notify the other party
        other_user = booking.tutor.user if _is_student_of(request.user, booking) else booking.student
        Notification.objects.create(
            user=other_user,
            notification_type='booking_confirmed',
            title=f'{request.user.display_name} attached a document',
            message=f'"{f.name}" was added to your booking.',
            link='/bookings' if other_user == booking.student else '/tutor-dashboard',
        )

        return Response(
            BookingDocumentSerializer(doc, context={'request': request}).data,
            status=201,
        )


class BookingDocumentDeleteView(views.APIView):
    """
    DELETE /bookings/documents/<id>/  — delete a document you uploaded.
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, doc_id):
        try:
            doc = BookingDocument.objects.select_related('booking').get(id=doc_id)
        except BookingDocument.DoesNotExist:
            return Response({'error': 'Document not found.'}, status=404)

        # Uploader or admin can delete; also allow the *other* party to delete
        # things only in edge cases — we keep it strict: uploader only.
        if doc.uploaded_by_id != request.user.id and request.user.role != 'admin':
            return Response(
                {'error': 'Only the uploader can delete this document.'},
                status=403,
            )

        if doc.booking.status == Booking.Status.COMPLETED:
            return Response({'error': 'Cannot remove documents from a completed session.'},
                            status=400)

        doc.file.delete(save=False)
        doc.delete()
        return Response({'message': 'Document deleted.'})


# --------------------------------------------------------------------------
# Reviews
# --------------------------------------------------------------------------

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
