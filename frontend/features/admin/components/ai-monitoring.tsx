"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  AI_MONITORING_DISCLAIMER,
  AI_MONITORING_PERMISSION,
  formatDurationMs,
  formatMonitoringRate,
  monitoringHealthBadgeClass,
  overviewScreenReaderSummary,
} from "@/lib/admin/ai-monitoring";
import { formatReportingError } from "@/lib/reporting/display";
import { getAIMonitoringOverview } from "@/services/api/ai-monitoring";
import type {
  AIMonitoringAlert,
  AIMonitoringHealthBadge,
} from "@/types/ai-monitoring";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function HealthBadge({ badge }: { badge: AIMonitoringHealthBadge }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-medium",
        monitoringHealthBadgeClass(badge.status),
      ].join(" ")}
      title={`${badge.status_label} (${badge.status})`}
    >
      <span className="sr-only">Status:</span>
      {badge.status_label}
      <span className="ml-1 text-xs opacity-80">({badge.status})</span>
    </span>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function AlertList({ alerts }: { alerts: AIMonitoringAlert[] }) {
  if (!alerts.length) {
    return (
      <EmptyState
        title="No active alerts"
        message="Operational thresholds are within configured monitoring bands."
      />
    );
  }
  return (
    <ul className="space-y-3" aria-label="Operational alerts">
      {alerts.map((alert) => (
        <li
          key={`${alert.code}-${alert.title}`}
          className={[
            "rounded-lg border p-4",
            monitoringHealthBadgeClass(alert.severity),
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{alert.title}</h3>
            <span className="text-sm">
              {alert.severity_label} ({alert.severity})
            </span>
          </div>
          <p className="mt-1 text-sm">{alert.message}</p>
          <p className="mt-2 text-xs opacity-80">
            Informational only — automatic remediation is disabled.
          </p>
        </li>
      ))}
    </ul>
  );
}

export function AIMonitoringScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasPermission, permissionsLoading } = usePermissions();
  const canManage = hasPermission(AI_MONITORING_PERMISSION);
  const enabled =
    !isLoading && isAuthenticated && !permissionsLoading && canManage;

  const overviewQuery = useQuery({
    queryKey: ["admin", "ai", "monitoring"],
    queryFn: getAIMonitoringOverview,
    enabled,
    refetchInterval: 30_000,
  });

  if (permissionsLoading || isLoading) {
    return (
      <LoadingState
        title="Loading AI monitoring"
        message="Checking administrator permissions."
      />
    );
  }

  if (!canManage) {
    return (
      <ErrorState
        title="Access denied"
        message="AI production monitoring requires the settings.manage permission."
      />
    );
  }

  if (overviewQuery.isLoading) {
    return (
      <LoadingState
        title="Loading AI monitoring"
        message="Gathering provider, queue, runtime, and alert metrics."
      />
    );
  }

  if (overviewQuery.isError) {
    return (
      <ErrorState
        title="Unable to load AI monitoring"
        message={formatReportingError(overviewQuery.error)}
      />
    );
  }

  const data = overviewQuery.data;
  if (!data) {
    return (
      <EmptyState
        title="No monitoring data"
        message="No AI production monitoring snapshot is available yet."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="AI Production Monitoring"
        description={AI_MONITORING_DISCLAIMER}
      >
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="font-medium text-blue-700 underline" href="/admin/ai">
            AI Administration
          </Link>
          <Link className="font-medium text-blue-700 underline" href="/admin">
            Admin hub
          </Link>
        </div>
      </PageHeader>

      <p className="sr-only" aria-live="polite">
        {overviewScreenReaderSummary(data)}
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Overview"
          description="Provider status and aggregated health with visible text labels."
        >
          <div className="flex flex-wrap gap-3">
            <HealthBadge badge={data.health.overall} />
            <HealthBadge badge={data.health.provider} />
            <HealthBadge badge={data.health.queue} />
            <HealthBadge badge={data.health.worker} />
            <HealthBadge badge={data.health.ai} />
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Provider
              </dt>
              <dd className="font-medium text-slate-950">
                {data.provider.provider}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Model
              </dt>
              <dd className="font-medium text-slate-950">{data.provider.model}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Enabled
              </dt>
              <dd className="font-medium text-slate-950">
                {data.provider.enabled ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Availability
              </dt>
              <dd className="font-medium text-slate-950">
                {data.provider.provider_availability_label}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Runtime"
          description="Success, failure, retry, and timeout rates for completed work."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              label="Success rate"
              value={formatMonitoringRate(data.runtime.success_rate)}
            />
            <Metric
              label="Failure rate"
              value={formatMonitoringRate(data.runtime.failure_rate)}
            />
            <Metric
              label="Retry rate"
              value={formatMonitoringRate(data.runtime.retry_rate)}
            />
            <Metric
              label="Timeout rate"
              value={formatMonitoringRate(data.runtime.timeout_rate)}
            />
            <Metric
              label="Avg duration"
              value={formatDurationMs(data.runtime.average_duration_ms)}
            />
            <Metric
              label="Avg queue wait"
              value={formatDurationMs(data.runtime.average_queue_wait_ms)}
            />
            <Metric label="Total analyses" value={data.runtime.total_analyses} />
            <Metric label="Analyses today" value={data.runtime.analyses_today} />
          </div>
        </SectionCard>

        <SectionCard
          title="Queue"
          description="Queued, processing, waiting for retry, failed, and retrying counts."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Queued" value={data.queue.queued} />
            <Metric label="Processing" value={data.queue.processing} />
            <Metric
              label="Waiting for retry"
              value={data.queue.waiting_for_retry ?? 0}
            />
            <Metric label="Completed" value={data.queue.completed} />
            <Metric label="Failed" value={data.queue.failed} />
            <Metric label="Retrying" value={data.queue.retrying} />
            <Metric label="Backlog" value={data.queue.backlog} />
          </div>
          <p className="text-xs text-slate-500">
            {data.interpretation?.retrying_definition}
          </p>
        </SectionCard>

        <SectionCard
          title="Provider diagnostics"
          description="FO-102 billing, quota, rate-limit, and auth signals (sanitized)."
        >
          {data.diagnostics ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric
                  label="Provider status"
                  value={data.diagnostics.provider_status}
                />
                <Metric
                  label="Current model"
                  value={data.diagnostics.current_model || "—"}
                />
                <Metric
                  label="Success rate"
                  value={formatMonitoringRate(
                    data.diagnostics.success_rate ?? data.runtime.success_rate,
                  )}
                />
                <Metric
                  label="Billing signal"
                  value={data.diagnostics.billing.signal}
                />
                <Metric
                  label="Quota signal"
                  value={data.diagnostics.quota.signal}
                />
                <Metric
                  label="Rate limit signal"
                  value={data.diagnostics.rate_limit.signal}
                />
                <Metric
                  label="Auth signal"
                  value={data.diagnostics.authentication.signal}
                />
                <Metric
                  label="Retry queue"
                  value={data.diagnostics.retry_queue.waiting_for_retry}
                />
                <Metric
                  label="Avg retry count"
                  value={
                    data.diagnostics.average_retry_count ??
                    data.runtime.average_retry_count ??
                    0
                  }
                />
              </div>
              {data.diagnostics.last_error ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                  <p className="font-medium">Last error</p>
                  <p className="mt-1">
                    {data.diagnostics.last_error.error_code || "unknown"}
                    {data.diagnostics.last_error.http_status
                      ? ` (HTTP ${data.diagnostics.last_error.http_status})`
                      : ""}
                  </p>
                  {data.diagnostics.last_error.admin_message ? (
                    <p className="mt-1 text-slate-700">
                      {data.diagnostics.last_error.admin_message}
                    </p>
                  ) : null}
                  {data.diagnostics.last_error.provider_message ? (
                    <p className="mt-1 text-xs text-slate-600">
                      {data.diagnostics.last_error.provider_message}
                    </p>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="No recent provider errors"
                  message="No terminal AI failures with diagnostics are available yet."
                />
              )}
            </div>
          ) : (
            <EmptyState
              title="Diagnostics unavailable"
              message="Provider diagnostics will appear after FO-102 monitoring is deployed."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Alerts"
          description="Rule-based informational alerts. No automatic remediation."
        >
          <AlertList alerts={data.alerts} />
        </SectionCard>
      </div>

      <SectionCard
        title="Recent activity"
        description="Recent analysis jobs with safe status metadata only."
      >
        {data.recent_activity.length === 0 ? (
          <EmptyState
            title="No recent activity"
            message="No AI analysis jobs have been recorded yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Recent AI analysis jobs with status and timing metadata
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th scope="col" className="px-2 py-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Attempts
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Duration
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Error category
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Queued
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Provider
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recent_activity.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{row.status_label}</td>
                    <td className="px-2 py-2">{row.attempt_count}</td>
                    <td className="px-2 py-2">
                      {formatDurationMs(row.duration_ms)}
                    </td>
                    <td className="px-2 py-2">{row.error_category || "—"}</td>
                    <td className="px-2 py-2">
                      {row.queued_at
                        ? new Date(row.queued_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {row.provider || "—"}
                      {row.model_name ? ` / ${row.model_name}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Error categories">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.error_categories).map(([key, value]) => (
            <Metric
              key={key}
              label={key.replaceAll("_", " ")}
              value={value}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
