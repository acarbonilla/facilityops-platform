"use client";

import { useQuery } from "@tanstack/react-query";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { UnauthorizedState } from "@/components/common/unauthorized-state";
import { AppShell } from "@/components/layout/app-shell";
import { FoundationSummaryCards } from "@/features/dashboard/components/foundation-summary";
import { QuickLinks } from "@/features/dashboard/components/quick-links";
import { SystemStatusCard } from "@/features/dashboard/components/system-status-card";
import { getFoundationSummary } from "@/services/api/dashboard";
import { getBackendHealth } from "@/services/api/health";
import { dashboardQueryKeys } from "@/services/api/query-keys";
import { ApiError } from "@/services/api/types";
import type { FoundationSummary, SystemStatus } from "@/types/dashboard";

function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

function hasAnyFoundationData(summary: FoundationSummary) {
  return (
    summary.tenants > 0 ||
    summary.organizations > 0 ||
    summary.departments > 0 ||
    summary.buildings > 0 ||
    summary.floors > 0 ||
    summary.areas > 0 ||
    summary.asset_types > 0 ||
    summary.assets > 0
  );
}

export default function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: dashboardQueryKeys.foundationSummary(),
    queryFn: getFoundationSummary,
  });
  const healthQuery = useQuery({
    queryKey: dashboardQueryKeys.systemStatus(),
    queryFn: getBackendHealth,
    retry: 1,
  });

  const systemStatus: SystemStatus = {
    service:
      summaryQuery.data?.service ?? healthQuery.data?.service ?? "facilityops-backend",
    status: healthQuery.data?.status ?? "unknown",
    connected: healthQuery.data?.status === "ok",
    message: healthQuery.data
      ? "The dashboard can reach the backend health endpoint."
      : "The dashboard could not confirm backend connectivity.",
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            description="Foundation overview"
            eyebrow="Stage 1 - Foundation"
            title="FacilityOps Dashboard"
          />

          {summaryQuery.isPending ? (
            <LoadingState
              title="Loading foundation metrics"
              message="Retrieving master data counts and backend connectivity."
            />
          ) : null}

          {summaryQuery.isError && isUnauthorizedError(summaryQuery.error) ? (
            <UnauthorizedState message="Your account could not access the dashboard summary endpoint." />
          ) : null}

          {summaryQuery.isError && !isUnauthorizedError(summaryQuery.error) ? (
            <ErrorState
              title="Dashboard unavailable"
              message={summaryQuery.error.message}
              action={
                <button
                  className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-800"
                  onClick={() => {
                    void summaryQuery.refetch();
                    void healthQuery.refetch();
                  }}
                  type="button"
                >
                  Retry
                </button>
              }
            />
          ) : null}

          {summaryQuery.data && !hasAnyFoundationData(summaryQuery.data) ? (
            <EmptyState
              title="No foundation records yet"
              message="The dashboard is connected, but master data counts are still empty."
            />
          ) : null}

          {summaryQuery.data && hasAnyFoundationData(summaryQuery.data) ? (
            <FoundationSummaryCards summary={summaryQuery.data} />
          ) : null}

          {!summaryQuery.isPending && !summaryQuery.isError ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <SystemStatusCard status={systemStatus} />
              <QuickLinks />
            </div>
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
