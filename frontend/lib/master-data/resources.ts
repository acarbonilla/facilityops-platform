import type { MasterDataResourceKey } from "@/types/master-data";

export interface MasterDataResourceDefinition {
  key: MasterDataResourceKey;
  label: string;
  title: string;
  href: string;
  description: string;
}

export const MASTER_DATA_RESOURCES: MasterDataResourceDefinition[] = [
  {
    key: "tenants",
    label: "Tenants",
    title: "Tenants",
    href: "/master-data/tenants",
    description: "Top-level customer or property-owner records for the platform.",
  },
  {
    key: "organizations",
    label: "Organizations",
    title: "Organizations",
    href: "/master-data/organizations",
    description: "Business units or operating entities that belong to a tenant.",
  },
  {
    key: "departments",
    label: "Departments",
    title: "Departments",
    href: "/master-data/departments",
    description: "Operational departments that sit under an organization.",
  },
  {
    key: "buildings",
    label: "Buildings",
    title: "Buildings",
    href: "/master-data/buildings",
    description: "Physical building records with organization and address context.",
  },
  {
    key: "floors",
    label: "Floors",
    title: "Floors",
    href: "/master-data/floors",
    description: "Building floor records with level metadata for facility structure.",
  },
  {
    key: "areas",
    label: "Areas",
    title: "Areas",
    href: "/master-data/areas",
    description: "Functional spaces within buildings and floors.",
  },
  {
    key: "asset-types",
    label: "Asset Types",
    title: "Asset Types",
    href: "/master-data/asset-types",
    description: "Reference categories used to classify managed assets.",
  },
  {
    key: "assets",
    label: "Assets",
    title: "Assets",
    href: "/master-data/assets",
    description: "Read-only operational asset records linked to location and type.",
  },
];
