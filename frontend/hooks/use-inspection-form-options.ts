"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getBuildings,
  getAreas,
  getDepartments,
  getFloors,
  getOrganizations,
  getTenants,
} from "@/services/api/master-data";
import { inspectionQueryKeys } from "@/services/api/query-keys";
import type { InspectionFormOptions } from "@/types/inspection";

export function useInspectionFormOptions() {
  return useQuery({
    queryKey: inspectionQueryKeys.formOptions(),
    queryFn: async (): Promise<InspectionFormOptions> => {
      const [
        tenantsResponse,
        organizationsResponse,
        departmentsResponse,
        buildingsResponse,
        floorsResponse,
        areasResponse,
      ] = await Promise.all([
        getTenants({ page_size: 100 }),
        getOrganizations({ page_size: 100 }),
        getDepartments({ page_size: 100 }),
        getBuildings({ page_size: 100 }),
        getFloors({ page_size: 100 }),
        getAreas({ page_size: 100 }),
      ]);

      return {
        tenants: tenantsResponse.results,
        organizations: organizationsResponse.results,
        departments: departmentsResponse.results,
        buildings: buildingsResponse.results,
        floors: floorsResponse.results,
        areas: areasResponse.results,
        supports_user_directory: false,
        user_directory_note:
          "Inspector and supervisor selection stays read-only because the current frontend does not have a supported user-directory list API.",
      };
    },
  });
}
