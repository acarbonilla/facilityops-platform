import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import {
  getUserManagementCapabilities,
  getUserManagementEndpointDiscovery,
} from "@/services/api/users";

function CapabilityValue({ enabled }: { enabled: boolean }) {
  return enabled ? "Supported" : "Not supported";
}

export function UserManagementScreen() {
  const capabilities = getUserManagementCapabilities();
  const endpoints = getUserManagementEndpointDiscovery();
  const discoveredEndpoints = Object.entries(endpoints).filter(([, value]) =>
    Boolean(value),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description="User administration is wired into the admin navigation and permission guards, but the current backend does not yet expose a supported user-management API for listing, viewing, creating, editing, or assigning roles."
        eyebrow="Admin"
        title="Users"
      >
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DetailField
            label="List users"
            value={<CapabilityValue enabled={capabilities.list} />}
          />
          <DetailField
            label="User detail"
            value={<CapabilityValue enabled={capabilities.detail} />}
          />
          <DetailField
            label="Create or edit"
            value={
              capabilities.create || capabilities.update ? "Partially supported" : "Not supported"
            }
          />
          <DetailField
            label="Role assignment"
            value={<CapabilityValue enabled={capabilities.assignRole} />}
          />
        </dl>
      </PageHeader>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Backend endpoint discovery
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Checked expected user-management endpoints before enabling any write or
          detail UI.
        </p>

        {discoveredEndpoints.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {discoveredEndpoints.map(([key, value]) => (
              <li
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                key={key}
              >
                <span className="font-medium text-slate-900">{key}</span>:{" "}
                <span className="font-mono text-xs">{value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No admin user endpoints discovered"
            message="No supported backend endpoint was found for user listing, detail, create, update, or user-role assignment. Backend follow-up is required before user data can be loaded here."
          />
        )}
      </section>

      <EmptyState
        title="Read-only foundation only"
        message="This page intentionally avoids invitations, password reset, SSO, OAuth, audit logs, and business workflows. Add a dedicated backend users API before enabling user-management operations."
      />
    </div>
  );
}
