from django.contrib import admin
from .models import AvailabilitySlot, Booking, PaymentRecord, Review

@admin.register(AvailabilitySlot)
class AvailabilitySlotAdmin(admin.ModelAdmin):
    list_display = ('tutor', 'date', 'start_time', 'end_time', 'is_booked')
    list_filter = ('is_booked', 'date')

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('student', 'tutor', 'subject', 'status', 'price', 'created_at')
    list_filter = ('status',)

admin.site.register(PaymentRecord)
admin.site.register(Review)
