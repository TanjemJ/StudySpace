from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User,
    StudentProfile,
    TutorProfile,
    EmailVerificationCode,
    Notification,
    VerificationDocument,
    ContactMessage,
    UniversityDomain,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'display_name', 'role', 'is_email_verified', 'is_deleted', 'is_active')
    list_filter = ('role', 'is_email_verified', 'is_active', 'is_deleted')
    search_fields = ('email', 'display_name', 'first_name', 'last_name')
    ordering = ('-created_at',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('StudySpace', {'fields': ('role', 'display_name', 'date_of_birth', 'avatar', 'is_email_verified', 'is_deleted', 'deletion_reason', 'last_display_name_change', 'text_size', 'high_contrast', 'reduced_motion')}),
    )


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'university', 'course', 'year_of_study', 'university_verified')
    list_filter = ('university_verified', 'university')


@admin.register(TutorProfile)
class TutorProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'verification_status', 'hourly_rate', 'university', 'university_verified', 'average_rating', 'total_sessions')
    list_filter = ('verification_status', 'university_verified')
    actions = ['approve_tutors', 'reject_tutors']

    def approve_tutors(self, request, queryset):
        queryset.update(verification_status='approved')

    def reject_tutors(self, request, queryset):
        queryset.update(verification_status='rejected')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'title', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read')


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'subject', 'is_resolved', 'created_at')
    list_filter = ('is_resolved',)
    actions = ['mark_resolved']

    def mark_resolved(self, request, queryset):
        queryset.update(is_resolved=True)
    mark_resolved.short_description = 'Mark as resolved'

@admin.register(UniversityDomain)
class UniversityDomainAdmin(admin.ModelAdmin):
    list_display = ('university_name', 'domain', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('university_name', 'domain')
    ordering = ('university_name', 'domain')


admin.site.register(EmailVerificationCode)
admin.site.register(VerificationDocument)
