from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class UserModelTests(APITestCase):
    def test_user_creation_with_email(self):
        user = User.objects.create_user(
            email="ADMIN@example.com",
            password="Password123!",
            first_name="Admin",
            last_name="User",
        )

        self.assertEqual(user.email, "ADMIN@example.com")
        self.assertTrue(user.check_password("Password123!"))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_superuser_creation(self):
        user = User.objects.create_superuser(
            email="superuser@example.com",
            password="Password123!",
        )

        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_active)


class AuthenticationEndpointTests(APITestCase):
    def setUp(self):
        self.password = "Password123!"
        self.user = User.objects.create_user(
            email="admin@example.com",
            password=self.password,
            first_name="Admin",
            last_name="User",
        )

    def test_login_success(self):
        response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], self.user.email)

    def test_login_failure_with_invalid_credentials(self):
        response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["non_field_errors"][0],
            "Invalid email or password.",
        )

    def test_refresh_token_endpoint(self):
        login_response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        response = self.client.post(
            reverse("auth-refresh"),
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_current_user_requires_authentication(self):
        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_returns_authenticated_user(self):
        login_response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )

        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertFalse(response.data["is_staff"])

    def test_logout_endpoint_returns_expected_response(self):
        login_response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        response = self.client.post(
            reverse("auth-logout"),
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("discard", response.data["detail"])
