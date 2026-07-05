import type { MasterDataListParams, MasterDataResourceKey } from "@/types/master-data";

function normalizeParams(params?: MasterDataListParams): MasterDataListParams {
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as MasterDataListParams;
}

export const masterDataQueryKeys = {
  all: ["master-data"] as const,
  list: (resource: MasterDataResourceKey, params?: MasterDataListParams) =>
    ["master-data", resource, normalizeParams(params)] as const,
  detail: (resource: MasterDataResourceKey, id: string) =>
    ["master-data", resource, id] as const,
};
