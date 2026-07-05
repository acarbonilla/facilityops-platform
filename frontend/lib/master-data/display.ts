import type { MasterDataListParams } from "@/types/master-data";

export function createEntityNameMap<T extends { id: string; name: string }>(
  records: T[],
): Record<string, string> {
  return Object.fromEntries(records.map((record) => [record.id, record.name]));
}

export function resolveEntityName(
  id: string | null | undefined,
  map: Record<string, string>,
  fallback = "Unavailable",
): string {
  if (!id) {
    return fallback;
  }

  return map[id] ?? id;
}

export function getFirstQueryErrorMessage(
  errors: unknown[],
  fallback: string,
): string {
  for (const error of errors) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
  }

  return fallback;
}

export const DEFAULT_MASTER_DATA_LIST_PARAMS: MasterDataListParams = {
  page_size: 100,
};
