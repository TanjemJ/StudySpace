from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, StudentProfile, TutorProfile, EmailVerificationCode, Notification, VerificationDocument

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'display_name', 'role', 'is_email_verified', 'is_active')
    list_filter = ('role', 'is_email_verified', 'is_active')
    search_fields = ('email', 'display_name', 'first_name', 'last_name')
    ordering = ('-created_at',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('StudySpace', {'fields': ('role', 'display_name', 'date_of_birth', 'avatar', 'is_email_verified')}),
    )

@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'university', 'course', 'year_of_study', 'university_verified')

@admin.register(TutorProfile)
class TutorProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'verification_status', 'hourly_rate', 'average_rating', 'total_sessions')
    list_filter = ('verification_status',)
    actions = ['approve_tutors', 'reject_tutors']

    def approve_tutors(self, request, queryset):
        queryset.update(verification_status='approved')
    def reject_tutors(self, request, queryset):
        queryset.update(verification_status='rejected')

admin.site.register(EmailVerificationCode)
admin.site.register(Notification)
admin.site.register(VerificationDocument)
