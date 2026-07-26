import type {
  FmTicketCategory,
  FmTicketPriority,
  FmTicketStatus,
} from "./fm-tickets";

export interface MyRequestListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  status?: FmTicketStatus;
  category?: FmTicketCategory;
}

export interface MyRequestListItem {
  id: string;
  ticket_number: string;
  organization: string;
  organization_name: string;
  building: string;
  building_name: string;
  floor: string | null;
  floor_name: string | null;
  area: string | null;
  area_name: string | null;
  asset: string | null;
  asset_name: string | null;
  title: string;
  category: FmTicketCategory;
  priority: FmTicketPriority;
  status: FmTicketStatus;
  reported_at: string;
}

export interface MyRequestDetail extends MyRequestListItem {
  description: string;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  can_cancel?: boolean;
  can_acknowledge?: boolean;
  can_reopen?: boolean;
}

export interface MyRequestCreatePayload {
  title: string;
  description: string;
  category: FmTicketCategory;
  building: string;
  floor?: string;
  area?: string;
  asset?: string;
}

export interface MyRequestFormValues {
  title: string;
  description: string;
  category: FmTicketCategory | "";
  building: string;
  floor: string;
  area: string;
  asset: string;
}

export interface MyRequestOptionRef {
  id: string;
  name: string;
}

export interface MyRequestFloorOption extends MyRequestOptionRef {
  building_id: string;
}

export interface MyRequestAreaOption extends MyRequestOptionRef {
  building_id: string;
  floor_id: string;
}

export interface MyRequestAssetOption extends MyRequestOptionRef {
  building_id: string;
  floor_id: string | null;
  area_id: string | null;
}

export interface MyRequestChoiceOption {
  value: string;
  label: string;
}

export interface MyRequestOptions {
  organization: MyRequestOptionRef | null;
  buildings: MyRequestOptionRef[];
  floors: MyRequestFloorOption[];
  areas: MyRequestAreaOption[];
  assets: MyRequestAssetOption[];
  categories: MyRequestChoiceOption[];
}

export interface MyRequestFilterValues {
  status: FmTicketStatus | "";
  category: FmTicketCategory | "";
}

export const MY_REQUEST_ATTACHMENT_GUIDANCE =
  "Photo and document attachments will be available in a later update.";

export const MY_REQUEST_COMMENTS_GUIDANCE =
  "Comments will be available in a later update.";

export const MY_REQUEST_STATUS_GUIDANCE =
  "Request status is updated by the facilities team as work progresses.";

export type MyRequestWorkflowAction = "cancel" | "acknowledge" | "reopen";

export interface MyRequestWorkflowEligibility {
  canCancel: boolean;
  canAcknowledge: boolean;
  canReopen: boolean;
}
