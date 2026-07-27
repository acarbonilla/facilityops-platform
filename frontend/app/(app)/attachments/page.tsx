"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AttachmentWorkspaceScreen } from "@/features/attachments/components/attachment-workspace-screen";
import { ATTACHMENT_PERMISSIONS } from "@/types/attachments";

export default function AttachmentsPage() {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        ATTACHMENT_PERMISSIONS.view,
        ATTACHMENT_PERMISSIONS.upload,
        ATTACHMENT_PERMISSIONS.download,
        ATTACHMENT_PERMISSIONS.delete,
      ]}
    >
      <AppShell>
        <AttachmentWorkspaceScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
