import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_universitydomain_emailverificationcode_purpose_and_more'),
    ]

    operations = [
        # --- New accessibility fields on User ---
        migrations.AddField(
            model_name='user',
            name='underline_links',
            field=models.BooleanField(
                default=False,
                help_text='Always underline links for easier scanning.',
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='dyslexia_font',
            field=models.BooleanField(
                default=False,
                help_text='Use a dyslexia-friendly font across the site.',
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='focus_ring_boost',
            field=models.BooleanField(
                default=False,
                help_text='Stronger focus outlines on keyboard tab navigation.',
            ),
        ),

        # --- New PendingRegistration model ---
        migrations.CreateModel(
            name='PendingRegistration',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('hashed_password', models.CharField(max_length=256)),
                ('role', models.CharField(
                    choices=[('student', 'Student'), ('tutor', 'Tutor'),
                             ('admin', 'Admin'), ('parent', 'Parent/Guardian')],
                    default='student', max_length=10,
                )),
                ('code', models.CharField(max_length=6)),
                ('attempts', models.PositiveSmallIntegerField(
                    default=0,
                    help_text='Number of failed verification attempts.',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['email'], name='accounts_pe_email_idx'),
                    models.Index(fields=['created_at'], name='accounts_pe_created_idx'),
                ],
            },
        ),
    ]
