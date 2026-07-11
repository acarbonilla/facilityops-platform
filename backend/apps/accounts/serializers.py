from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .services import create_user, update_user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "tenant",
            "organization",
            "is_staff",
        )
        read_only_fields = fields


class UserReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "tenant",
            "organization",
            "is_active",
            "is_staff",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "tenant",
            "organization",
            "password",
            "is_active",
            "is_staff",
        )
        extra_kwargs = {
            "tenant": {"required": False, "allow_null": True},
            "organization": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        if self.instance is None and "password" not in attrs:
            raise serializers.ValidationError(
                {"password": "This field is required."}
            )
        return attrs

    def create(self, validated_data):
        return create_user(
            actor=self.context["request"].user,
            validated_data=validated_data,
        )

    def update(self, instance, validated_data):
        return update_user(
            actor=self.context["request"].user,
            user=instance,
            validated_data=validated_data,
        )


class UserDirectorySerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "tenant",
            "organization",
            "is_active",
        )
        read_only_fields = fields

    def get_display_name(self, obj):
        full_name = obj.get_full_name().strip()
        return full_name or obj.email


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
