import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";
import {
  getAreas,
  getAssets,
  getBuildings,
  getDepartments,
  getFloors,
  getOrganizations,
  getTenants,
} from "./master-data";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  MaintenanceAttachment,
  MaintenanceAssignment,
  MaintenanceAssignmentCandidate,
  MaintenanceAssignPayload,
  MaintenanceCancelPayload,
  MaintenanceCompletePayload,
  MaintenanceDashboard,
  MaintenanceEscalation,
  MaintenanceEscalationActionPayload,
  MaintenanceFormOptions,
  MaintenanceHistory,
  MaintenanceHoldPayload,
  MaintenanceLabor,
  MaintenanceListParams,
  MaintenanceMaterial,
  MaintenanceReopenPayload,
  MaintenanceReassignPayload,
  MaintenanceSimpleWorkflowPayload,
  MaintenanceSla,
  MaintenanceTask,
  MaintenanceUnassignPayload,
  MaintenanceWorkOrderCreatePayload,
  MaintenanceWorkOrderDetail,
  MaintenanceWorkOrderListItem,
  MaintenanceWorkOrderUpdatePayload,
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

export function createMaintenanceWorkOrder(
  payload: MaintenanceWorkOrderCreatePayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(
    API_ENDPOINTS.maintenance.workOrders,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function updateMaintenanceWorkOrder(
  id: string,
  payload: MaintenanceWorkOrderUpdatePayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(
    API_ENDPOINTS.maintenance.workOrder(id),
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function submitWorkOrder(
  id: string,
  payload?: MaintenanceSimpleWorkflowPayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.submit(id), {
    method: "POST",
    body: payload ?? {},
  });
}

export function assignWorkOrder(
  id: string,
  payload: MaintenanceAssignPayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.assign(id), {
    method: "POST",
    body: payload,
  });
}

export function reassignWorkOrder(
  id: string,
  payload: MaintenanceReassignPayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.reassign(id), {
    method: "POST",
    body: payload,
  });
}

export function unassignWorkOrder(
  id: string,
  payload: MaintenanceUnassignPayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.unassign(id), {
    method: "POST",
    body: payload,
  });
}

export function getWorkOrderAssignments(id: string): Promise<MaintenanceAssignment[]> {
  return apiClient<MaintenanceAssignment[]>(API_ENDPOINTS.maintenance.assignments(id));
}

export function getWorkOrderAssignmentCandidates(
  id: string,
): Promise<MaintenanceAssignmentCandidate[]> {
  return apiClient<MaintenanceAssignmentCandidate[]>(
    API_ENDPOINTS.maintenance.assignmentCandidates(id),
  );
}

export function getWorkOrderSLA(id: string): Promise<MaintenanceSla> {
  return apiClient<MaintenanceSla>(API_ENDPOINTS.maintenance.sla(id));
}

export function recalculateWorkOrderSLA(id: string): Promise<MaintenanceSla> {
  return apiClient<MaintenanceSla>(API_ENDPOINTS.maintenance.recalculateSla(id), {
    method: "POST",
    body: {},
  });
}

export function getWorkOrderEscalations(
  id: string,
): Promise<MaintenanceEscalation[]> {
  return apiClient<MaintenanceEscalation[]>(
    API_ENDPOINTS.maintenance.escalations(id),
  );
}

export function acknowledgeWorkOrderEscalation(
  workOrderId: string,
  escalationId: string,
  payload: MaintenanceEscalationActionPayload,
): Promise<MaintenanceEscalation> {
  return apiClient<MaintenanceEscalation>(
    API_ENDPOINTS.maintenance.acknowledgeEscalation(workOrderId, escalationId),
    { method: "POST", body: payload },
  );
}

export function resolveWorkOrderEscalation(
  workOrderId: string,
  escalationId: string,
  payload: MaintenanceEscalationActionPayload,
): Promise<MaintenanceEscalation> {
  return apiClient<MaintenanceEscalation>(
    API_ENDPOINTS.maintenance.resolveEscalation(workOrderId, escalationId),
    { method: "POST", body: payload },
  );
}

export function startWorkOrder(
  id: string,
  payload?: MaintenanceSimpleWorkflowPayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.start(id), {
    method: "POST",
    body: payload ?? {},
  });
}

export function holdWorkOrder(
  id: string,
  payload: MaintenanceHoldPayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.hold(id), {
    method: "POST",
    body: payload,
  });
}

export function resumeWorkOrder(
  id: string,
  payload?: MaintenanceSimpleWorkflowPayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.resume(id), {
    method: "POST",
    body: payload ?? {},
  });
}

export function completeWorkOrder(
  id: string,
  payload: MaintenanceCompletePayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.complete(id), {
    method: "POST",
    body: payload,
  });
}

export function cancelWorkOrder(
  id: string,
  payload: MaintenanceCancelPayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.cancel(id), {
    method: "POST",
    body: payload,
  });
}

export function reopenWorkOrder(
  id: string,
  payload: MaintenanceReopenPayload,
): Promise<MaintenanceWorkOrderDetail> {
  return apiClient<MaintenanceWorkOrderDetail>(API_ENDPOINTS.maintenance.reopen(id), {
    method: "POST",
    body: payload,
  });
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

export async function getMaintenanceFormOptions(): Promise<MaintenanceFormOptions> {
  const [
    tenantsResponse,
    organizationsResponse,
    departmentsResponse,
    buildingsResponse,
    floorsResponse,
    areasResponse,
    assetsResponse,
  ] = await Promise.all([
    getTenants({ page_size: 100 }),
    getOrganizations({ page_size: 100 }),
    getDepartments({ page_size: 100 }),
    getBuildings({ page_size: 100 }),
    getFloors({ page_size: 100 }),
    getAreas({ page_size: 100 }),
    getAssets({ page_size: 100 }),
  ]);

  return {
    tenants: tenantsResponse.results,
    organizations: organizationsResponse.results,
    departments: departmentsResponse.results,
    buildings: buildingsResponse.results,
    floors: floorsResponse.results,
    areas: areasResponse.results,
    assets: assetsResponse.results,
    supports_attachments: false,
    supports_save_draft: false,
    supports_assignment_persistence: false,
    supports_task_persistence: false,
    supports_material_persistence: false,
    supports_labor_persistence: false,
    supports_requester_selection: false,
  };
}
