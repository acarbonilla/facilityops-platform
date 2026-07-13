export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  event_code: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  target_url: string | null;
  source_module: string;
  source_object_id: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  is_read?: boolean;
  severity?: NotificationSeverity;
  source_module?: string;
  ordering?: string;
}

export interface NotificationListFilters {
  readState: "" | "read" | "unread";
  severity: "" | NotificationSeverity;
  sourceModule: string;
  pageSize: number;
}

export interface NotificationUnreadCountResponse {
  unread_count: number;
}
