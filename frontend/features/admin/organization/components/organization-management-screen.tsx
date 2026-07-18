"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";
import {
  canCreateMasterDataResource,
  collectPaginatedMasterData,
  getMasterDataSessionScope,
} from "@/lib/master-data/lifecycle";
import {
  getAreas,
  getBuildings,
  getDepartments,
  getFloors,
  getOrganizations,
  getTenants,
} from "@/services/api/master-data";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import type {
  Area,
  Building,
  Department,
  Floor,
  Organization,
  OrganizationHierarchySummary,
  OrganizationStructureNode,
  Tenant,
} from "@/types/master-data";

import { OrganizationHierarchy } from "./organization-hierarchy";
import { OrganizationStructureCard } from "./organization-structure-card";

interface OrganizationStructureResourceDefinition {
  key: "tenants" | "organizations" | "departments" | "buildings" | "floors" | "areas";
  title: string;
  href: string;
  createHref: string;
  description: string;
}

const ORGANIZATION_STRUCTURE_RESOURCES: OrganizationStructureResourceDefinition[] = [
  {
    key: "tenants",
    title: "Tenants",
    href: "/admin/organization/tenants",
    createHref: "/master-data/tenants/new",
    description: "Top-level ownership or customer boundaries for the platform.",
  },
  {
    key: "organizations",
    title: "Organizations",
    href: "/admin/organization/organizations",
    createHref: "/master-data/organizations/new",
    description: "Operating entities that belong to a tenant.",
  },
  {
    key: "departments",
    title: "Departments",
    href: "/admin/organization/departments",
    createHref: "/master-data/departments/new",
    description: "Internal teams and functional units within organizations.",
  },
  {
    key: "buildings",
    title: "Buildings",
    href: "/admin/organization/buildings",
    createHref: "/master-data/buildings/new",
    description: "Physical sites and building records tied to organizations.",
  },
  {
    key: "floors",
    title: "Floors",
    href: "/admin/organization/floors",
    createHref: "/master-data/floors/new",
    description: "Vertical building structure with level numbering.",
  },
  {
    key: "areas",
    title: "Areas",
    href: "/admin/organization/areas",
    createHref: "/master-data/areas/new",
    description: "Rooms, zones, and functional spaces inside floors.",
  },
];

const EMPTY_TENANTS: Tenant[] = [];
const EMPTY_ORGANIZATIONS: Organization[] = [];
const EMPTY_DEPARTMENTS: Department[] = [];
const EMPTY_BUILDINGS: Building[] = [];
const EMPTY_FLOORS: Floor[] = [];
const EMPTY_AREAS: Area[] = [];

function createHierarchy(
  tenants: Tenant[],
  organizations: Organization[],
  departments: Department[],
  buildings: Building[],
  floors: Floor[],
  areas: Area[],
): OrganizationStructureNode[] {
  return tenants.map((tenant) => ({
    id: tenant.id,
    label: tenant.name,
    code: tenant.code,
    href: "/admin/organization/tenants",
    resource: "tenants",
    children: organizations
      .filter((organization) => organization.tenant === tenant.id)
      .map((organization) => ({
        id: organization.id,
        label: organization.name,
        code: organization.code,
        href: "/admin/organization/organizations",
        resource: "organizations",
        children: [
          ...departments
            .filter((department) => department.organization === organization.id)
            .map((department) => ({
              id: department.id,
              label: department.name,
              code: department.code,
              href: "/admin/organization/departments",
              resource: "departments" as const,
              children: [],
            })),
          ...buildings
            .filter((building) => building.organization === organization.id)
            .map((building) => ({
              id: building.id,
              label: building.name,
              code: building.code,
              href: "/admin/organization/buildings",
              resource: "buildings" as const,
              children: floors
                .filter((floor) => floor.building === building.id)
                .map((floor) => ({
                  id: floor.id,
                  label: floor.name,
                  code: floor.code,
                  href: "/admin/organization/floors",
                  resource: "floors" as const,
                  children: areas
                    .filter((area) => area.floor === floor.id)
                    .map((area) => ({
                      id: area.id,
                      label: area.name,
                      code: area.code,
                      href: "/admin/organization/areas",
                      resource: "areas" as const,
                      children: [],
                    })),
                })),
            })),
        ],
      })),
  }));
}

function buildHierarchySummary(
  tenants: Tenant[],
  organizations: Organization[],
  departments: Department[],
  buildings: Building[],
  floors: Floor[],
  areas: Area[],
): OrganizationHierarchySummary {
  return {
    tenants: tenants.length,
    organizations: organizations.length,
    departments: departments.length,
    buildings: buildings.length,
    floors: floors.length,
    areas: areas.length,
  };
}

export function OrganizationManagementScreen() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("settings.manage");
  const sessionScope = getMasterDataSessionScope(user?.id, user?.tenant);

  const tenantsQuery = useQuery({
    queryKey: masterDataQueryKeys.options("tenants", sessionScope),
    queryFn: () => collectPaginatedMasterData(getTenants),
  });
  const organizationsQuery = useQuery({
    queryKey: masterDataQueryKeys.options("organizations", sessionScope),
    queryFn: () => collectPaginatedMasterData(getOrganizations),
  });
  const departmentsQuery = useQuery({
    queryKey: masterDataQueryKeys.options("departments", sessionScope),
    queryFn: () => collectPaginatedMasterData(getDepartments),
  });
  const buildingsQuery = useQuery({
    queryKey: masterDataQueryKeys.options("buildings", sessionScope),
    queryFn: () => collectPaginatedMasterData(getBuildings),
  });
  const floorsQuery = useQuery({
    queryKey: masterDataQueryKeys.options("floors", sessionScope),
    queryFn: () => collectPaginatedMasterData(getFloors),
  });
  const areasQuery = useQuery({
    queryKey: masterDataQueryKeys.options("areas", sessionScope),
    queryFn: () => collectPaginatedMasterData(getAreas),
  });

  const queries = [
    tenantsQuery,
    organizationsQuery,
    departmentsQuery,
    buildingsQuery,
    floorsQuery,
    areasQuery,
  ];
  const isLoading = queries.some((query) => query.isPending);
  const hasError = queries.some((query) => query.isError);
  const errorMessage = hasError
    ? getFirstQueryErrorMessage(
        queries.map((query) => query.error),
        "Organization structure data could not be loaded.",
      )
    : null;

  const tenants = tenantsQuery.data ?? EMPTY_TENANTS;
  const organizations = organizationsQuery.data ?? EMPTY_ORGANIZATIONS;
  const departments = departmentsQuery.data ?? EMPTY_DEPARTMENTS;
  const buildings = buildingsQuery.data ?? EMPTY_BUILDINGS;
  const floors = floorsQuery.data ?? EMPTY_FLOORS;
  const areas = areasQuery.data ?? EMPTY_AREAS;

  const hierarchy = useMemo(
    () =>
      createHierarchy(
        tenants,
        organizations,
        departments,
        buildings,
        floors,
        areas,
      ),
    [areas, buildings, departments, floors, organizations, tenants],
  );
  const summary = useMemo(
    () =>
      buildHierarchySummary(
        tenants,
        organizations,
        departments,
        buildings,
        floors,
        areas,
      ),
    [areas, buildings, departments, floors, organizations, tenants],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description="Admin-facing organization structure views built on the existing master-data foundation. Read and create/edit links reuse the existing tenant, organization, department, building, floor, and area APIs and forms."
        eyebrow="Admin"
        title="Organization Management"
      >
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Read access" value="settings.view" />
          <DetailField
            label="Manage actions"
            value={canManage ? "settings.manage enabled" : "Read-only account"}
          />
          <DetailField label="Hierarchy view" value="Read-only" />
          <DetailField label="Workflow scope" value="Structure only" />
        </dl>
      </PageHeader>

      {isLoading ? (
        <LoadingState
          title="Loading organization structure"
          message="Retrieving tenant, organization, department, building, floor, and area data."
        />
      ) : null}

      {!isLoading && errorMessage ? (
        <ErrorState
          title="Unable to load organization structure"
          message={errorMessage}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => {
                void tenantsQuery.refetch();
                void organizationsQuery.refetch();
                void departmentsQuery.refetch();
                void buildingsQuery.refetch();
                void floorsQuery.refetch();
                void areasQuery.refetch();
              }}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!isLoading && !errorMessage ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ORGANIZATION_STRUCTURE_RESOURCES.map((resource) => (
              <OrganizationStructureCard
                canManage={canCreateMasterDataResource(
                  resource.key,
                  canManage,
                )}
                count={summary[resource.key]}
                createHref={resource.createHref}
                description={resource.description}
                href={resource.href}
                key={resource.key}
                title={resource.title}
              />
            ))}
          </div>

          {summary.tenants === 0 ? (
            <EmptyState
              title="No organization structure records found"
              message="Seed or create tenant and related master-data records before using the organization structure screens."
            />
          ) : (
            <OrganizationHierarchy nodes={hierarchy} />
          )}
        </>
      ) : null}
    </div>
  );
}
