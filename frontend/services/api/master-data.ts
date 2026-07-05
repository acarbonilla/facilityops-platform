import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type {
  Area,
  Asset,
  AssetType,
  Building,
  Department,
  Floor,
  MasterDataListParams,
  Organization,
  Tenant,
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

export function getTenants(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Tenant>> {
  return getList<Tenant>(API_ENDPOINTS.masterData.tenants, params);
}

export function getTenant(id: string): Promise<Tenant> {
  return getDetail<Tenant>(API_ENDPOINTS.masterData.tenant(id));
}

export function getOrganizations(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Organization>> {
  return getList<Organization>(API_ENDPOINTS.masterData.organizations, params);
}

export function getOrganization(id: string): Promise<Organization> {
  return getDetail<Organization>(API_ENDPOINTS.masterData.organization(id));
}

export function getDepartments(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Department>> {
  return getList<Department>(API_ENDPOINTS.masterData.departments, params);
}

export function getDepartment(id: string): Promise<Department> {
  return getDetail<Department>(API_ENDPOINTS.masterData.department(id));
}

export function getBuildings(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Building>> {
  return getList<Building>(API_ENDPOINTS.masterData.buildings, params);
}

export function getBuilding(id: string): Promise<Building> {
  return getDetail<Building>(API_ENDPOINTS.masterData.building(id));
}

export function getFloors(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Floor>> {
  return getList<Floor>(API_ENDPOINTS.masterData.floors, params);
}

export function getFloor(id: string): Promise<Floor> {
  return getDetail<Floor>(API_ENDPOINTS.masterData.floor(id));
}

export function getAreas(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Area>> {
  return getList<Area>(API_ENDPOINTS.masterData.areas, params);
}

export function getArea(id: string): Promise<Area> {
  return getDetail<Area>(API_ENDPOINTS.masterData.area(id));
}

export function getAssetTypes(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<AssetType>> {
  return getList<AssetType>(API_ENDPOINTS.masterData.assetTypes, params);
}

export function getAssetType(id: string): Promise<AssetType> {
  return getDetail<AssetType>(API_ENDPOINTS.masterData.assetType(id));
}

export function getAssets(
  params?: MasterDataListParams,
): Promise<PaginatedResponse<Asset>> {
  return getList<Asset>(API_ENDPOINTS.masterData.assets, params);
}

export function getAsset(id: string): Promise<Asset> {
  return getDetail<Asset>(API_ENDPOINTS.masterData.asset(id));
}
