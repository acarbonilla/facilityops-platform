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
