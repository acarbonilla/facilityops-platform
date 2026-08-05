import type {
  MyRequestAssetOption,
  MyRequestCreatePayload,
  MyRequestFilterValues,
  MyRequestFormValues,
  MyRequestListParams,
} from "@/types/my-requests";
import type { FmTicketCategory, FmTicketStatus } from "@/types/fm-tickets";

const STATUS_VALUES = new Set<string>([
  "draft",
  "open",
  "assigned",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
]);

const CATEGORY_VALUES = new Set<string>([
  "unclassified",
  "electrical",
  "plumbing",
  "hvac",
  "civil",
  "safety",
  "cleaning",
  "security",
  "other",
]);

export function normalizeMyRequestFilters(
  values: MyRequestFilterValues,
): MyRequestListParams {
  const params: MyRequestListParams = {};

  if (values.status && STATUS_VALUES.has(values.status)) {
    params.status = values.status as FmTicketStatus;
  }

  if (values.category && CATEGORY_VALUES.has(values.category)) {
    params.category = values.category as FmTicketCategory;
  }

  return params;
}

export function normalizeMyRequestListParams(
  params?: MyRequestListParams,
): MyRequestListParams {
  if (!params) {
    return {};
  }

  const normalized: MyRequestListParams = {};

  if (typeof params.page === "number" && params.page > 0) {
    normalized.page = params.page;
  }

  if (typeof params.page_size === "number" && params.page_size > 0) {
    normalized.page_size = params.page_size;
  }

  if (params.status && STATUS_VALUES.has(params.status)) {
    normalized.status = params.status;
  }

  if (params.category && CATEGORY_VALUES.has(params.category)) {
    normalized.category = params.category;
  }

  return normalized;
}

export function hasActiveMyRequestFilters(values: MyRequestFilterValues): boolean {
  return Boolean(values.status || values.category);
}

/** FO-096: Employee intake payload is title + optional description only. */
export function buildMyRequestCreatePayload(
  values: MyRequestFormValues,
): MyRequestCreatePayload | null {
  const title = values.title.trim();
  if (!title) {
    return null;
  }

  return {
    title,
    description: values.description.trim(),
  };
}

export function shouldShowMyRequestDetailSoftWarning(
  values: Pick<MyRequestFormValues, "description">,
  stagedImageCount: number,
): boolean {
  return !values.description.trim() && stagedImageCount <= 0;
}

export function applyBuildingChange(
  values: MyRequestFormValues & {
    building?: string;
    floor?: string;
    area?: string;
    asset?: string;
    category?: string;
  },
  buildingId: string,
): MyRequestFormValues & {
  building?: string;
  floor?: string;
  area?: string;
  asset?: string;
  category?: string;
} {
  return {
    ...values,
    building: buildingId,
    floor: "",
    area: "",
    asset: "",
  };
}

export function applyFloorChange(
  values: MyRequestFormValues & {
    building?: string;
    floor?: string;
    area?: string;
    asset?: string;
    category?: string;
  },
  floorId: string,
): MyRequestFormValues & {
  building?: string;
  floor?: string;
  area?: string;
  asset?: string;
  category?: string;
} {
  return {
    ...values,
    floor: floorId,
    area: "",
    asset: "",
  };
}

export function applyAreaChange(
  values: MyRequestFormValues & {
    building?: string;
    floor?: string;
    area?: string;
    asset?: string;
    category?: string;
  },
  areaId: string,
): MyRequestFormValues & {
  building?: string;
  floor?: string;
  area?: string;
  asset?: string;
  category?: string;
} {
  return {
    ...values,
    area: areaId,
    asset: "",
  };
}

export function isAssetCompatibleWithSelection(
  asset: MyRequestAssetOption,
  selection: { building?: string; floor?: string; area?: string },
): boolean {
  if (!selection.building || asset.building_id !== selection.building) {
    return false;
  }

  if (selection.floor && asset.floor_id && asset.floor_id !== selection.floor) {
    return false;
  }

  if (selection.area && asset.area_id && asset.area_id !== selection.area) {
    return false;
  }

  return true;
}

export function filterCompatibleAssets(
  assets: MyRequestAssetOption[],
  selection: { building?: string; floor?: string; area?: string },
): MyRequestAssetOption[] {
  if (!selection.building) {
    return [];
  }

  return assets.filter((asset) =>
    isAssetCompatibleWithSelection(asset, selection),
  );
}

export function clearStaleLocationSelections(
  values: MyRequestFormValues & {
    building?: string;
    floor?: string;
    area?: string;
    asset?: string;
  },
  options: {
    floors: Array<{ id: string; building_id: string }>;
    areas: Array<{ id: string; building_id: string; floor_id: string }>;
    assets: MyRequestAssetOption[];
  },
): typeof values {
  let next = { ...values };

  if (
    next.floor &&
    !options.floors.some(
      (floor) => floor.id === next.floor && floor.building_id === next.building,
    )
  ) {
    next = applyFloorChange(next, "");
  }

  if (
    next.area &&
    !options.areas.some(
      (area) =>
        area.id === next.area &&
        area.building_id === next.building &&
        (!next.floor || area.floor_id === next.floor),
    )
  ) {
    next = applyAreaChange(next, "");
  }

  if (
    next.asset &&
    !isAssetCompatibleWithSelection(
      options.assets.find((asset) => asset.id === next.asset) ?? {
        id: next.asset,
        name: "",
        building_id: "",
        floor_id: null,
        area_id: null,
      },
      next,
    )
  ) {
    next = { ...next, asset: "" };
  }

  return next;
}
