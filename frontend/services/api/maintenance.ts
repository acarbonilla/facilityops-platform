import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  MaintenanceAttachment,
  MaintenanceDashboard,
  MaintenanceHistory,
  MaintenanceLabor,
  MaintenanceListParams,
  MaintenanceMaterial,
  MaintenanceTask,
  MaintenanceWorkOrderDetail,
  MaintenanceWorkOrderListItem,
} from "@/types/maintenance";

export function getMaintenanceDashboard(
  params?: MaintenanceListParams,
): Promise<MaintenanceDashboard> {
  return apiClient<MaintenanceDashboard>(API_ENDPOINTS.maintenance.dashboard, {
    method: "GET",
    query: params,
  });
}

export function getMaintenanceList(
  params?: MaintenanceListParams,
): Promise<PaginatedResponse<MaintenanceWorkOrderListItem>> {
  return apiClient<PaginatedResponse<MaintenanceWorkOrderListItem>>(
    API_ENDPOINTS.maintenance.workOrders,
    {
      method: "GET",
      query: params,
    },
  );
}

export function getMaintenanceDetail(
  id: string,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(
    API_ENDPOINTS.maintenance.workOrder(id),
    {
      method: "GET",
    },
  );
}

export function getMaintenanceHistory(
  id: string,
): Promise<PaginatedResponse<MaintenanceHistory>> {
  return apiClient<PaginatedResponse<MaintenanceHistory>>(
    API_ENDPOINTS.maintenance.history(id),
    {
      method: "GET",
    },
  );
}

export async function getMaintenanceTasks(id: string): Promise<MaintenanceTask[]> {
  const detail = await getMaintenanceDetail(id);
  return detail.tasks;
}

export async function getMaintenanceMaterials(
  id: string,
): Promise<MaintenanceMaterial[]> {
  const detail = await getMaintenanceDetail(id);
  return detail.materials;
}

export async function getMaintenanceLabor(id: string): Promise<MaintenanceLabor[]> {
  const detail = await getMaintenanceDetail(id);
  return detail.labor_entries;
}

export async function getMaintenanceAttachments(
  id: string,
): Promise<MaintenanceAttachment[]> {
  const detail = await getMaintenanceDetail(id);
  return detail.attachments;
}
