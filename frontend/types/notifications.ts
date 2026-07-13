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

export interface NotificationUpdatedCountResponse {
  updated_count: number;
}

export interface NotificationBulkStatePayload {
  notification_ids: string[];
  is_read: boolean;
}

export interface NotificationBulkStateResponse {
  updated_count: number;
  is_read: boolean;
}

export type NotificationChannel = "in_app" | "email" | "sms" | "push";

export type NotificationSourceModule =
  | "fm_tickets"
  | "maintenance"
  | "inspection";

export interface NotificationPreferenceItem {
  id: string;
  source_module: string;
  channel: NotificationChannel;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferencesResponse {
  defaults: Record<NotificationChannel, boolean>;
  preferences: NotificationPreferenceItem[];
}

export interface NotificationPreferenceUpdateItem {
  source_module?: string;
  channel: NotificationChannel;
  is_enabled: boolean | null;
}

export interface NotificationPreferencesUpdatePayload {
  preferences: NotificationPreferenceUpdateItem[];
}
