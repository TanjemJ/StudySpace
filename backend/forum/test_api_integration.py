from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import StudentProfile, User
from .models import ForumCategory, ForumPost


class UniversityForumApiTests(TestCase):
    """Focused API tests for university-only forum access rules."""

    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            email='forum.student@example.com',
            username='forum.student@example.com',
            display_name='ForumStudent',
            password='Student123!',
            role=User.Role.STUDENT,
            is_email_verified=True,
        )
        StudentProfile.objects.create(
            user=self.student,
            university='London South Bank University',
            university_email='forum.student@lsbu.ac.uk',
            university_verified=False,
        )
        self.category = ForumCategory.objects.create(
            name='LSBU Discussion',
            university='London South Bank University',
            is_university_only=True,
        )

    def test_unverified_student_cannot_create_university_only_post(self):
        self.client.force_authenticate(self.student)

        response = self.client.post(
            '/api/forum/posts/create/',
            {
                'category_id': str(self.category.id),
                'title': 'Private university forum post',
                'content': 'This should not be accepted until university email is verified.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(ForumPost.objects.count(), 0)
        self.assertIn('verified member', response.data['error'])

    def test_unverified_student_cannot_see_university_only_posts(self):
        ForumPost.objects.create(
            author=self.student,
            category=self.category,
            title='Existing private post',
            content='Private university content.',
            university='London South Bank University',
        )
        self.client.force_authenticate(self.student)

        response = self.client.get('/api/forum/posts/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'], [])
