"use client";

import { useQuery } from "@tanstack/react-query";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { UnauthorizedState } from "@/components/common/unauthorized-state";
import { AppShell } from "@/components/layout/app-shell";
import { FoundationSummaryCards } from "@/features/dashboard/components/foundation-summary";
import { QuickLinks } from "@/features/dashboard/components/quick-links";
import { SystemStatusCard } from "@/features/dashboard/components/system-status-card";
import { useAuth } from "@/hooks/use-auth";
import {
  buildDashboardSystemStatus,
  formatDashboardSummaryError,
  isDashboardUnauthorizedError,
} from "@/lib/dashboard/display";
import { isDashboardQueryEnabled } from "@/lib/dashboard/query";
import {
  DASHBOARD_SCOPE_SUMMARY,
  DASHBOARD_SCOPE_SUPPORTING,
} from "@/lib/dashboard/scope";
import { getFoundationSummary } from "@/services/api/dashboard";
import { getBackendHealth } from "@/services/api/health";
import { dashboardQueryKeys } from "@/services/api/query-keys";

export default function DashboardPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queriesEnabled = isDashboardQueryEnabled({
    isLoading: isAuthLoading,
    isAuthenticated,
  });

  const summaryQuery = useQuery({
    queryKey: dashboardQueryKeys.foundationSummary(),
    queryFn: getFoundationSummary,
    enabled: queriesEnabled,
  });
  const healthQuery = useQuery({
    queryKey: dashboardQueryKeys.systemStatus(),
    queryFn: getBackendHealth,
    enabled: queriesEnabled,
    retry: 1,
  });

  const systemStatus = buildDashboardSystemStatus({
    health: healthQuery.data,
    healthFailed: healthQuery.isError,
  });

  const showUnauthorized =
    summaryQuery.isError && isDashboardUnauthorizedError(summaryQuery.error);
  const showRecoverableError =
    summaryQuery.isError && !isDashboardUnauthorizedError(summaryQuery.error);

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            description={DASHBOARD_SCOPE_SUMMARY}
            eyebrow="Stage 1 - Foundation"
            title="FacilityOps Dashboard"
          >
            <p className="max-w-3xl text-sm text-slate-500">
              {DASHBOARD_SCOPE_SUPPORTING}
            </p>
          </PageHeader>

          {summaryQuery.isPending || (!queriesEnabled && isAuthLoading) ? (
            <LoadingState
              title="Loading foundation metrics"
              message="Retrieving foundation counts available to your account."
            />
          ) : null}

          {showUnauthorized ? (
            <UnauthorizedState message="Your account could not access foundation metrics." />
          ) : null}

          {showRecoverableError ? (
            <ErrorState
              title="Dashboard unavailable"
              message={formatDashboardSummaryError(summaryQuery.error)}
              action={
                <button
                  className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
                  onClick={() => {
                    void summaryQuery.refetch();
                  }}
                  type="button"
                >
                  Retry
                </button>
              }
            />
          ) : null}

          {summaryQuery.data ? (
            <FoundationSummaryCards summary={summaryQuery.data} />
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <SystemStatusCard status={systemStatus} />
              {healthQuery.isError ? (
                <p className="text-sm text-slate-500" role="status">
                  Connectivity checks are unavailable right now. Foundation
                  counts above are independent of this status.
                </p>
              ) : null}
            </div>
            <QuickLinks />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
