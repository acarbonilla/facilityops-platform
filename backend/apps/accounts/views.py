from rest_framework import filters, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.access_control.permissions import HasPermissionCode
from common.pagination import StandardResultsSetPagination

from .models import User
from .permissions import IsAuthenticated
from .serializers import (
    LoginSerializer,
    LogoutSerializer,
    UserDirectorySerializer,
    UserReadSerializer,
    UserSerializer,
    UserWriteSerializer,
)
from .services import deactivate_user, scope_users_to_actor


class UserExactFilterBackend:
    fields = {
        "tenant": serializers.UUIDField(),
        "organization": serializers.UUIDField(),
        "is_active": serializers.BooleanField(),
        "is_staff": serializers.BooleanField(),
    }

    def filter_queryset(self, request, queryset, view):
        filters_to_apply = {
            field: serializer.run_validation(request.query_params[field])
            for field, serializer in self.fields.items()
            if field in request.query_params
        }
        return queryset.filter(**filters_to_apply)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user_data = UserSerializer(serializer.validated_data["user"]).data
        response_user = {
            key: user_data[key]
            for key in (
                "id",
                "email",
                "first_name",
                "last_name",
                "tenant",
                "organization",
            )
        }
        return Response(
            {
                "access": serializer.validated_data["access"],
                "refresh": serializer.validated_data["refresh"],
                "user": response_user,
            },
            status=status.HTTP_200_OK,
        )


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            {
                "detail": (
                    "Logout successful. discard the client access and refresh "
                    "tokens."
                )
            },
            status=status.HTTP_200_OK,
        )


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("tenant", "organization").all()
    permission_classes = [IsAuthenticated, HasPermissionCode]
    pagination_class = StandardResultsSetPagination
    filter_backends = (
        UserExactFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = ("email", "first_name", "last_name")
    ordering_fields = (
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
    ordering = ("email",)

    permission_by_action = {
        "list": "users.view",
        "retrieve": "users.view",
        "directory": "users.view",
        "create": "users.create",
        "update": "users.update",
        "partial_update": "users.update",
        "destroy": "users.delete",
    }

    def get_permissions(self):
        self.required_permission = self.permission_by_action.get(self.action)
        return super().get_permissions()

    def get_queryset(self):
        return scope_users_to_actor(super().get_queryset(), self.request.user)

    def get_serializer_class(self):
        if self.action == "directory":
            return UserDirectorySerializer
        if self.action in ("create", "update", "partial_update"):
            return UserWriteSerializer
        return UserReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        response_serializer = UserReadSerializer(
            user,
            context=self.get_serializer_context(),
        )
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        user = self.get_object()
        serializer = self.get_serializer(
            user,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        response_serializer = UserReadSerializer(
            user,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data)

    def destroy(self, request, *args, **kwargs):
        deactivate_user(actor=request.user, user=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=("get",))
    def directory(self, request):
        active_users = self.get_queryset().filter(is_active=True)
        queryset = self.filter_queryset(active_users)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(self.get_serializer(queryset, many=True).data)
