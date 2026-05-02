from decimal import Decimal, ROUND_HALF_UP

import stripe
from django.conf import settings

from accounts.models import TutorProfile


class StripeConfigurationError(Exception):
    """Raised when Stripe is not ready for the requested payment action."""


def configure_stripe():
    if not settings.STRIPE_SECRET_KEY:
        raise StripeConfigurationError('Stripe is not configured yet.')
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def frontend_url(path):
    clean_path = path if path.startswith('/') else f'/{path}'
    return f'{settings.FRONTEND_BASE_URL}{clean_path}'


def money_to_minor_units(amount):
    return int((Decimal(amount) * Decimal('100')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def calculate_platform_fee(amount):
    fee = Decimal(amount) * settings.STRIPE_PLATFORM_FEE_PERCENT / Decimal('100')
    return fee.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def sync_stripe_account(tutor_profile, account=None):
    stripe_client = configure_stripe()
    if not tutor_profile.stripe_account_id:
        return tutor_profile

    account = account or stripe_client.Account.retrieve(tutor_profile.stripe_account_id)
    tutor_profile.stripe_charges_enabled = bool(account.get('charges_enabled'))
    tutor_profile.stripe_payouts_enabled = bool(account.get('payouts_enabled'))
    tutor_profile.stripe_details_submitted = bool(account.get('details_submitted'))
    tutor_profile.save(update_fields=[
        'stripe_charges_enabled',
        'stripe_payouts_enabled',
        'stripe_details_submitted',
    ])
    return tutor_profile


def create_or_get_tutor_account(tutor_profile):
    stripe_client = configure_stripe()
    if tutor_profile.stripe_account_id:
        return stripe_client.Account.retrieve(tutor_profile.stripe_account_id)

    account = stripe_client.Account.create(
        type='express',
        country='GB',
        email=tutor_profile.user.email,
        business_type='individual',
        capabilities={
            'card_payments': {'requested': True},
            'transfers': {'requested': True},
        },
        metadata={
            'tutor_profile_id': str(tutor_profile.id),
            'user_id': str(tutor_profile.user_id),
        },
    )
    tutor_profile.stripe_account_id = account.id
    tutor_profile.save(update_fields=['stripe_account_id'])
    return account


def create_tutor_account_link(tutor_profile):
    stripe_client = configure_stripe()
    account = create_or_get_tutor_account(tutor_profile)
    link = stripe_client.AccountLink.create(
        account=account.id,
        refresh_url=frontend_url('/tutor-dashboard?stripe=refresh'),
        return_url=frontend_url('/tutor-dashboard?stripe=return'),
        type='account_onboarding',
    )
    return link


def create_booking_checkout_session(booking):
    stripe_client = configure_stripe()
    tutor_profile = booking.tutor
    if not tutor_profile.stripe_account_id:
        raise StripeConfigurationError('This tutor still needs to connect Stripe before taking paid bookings.')

    sync_stripe_account(tutor_profile)
    if not tutor_profile.stripe_charges_enabled:
        raise StripeConfigurationError('This tutor still needs to finish Stripe onboarding before taking paid bookings.')

    payment = booking.payment
    platform_fee = calculate_platform_fee(booking.price)
    tutor_payout = (Decimal(booking.price) - platform_fee).quantize(Decimal('0.01'))
    metadata = {
        'booking_id': str(booking.id),
        'payment_id': str(payment.id),
        'student_id': str(booking.student_id),
        'tutor_user_id': str(tutor_profile.user_id),
    }

    session = stripe_client.checkout.Session.create(
        mode='payment',
        payment_method_types=['card'],
        customer_email=booking.student.email,
        client_reference_id=str(booking.id),
        success_url=frontend_url(f'/bookings?payment=success&booking={booking.id}'),
        cancel_url=frontend_url(f'/bookings?payment=cancelled&booking={booking.id}'),
        line_items=[
            {
                'price_data': {
                    'currency': settings.STRIPE_CURRENCY,
                    'product_data': {
                        'name': f'{booking.subject} tutoring session',
                        'description': (
                            f'{booking.tutor.user.display_name} on {booking.slot.date} '
                            f'at {booking.slot.start_time:%H:%M}'
                        ),
                    },
                    'unit_amount': money_to_minor_units(booking.price),
                },
                'quantity': 1,
            },
        ],
        payment_intent_data={
            'application_fee_amount': money_to_minor_units(platform_fee),
            'transfer_data': {'destination': tutor_profile.stripe_account_id},
            'metadata': metadata,
        },
        metadata=metadata,
    )

    payment.stripe_checkout_session_id = session.id
    payment.stripe_account_id = tutor_profile.stripe_account_id
    payment.platform_fee_amount = platform_fee
    payment.tutor_payout_amount = tutor_payout
    payment.payment_method = 'stripe'
    payment.save(update_fields=[
        'stripe_checkout_session_id',
        'stripe_account_id',
        'platform_fee_amount',
        'tutor_payout_amount',
        'payment_method',
    ])
    return session


def get_tutor_profile_for_account(account_id):
    return TutorProfile.objects.filter(stripe_account_id=account_id).select_related('user').first()
