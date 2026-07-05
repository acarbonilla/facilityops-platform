import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type {
  Area,
  AreaFormValues,
  Asset,
  AssetMutationPayload,
  AssetType,
  AssetTypeFormValues,
  Building,
  BuildingFormValues,
  Department,
  DepartmentFormValues,
  Floor,
  FloorFormValues,
  MasterDataListParams,
  Organization,
  OrganizationFormValues,
  Tenant,
  TenantFormValues,
} from "@/types/master-data";
import type { PaginatedResponse } from "@/services/api/types";

function getList<T>(
  endpoint: string,
  params?: MasterDataListParams,
): Promise<PaginatedResponse<T>> {
  return apiClient<PaginatedResponse<T>>(endpoint, {
    method: "GET",
    query: params,
  });
}

function getDetail<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: "GET" });
}

function createRecord<TRecord, TPayload>(
  endpoint: string,
  payload: TPayload,
): Promise<TRecord> {
  return apiClient<TRecord>(endpoint, {
    method: "POST",
    body: payload,
  });
}

function updateRecord<TRecord, TPayload>(
  endpoint: string,
  payload: TPayload,
): Promise<TRecord> {
  return apiClient<TRecord>(endpoint, {
    method: "PATCH",
    body: payload,
  });
}

export function getTenants(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Tenant>> {
  return getList<Tenant>(API_ENDPOINTS.masterData.tenants, params);
}

export function getTenant(id: string): Promise<Tenant> {
  return getDetail<Tenant>(API_ENDPOINTS.masterData.tenant(id));
}

export function createTenant(payload: TenantFormValues): Promise<Tenant> {
  return createRecord<Tenant, TenantFormValues>(
    API_ENDPOINTS.masterData.tenants,
    payload,
  );
}

export function updateTenant(
  id: string,
  payload: TenantFormValues,
): Promise<Tenant> {
  return updateRecord<Tenant, TenantFormValues>(
    API_ENDPOINTS.masterData.tenant(id),
    payload,
  );
}

export function getOrganizations(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Organization>> {
  return getList<Organization>(API_ENDPOINTS.masterData.organizations, params);
}

export function getOrganization(id: string): Promise<Organization> {
  return getDetail<Organization>(API_ENDPOINTS.masterData.organization(id));
}

export function createOrganization(
  payload: OrganizationFormValues,
): Promise<Organization> {
  return createRecord<Organization, OrganizationFormValues>(
    API_ENDPOINTS.masterData.organizations,
    payload,
  );
}

export function updateOrganization(
  id: string,
  payload: OrganizationFormValues,
): Promise<Organization> {
  return updateRecord<Organization, OrganizationFormValues>(
    API_ENDPOINTS.masterData.organization(id),
    payload,
  );
}

export function getDepartments(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Department>> {
  return getList<Department>(API_ENDPOINTS.masterData.departments, params);
}

export function getDepartment(id: string): Promise<Department> {
  return getDetail<Department>(API_ENDPOINTS.masterData.department(id));
}

export function createDepartment(
  payload: DepartmentFormValues,
): Promise<Department> {
  return createRecord<Department, DepartmentFormValues>(
    API_ENDPOINTS.masterData.departments,
    payload,
  );
}

export function updateDepartment(
  id: string,
  payload: DepartmentFormValues,
): Promise<Department> {
  return updateRecord<Department, DepartmentFormValues>(
    API_ENDPOINTS.masterData.department(id),
    payload,
  );
}

export function getBuildings(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Building>> {
  return getList<Building>(API_ENDPOINTS.masterData.buildings, params);
}

export function getBuilding(id: string): Promise<Building> {
  return getDetail<Building>(API_ENDPOINTS.masterData.building(id));
}

export function createBuilding(payload: BuildingFormValues): Promise<Building> {
  return createRecord<Building, BuildingFormValues>(
    API_ENDPOINTS.masterData.buildings,
    payload,
  );
}

export function updateBuilding(
  id: string,
  payload: BuildingFormValues,
): Promise<Building> {
  return updateRecord<Building, BuildingFormValues>(
    API_ENDPOINTS.masterData.building(id),
    payload,
  );
}

export function getFloors(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Floor>> {
  return getList<Floor>(API_ENDPOINTS.masterData.floors, params);
}

export function getFloor(id: string): Promise<Floor> {
  return getDetail<Floor>(API_ENDPOINTS.masterData.floor(id));
}

export function createFloor(payload: FloorFormValues): Promise<Floor> {
  return createRecord<Floor, FloorFormValues>(
    API_ENDPOINTS.masterData.floors,
    payload,
  );
}

export function updateFloor(id: string, payload: FloorFormValues): Promise<Floor> {
  return updateRecord<Floor, FloorFormValues>(
    API_ENDPOINTS.masterData.floor(id),
    payload,
  );
}

export function getAreas(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Area>> {
  return getList<Area>(API_ENDPOINTS.masterData.areas, params);
}

export function getArea(id: string): Promise<Area> {
  return getDetail<Area>(API_ENDPOINTS.masterData.area(id));
}

export function createArea(payload: AreaFormValues): Promise<Area> {
  return createRecord<Area, AreaFormValues>(
    API_ENDPOINTS.masterData.areas,
    payload,
  );
}

export function updateArea(id: string, payload: AreaFormValues): Promise<Area> {
  return updateRecord<Area, AreaFormValues>(
    API_ENDPOINTS.masterData.area(id),
    payload,
  );
}

export function getAssetTypes(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<AssetType>> {
  return getList<AssetType>(API_ENDPOINTS.masterData.assetTypes, params);
}

export function getAssetType(id: string): Promise<AssetType> {
  return getDetail<AssetType>(API_ENDPOINTS.masterData.assetType(id));
}

export function createAssetType(
  payload: AssetTypeFormValues,
): Promise<AssetType> {
  return createRecord<AssetType, AssetTypeFormValues>(
    API_ENDPOINTS.masterData.assetTypes,
    payload,
  );
}

export function updateAssetType(
  id: string,
  payload: AssetTypeFormValues,
): Promise<AssetType> {
  return updateRecord<AssetType, AssetTypeFormValues>(
    API_ENDPOINTS.masterData.assetType(id),
    payload,
  );
}

export function getAssets(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Asset>> {
  return getList<Asset>(API_ENDPOINTS.masterData.assets, params);
}

export function getAsset(id: string): Promise<Asset> {
  return getDetail<Asset>(API_ENDPOINTS.masterData.asset(id));
}

export function createAsset(payload: AssetMutationPayload): Promise<Asset> {
  return createRecord<Asset, AssetMutationPayload>(
    API_ENDPOINTS.masterData.assets,
    payload,
  );
}

export function updateAsset(id: string, payload: AssetMutationPayload): Promise<Asset> {
  return updateRecord<Asset, AssetMutationPayload>(
    API_ENDPOINTS.masterData.asset(id),
    payload,
  );
}
