from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.pagination import StandardResultsSetPagination

from .exceptions import AttachmentError
from .permissions import HasAttachmentPermission
from .serializers import AttachmentSerializer, AttachmentUploadSerializer
from .services import (
    create_attachment,
    delete_attachment,
    download_attachment,
    get_attachment,
    list_attachments,
)


class AttachmentViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, HasAttachmentPermission]
    pagination_class = StandardResultsSetPagination
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        action_permissions = {
            "create": "attachments.upload",
            "list": "attachments.view",
            "retrieve": "attachments.view",
            "download": "attachments.download",
            "destroy": "attachments.delete",
        }
        self.required_permission = action_permissions.get(self.action)
        return super().get_permissions()

    def _paginate(self, queryset, serializer_class):
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, self.request, view=self)
        if page is not None:
            serializer = serializer_class(
                page, many=True, context={"request": self.request}
            )
            return paginator.get_paginated_response(serializer.data)
        serializer = serializer_class(
            queryset, many=True, context={"request": self.request}
        )
        return Response(serializer.data)

    def create(self, request):
        serializer = AttachmentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            attachment = create_attachment(
                actor=request.user,
                uploaded_file=serializer.validated_data["file"],
                declared_content_type=getattr(
                    serializer.validated_data["file"], "content_type", ""
                )
                or "",
                category=serializer.validated_data.get("category"),
                owner_type=serializer.validated_data.get("owner_type") or "",
                owner_id=serializer.validated_data.get("owner_id"),
                visibility=serializer.validated_data.get("visibility"),
            )
        except AttachmentError as exc:
            return Response(
                {"detail": exc.message, "code": exc.code},
                status=exc.status_code,
            )
        return Response(
            AttachmentSerializer(attachment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def list(self, request):
        try:
            queryset = list_attachments(
                actor=request.user,
                owner_type=request.query_params.get("owner_type"),
                owner_id=request.query_params.get("owner_id"),
            )
        except AttachmentError as exc:
            return Response(
                {"detail": exc.message, "code": exc.code},
                status=exc.status_code,
            )
        return self._paginate(queryset, AttachmentSerializer)

    def retrieve(self, request, pk=None):
        attachment = get_attachment(actor=request.user, attachment_id=pk)
        return Response(
            AttachmentSerializer(attachment, context={"request": request}).data
        )

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        try:
            attachment, content = download_attachment(
                actor=request.user,
                attachment_id=pk,
            )
        except AttachmentError as exc:
            return Response(
                {"detail": exc.message, "code": exc.code},
                status=exc.status_code,
            )

        response = HttpResponse(
            content,
            content_type=attachment.validated_content_type,
        )
        # Attachment disposition avoids inline execution of active content.
        safe_name = attachment.display_filename.replace('"', "")
        response["Content-Disposition"] = f'attachment; filename="{safe_name}"'
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        response["Content-Length"] = str(attachment.size_bytes)
        return response

    def destroy(self, request, pk=None):
        attachment = delete_attachment(actor=request.user, attachment_id=pk)
        return Response(
            AttachmentSerializer(attachment, context={"request": request}).data
        )
