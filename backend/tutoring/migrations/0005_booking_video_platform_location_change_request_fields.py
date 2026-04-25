from django.db import migrations, models


# Choice tuples used in multiple AlterField calls below — keep in sync with
# tutoring/models.py.
SESSION_TYPE_CHOICES = [
    ('video', 'Video Call'),
    ('in_person', 'In Person'),
    ('chat', 'Chat (legacy)'),     # kept for old data only — UI labels these as 'Other'
    ('other', 'Other'),
]

VIDEO_PLATFORM_CHOICES = [
    ('google_meet', 'Google Meet'),
    ('zoom', 'Zoom'),
    ('teams', 'Microsoft Teams'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('tutoring', '0004_booking_cancelled_at_booking_cancelled_by_and_more'),
    ]

    operations = [
        # --- Booking ---
        migrations.AddField(
            model_name='booking',
            name='video_platform',
            field=models.CharField(
                blank=True, max_length=20,
                choices=VIDEO_PLATFORM_CHOICES,
                help_text="Which video platform this session will use. "
                          "Only meaningful when session_type='video'.",
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='location_suggestion',
            field=models.CharField(
                blank=True, max_length=200,
                help_text="Student's suggested location for an in-person session. "
                          "The tutor decides the final location.",
            ),
        ),
        migrations.AlterField(
            model_name='booking',
            name='session_type',
            field=models.CharField(
                max_length=20, default='video',
                choices=SESSION_TYPE_CHOICES,
            ),
        ),

        # --- BookingChangeRequest ---
        migrations.AddField(
            model_name='bookingchangerequest',
            name='proposed_video_platform',
            field=models.CharField(
                blank=True, max_length=20,
                choices=VIDEO_PLATFORM_CHOICES,
            ),
        ),
        migrations.AddField(
            model_name='bookingchangerequest',
            name='proposed_location_suggestion',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AlterField(
            model_name='bookingchangerequest',
            name='proposed_session_type',
            field=models.CharField(
                blank=True, max_length=20,
                choices=SESSION_TYPE_CHOICES,
            ),
        ),
    ]
