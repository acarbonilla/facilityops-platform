import { z } from "zod";

const requiredString = (fieldLabel: string) =>
  z.string().trim().min(1, `${fieldLabel} is required.`);

const optionalString = z.string().trim();

const activeFlag = z.boolean();

export const tenantSchema = z.object({
  name: requiredString("Name"),
  code: requiredString("Code"),
  description: optionalString,
  is_active: activeFlag,
});

export const organizationSchema = tenantSchema.extend({
  tenant: requiredString("Tenant"),
});

export const departmentSchema = tenantSchema.extend({
  tenant: requiredString("Tenant"),
  organization: requiredString("Organization"),
});

export const buildingSchema = tenantSchema.extend({
  tenant: requiredString("Tenant"),
  organization: requiredString("Organization"),
  address: optionalString,
});

export const floorSchema = tenantSchema.extend({
  tenant: requiredString("Tenant"),
  building: requiredString("Building"),
  level_number: z.number(),
});

export const areaSchema = tenantSchema.extend({
  tenant: requiredString("Tenant"),
  building: requiredString("Building"),
  floor: requiredString("Floor"),
});

export const assetTypeSchema = tenantSchema.extend({
  tenant: requiredString("Tenant"),
});

export const assetSchema = tenantSchema.extend({
  tenant: requiredString("Tenant"),
  organization: requiredString("Organization"),
  building: requiredString("Building"),
  floor: z.string().trim(),
  area: z.string().trim(),
  asset_type: requiredString("Asset type"),
  serial_number: optionalString,
});
