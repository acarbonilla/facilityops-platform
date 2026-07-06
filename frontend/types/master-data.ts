export interface MasterDataListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  is_active?: boolean;
  tenant?: string;
  organization?: string;
  building?: string;
  floor?: string;
  area?: string;
  asset_type?: string;
}

interface BaseMasterDataRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type Tenant = BaseMasterDataRecord;

export interface Organization extends BaseMasterDataRecord {
  tenant: string;
}

export interface Department extends BaseMasterDataRecord {
  tenant: string;
  organization: string;
}

export interface Building extends BaseMasterDataRecord {
  tenant: string;
  organization: string;
  address: string;
}

export interface Floor extends BaseMasterDataRecord {
  tenant: string;
  building: string;
  level_number: number;
}

export interface Area extends BaseMasterDataRecord {
  tenant: string;
  building: string;
  floor: string;
}

export interface AssetType extends BaseMasterDataRecord {
  tenant: string;
}

export interface Asset extends BaseMasterDataRecord {
  tenant: string;
  organization: string;
  building: string;
  floor: string | null;
  area: string | null;
  asset_type: string;
  serial_number: string;
}

export type MasterDataResourceKey =
  | "tenants"
  | "organizations"
  | "departments"
  | "buildings"
  | "floors"
  | "areas"
  | "asset-types"
  | "assets";

export interface TenantFormValues {
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export interface OrganizationFormValues extends TenantFormValues {
  tenant: string;
}

export interface DepartmentFormValues extends OrganizationFormValues {
  organization: string;
}

export interface BuildingFormValues extends OrganizationFormValues {
  organization: string;
  address: string;
}

export interface FloorFormValues extends TenantFormValues {
  tenant: string;
  building: string;
  level_number: number;
}

export interface AreaFormValues extends TenantFormValues {
  tenant: string;
  building: string;
  floor: string;
}

export interface AssetTypeFormValues extends TenantFormValues {
  tenant: string;
}

export interface AssetFormValues extends TenantFormValues {
  tenant: string;
  organization: string;
  building: string;
  floor: string;
  area: string;
  asset_type: string;
  serial_number: string;
}

export interface AssetMutationPayload extends Omit<AssetFormValues, "floor" | "area"> {
  floor: string | null;
  area: string | null;
}

export type OrganizationStructureResourceKey =
  | "tenants"
  | "organizations"
  | "departments"
  | "buildings"
  | "floors"
  | "areas";

export interface OrganizationStructureNode {
  id: string;
  label: string;
  code: string;
  href: string;
  resource: OrganizationStructureResourceKey;
  children: OrganizationStructureNode[];
}

export interface OrganizationHierarchySummary {
  tenants: number;
  organizations: number;
  departments: number;
  buildings: number;
  floors: number;
  areas: number;
}
