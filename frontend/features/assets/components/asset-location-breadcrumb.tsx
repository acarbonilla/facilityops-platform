import Link from "next/link";

export interface AssetLocationBreadcrumbProps {
  tenant?: string | null;
  organization?: string | null;
  building?: string | null;
  floor?: string | null;
  area?: string | null;
  tenantLabel?: string;
  organizationLabel?: string;
  buildingLabel?: string;
  floorLabel?: string;
  areaLabel?: string;
}

function Crumb({
  href,
  label,
}: {
  href?: string;
  label: string;
}) {
  if (!href) {
    return <span className="text-slate-700">{label}</span>;
  }

  return (
    <Link
      className="text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
      href={href}
    >
      {label}
    </Link>
  );
}

export function AssetLocationBreadcrumb({
  area,
  areaLabel,
  building,
  buildingLabel,
  floor,
  floorLabel,
  organization,
  organizationLabel,
  tenant,
  tenantLabel,
}: AssetLocationBreadcrumbProps) {
  const items = [
    {
      id: tenant,
      label: tenantLabel ?? tenant ?? "Tenant unavailable",
      href: tenant ? "/admin/organization/tenants" : undefined,
    },
    {
      id: organization,
      label: organizationLabel ?? organization ?? "Organization unavailable",
      href: organization ? "/admin/organization/organizations" : undefined,
    },
    {
      id: building,
      label: buildingLabel ?? building ?? "Building unavailable",
      href: building ? "/admin/organization/buildings" : undefined,
    },
    {
      id: floor,
      label: floorLabel ?? (floor ? floor : "Floor not assigned"),
      href: floor ? "/admin/organization/floors" : undefined,
    },
    {
      id: area,
      label: areaLabel ?? (area ? area : "Area not assigned"),
      href: area ? "/admin/organization/areas" : undefined,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {items.map((item, index) => (
        <div className="flex items-center gap-2" key={`${item.label}-${index}`}>
          <Crumb href={item.href} label={item.label} />
          {index < items.length - 1 ? <span aria-hidden="true">/</span> : null}
        </div>
      ))}
    </div>
  );
}
