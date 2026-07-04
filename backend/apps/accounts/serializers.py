from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_staff",
        )
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    default_error_messages = {
        "invalid_credentials": "Invalid email or password.",
        "inactive_account": "This account is inactive.",
    }

    def validate(self, attrs):
        email = attrs["email"]
        password = attrs["password"]

        user = None
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            user = None

        if user and user.check_password(password) and not user.is_active:
            self.fail("inactive_account")

        authenticated_user = authenticate(
            request=self.context.get("request"),
            email=email,
            password=password,
        )
        if authenticated_user is None:
            self.fail("invalid_credentials")

        refresh = RefreshToken.for_user(authenticated_user)
        attrs["user"] = authenticated_user
        attrs["refresh"] = str(refresh)
        attrs["access"] = str(refresh.access_token)
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
