"""Domain exceptions for attachment operations."""


class AttachmentError(Exception):
    """Base attachment domain error with a stable client-safe code."""

    code = "attachment_error"
    status_code = 400

    def __init__(self, message=None):
        self.message = message or "Attachment operation failed."
        super().__init__(self.message)


class AttachmentValidationError(AttachmentError):
    code = "attachment_validation_error"
    status_code = 400


class AttachmentPermissionError(AttachmentError):
    code = "attachment_permission_denied"
    status_code = 403


class AttachmentNotFoundError(AttachmentError):
    code = "attachment_not_found"
    status_code = 404


class AttachmentStorageError(AttachmentError):
    code = "attachment_storage_error"
    status_code = 500
