# students browsing tutor cards/profiles can see where the tutor is based.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_pendingregistration_and_accessibility'),
    ]

    operations = [
        migrations.AddField(
            model_name='tutorprofile',
            name='location_city',
            field=models.CharField(
                blank=True, max_length=100,
                help_text="City or town the tutor is based in (approximate, public).",
            ),
        ),
        migrations.AddField(
            model_name='tutorprofile',
            name='location_postcode_area',
            field=models.CharField(
                blank=True, max_length=10,
                help_text="UK postcode area, e.g. 'SE1' or 'EC2A'. First half only "
                          "— never the full postcode.",
            ),
        ),
    ]
