"use client";

import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import {
  useReportingFilterOptions,
  useReportingOverview,
} from "@/hooks/use-reporting-overview";
import {
  formatReportingAverageScore,
  formatReportingCategoryLabel,
  formatReportingCountEntries,
  formatReportingError,
  formatReportingNumber,
  formatReportingPeriod,
  formatReportingPriorityLabel,
  formatReportingStatusLabel,
  isReportingFilterResetRecommended,
  isReportingOverviewEmpty,
} from "@/lib/reporting/display";
import {
  canApplyReportingFilters,
  clearIncompatibleBuilding,
  createDefaultReportingFilters,
  filterReportingBuildingsByOrganization,
  formatCurrentReportingPeriodLabel,
  hasActiveMasterDataFilters,
  resetReportingFilters,
  serializeReportingOverviewParams,
} from "@/lib/reporting/filters";
import { validateReportingDateRange } from "@/lib/reporting/dates";
import type {
  ReportingActiveFilters,
  ReportingFilterDraft,
  ReportingOperationalOverview,
} from "@/types/reporting";

function ReportingMetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

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

function CountTable({
  caption,
  rows,
}: {
  caption: string;
  rows: Array<{ key: string; label: string; count: number }>;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">No values reported for this breakdown.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Value
            </th>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.key}>
              <th className="px-3 py-2 font-medium text-slate-900" scope="row">
                {row.label}
              </th>
              <td className="px-3 py-2 text-slate-700">
                {formatReportingNumber(row.count)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DefinitionGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          key={item.label}
        >
          <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function dateValidationMessage(draft: ReportingFilterDraft): string | null {
  const error = validateReportingDateRange(draft.dateFrom, draft.dateTo);
  if (error === "blank") {
    return "Date From and Date To are required.";
  }
  if (error === "malformed") {
    return "Enter valid Date From and Date To values.";
  }
  if (error === "reversed") {
    return "Date From must be on or before Date To.";
  }
  if (error === "exceeds_max") {
    return "The reporting period cannot exceed 180 calendar days.";
  }
  return null;
}

export function ReportingOverviewScreen() {
  const defaults = useMemo(() => createDefaultReportingFilters(), []);
  const [draft, setDraft] = useState<ReportingFilterDraft>(defaults);
  const [applied, setApplied] = useState<ReportingActiveFilters>(defaults);

  const filterOptionsQuery = useReportingFilterOptions();
  const organizations = filterOptionsQuery.data?.organizations ?? [];
  const buildings = filterOptionsQuery.data?.buildings ?? [];
  const buildingOptions = filterReportingBuildingsByOrganization(
    buildings,
    draft.organization,
  );

  const queryParams = useMemo(
    () => serializeReportingOverviewParams(applied),
    [applied],
  );

  const overviewQuery = useReportingOverview(queryParams ?? undefined);

  const organizationIds = organizations.map((item) => item.id);
  const buildingIds = buildingOptions.map((item) => item.id);
  const optionsReady = filterOptionsQuery.isSuccess;
  const applyEnabled = canApplyReportingFilters(draft, {
    organizationIds,
    buildingIds,
    optionsReady: optionsReady || (!draft.organization && !draft.building),
  });
  const validationMessage = dateValidationMessage(draft);

  const organizationName = organizations.find(
    (item) => item.id === applied.organization,
  )?.name;
  const buildingName = buildings.find(
    (item) => item.id === applied.building,
  )?.name;

  function handleOrganizationChange(organization: string) {
    setDraft((current) => ({
      ...current,
      organization,
      building: clearIncompatibleBuilding(
        organization,
        current.building,
        buildings,
      ),
    }));
  }

  function handleApply() {
    if (!applyEnabled) {
      return;
    }
    setApplied({
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
      organization: draft.organization,
      building: draft.building,
    });
  }

  function handleReset() {
    const next = resetReportingFilters();
    setDraft(next);
    setApplied(next);
  }

  const overview = overviewQuery.data;
  const showOverviewLoading =
    overviewQuery.isPending || overviewQuery.isFetching;
  const showEmpty =
    overview &&
    !overviewQuery.isError &&
    isReportingOverviewEmpty(overview);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Operational summary of FM Tickets, Maintenance Work Orders, and 5S Inspections for the selected reporting period."
        title="Reporting and Operational Analytics"
      >
        <div className="space-y-2 text-sm text-slate-600">
          <p className="font-medium text-slate-900">
            {formatCurrentReportingPeriodLabel(applied, {
              organizationName,
              buildingName,
            })}
          </p>
          {hasActiveMasterDataFilters(applied) ? (
            <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900">
              Organization and/or Building filters are active for this overview.
            </p>
          ) : null}
        </div>
      </PageHeader>

      <SectionCard
        description="Choose a reporting period and optional organization or building scope, then apply filters."
        title="Filters"
      >
        {filterOptionsQuery.isPending ? (
          <LoadingState
            message="Loading Organization and Building filter options."
            title="Loading filter options"
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField htmlFor="reporting-date-from" label="Date From">
            <input
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="reporting-date-from"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
              type="date"
              value={draft.dateFrom}
            />
          </FormField>
          <FormField htmlFor="reporting-date-to" label="Date To">
            <input
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="reporting-date-to"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
              type="date"
              value={draft.dateTo}
            />
          </FormField>
          <SelectField
            disabled={filterOptionsQuery.isPending || filterOptionsQuery.isError}
            id="reporting-organization"
            label="Organization"
            onChange={(event) => handleOrganizationChange(event.target.value)}
            options={organizations.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            placeholder="All organizations"
            value={draft.organization}
          />
          <SelectField
            disabled={filterOptionsQuery.isPending || filterOptionsQuery.isError}
            id="reporting-building"
            label="Building"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                building: event.target.value,
              }))
            }
            options={buildingOptions.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            placeholder="All buildings"
            value={draft.building}
          />
        </div>

        {validationMessage ? (
          <p className="text-sm text-red-700" id="reporting-filter-validation" role="alert">
            {validationMessage}
          </p>
        ) : null}

        {filterOptionsQuery.isError ? (
          <ErrorState
            message={formatReportingError(
              filterOptionsQuery.error,
              "Organization and Building options could not be loaded.",
            )}
            title="Unable to load filter options"
            action={
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
                  onClick={() => void filterOptionsQuery.refetch()}
                  type="button"
                >
                  Retry
                </button>
                <button
                  className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-50"
                  onClick={handleReset}
                  type="button"
                >
                  Reset filters
                </button>
              </div>
            }
          />
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!applyEnabled}
            onClick={handleApply}
            type="button"
          >
            Apply filters
          </button>
          <button
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={handleReset}
            type="button"
          >
            Reset filters
          </button>
        </div>
      </SectionCard>

      {overviewQuery.isError ? (
        <ErrorState
          message={formatReportingError(overviewQuery.error)}
          title="Unable to load reporting overview"
          action={
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
                onClick={() => void overviewQuery.refetch()}
                type="button"
              >
                Retry
              </button>
              {isReportingFilterResetRecommended(overviewQuery.error) ? (
                <button
                  className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-50"
                  onClick={handleReset}
                  type="button"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          }
        />
      ) : null}

      {!overviewQuery.isError && showOverviewLoading && !overview ? (
        <LoadingState
          message="Loading operational totals for the selected reporting filters."
          title="Loading reporting overview"
        />
      ) : null}

      {!overviewQuery.isError && overview ? (
        <>
          {showEmpty ? (
            <EmptyState
              message="No operational data was found for the selected period and filters."
              title="No reporting data"
            />
          ) : (
            <>
              <SectionCard title="Executive Summary">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <ReportingMetricCard
                    label="Total FM Tickets"
                    value={formatReportingNumber(overview.tickets.total)}
                  />
                  <ReportingMetricCard
                    label="Open FM Tickets"
                    value={formatReportingNumber(overview.tickets.open)}
                  />
                  <ReportingMetricCard
                    label="Overdue FM Tickets"
                    value={formatReportingNumber(overview.tickets.overdue)}
                  />
                  <ReportingMetricCard
                    label="Total Work Orders"
                    value={formatReportingNumber(overview.work_orders.total)}
                  />
                  <ReportingMetricCard
                    label="Overdue Work Orders"
                    value={formatReportingNumber(overview.work_orders.overdue)}
                  />
                  <ReportingMetricCard
                    label="Total Inspections"
                    value={formatReportingNumber(overview.inspections.total)}
                  />
                  <ReportingMetricCard
                    label="Average Inspection Score"
                    value={formatReportingAverageScore(
                      overview.inspections.average_score,
                    )}
                  />
                </div>
                {overviewQuery.isFetching ? (
                  <p className="text-sm text-slate-500" role="status">
                    Refreshing overview…
                  </p>
                ) : null}
              </SectionCard>

              <TicketSummarySection overview={overview} />
              <WorkOrderSummarySection overview={overview} />
              <InspectionSummarySection overview={overview} />
            </>
          )}

          {showEmpty ? (
            <p className="text-sm text-slate-500">
              Echoed period:{" "}
              {formatReportingPeriod(
                overview.filters.date_from,
                overview.filters.date_to,
              )}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function TicketSummarySection({
  overview,
}: {
  overview: ReportingOperationalOverview;
}) {
  return (
    <SectionCard
      description="FM Ticket volume, status mix, priority mix, category mix, and SLA outcomes."
      title="FM Ticket Summary"
    >
      <DefinitionGrid
        items={[
          {
            label: "Total",
            value: formatReportingNumber(overview.tickets.total),
          },
          {
            label: "Open",
            value: formatReportingNumber(overview.tickets.open),
          },
          {
            label: "Overdue",
            value: formatReportingNumber(overview.tickets.overdue),
          },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <CountTable
          caption="FM Ticket counts by status"
          rows={formatReportingCountEntries(
            overview.tickets.by_status,
            formatReportingStatusLabel,
          )}
        />
        <CountTable
          caption="FM Ticket counts by priority"
          rows={formatReportingCountEntries(
            overview.tickets.by_priority,
            formatReportingPriorityLabel,
          )}
        />
        <CountTable
          caption="FM Ticket counts by category"
          rows={formatReportingCountEntries(
            overview.tickets.by_category,
            formatReportingCategoryLabel,
          )}
        />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">SLA</h3>
        <div className="mt-3">
          <DefinitionGrid
            items={[
              {
                label: "Response met",
                value: formatReportingNumber(overview.tickets.sla.response_met),
              },
              {
                label: "Response missed",
                value: formatReportingNumber(
                  overview.tickets.sla.response_missed,
                ),
              },
              {
                label: "Resolution met",
                value: formatReportingNumber(
                  overview.tickets.sla.resolution_met,
                ),
              },
              {
                label: "Resolution missed",
                value: formatReportingNumber(
                  overview.tickets.sla.resolution_missed,
                ),
              },
            ]}
          />
        </div>
      </div>
    </SectionCard>
  );
}

function WorkOrderSummarySection({
  overview,
}: {
  overview: ReportingOperationalOverview;
}) {
  return (
    <SectionCard
      description="Maintenance Work Order volume, overdue load, status and priority mix, and Ticket linkage."
      title="Maintenance Work Order Summary"
    >
      <DefinitionGrid
        items={[
          {
            label: "Total",
            value: formatReportingNumber(overview.work_orders.total),
          },
          {
            label: "Overdue",
            value: formatReportingNumber(overview.work_orders.overdue),
          },
          {
            label: "Linked to Ticket",
            value: formatReportingNumber(overview.work_orders.linked_to_ticket),
          },
          {
            label: "Standalone",
            value: formatReportingNumber(overview.work_orders.standalone),
          },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <CountTable
          caption="Work Order counts by status"
          rows={formatReportingCountEntries(
            overview.work_orders.by_status,
            formatReportingStatusLabel,
          )}
        />
        <CountTable
          caption="Work Order counts by priority"
          rows={formatReportingCountEntries(
            overview.work_orders.by_priority,
            formatReportingPriorityLabel,
          )}
        />
      </div>
    </SectionCard>
  );
}

function InspectionSummarySection({
  overview,
}: {
  overview: ReportingOperationalOverview;
}) {
  return (
    <SectionCard
      description="5S Inspection volume, status mix, and scoring coverage."
      title="5S Inspection Summary"
    >
      <DefinitionGrid
        items={[
          {
            label: "Total",
            value: formatReportingNumber(overview.inspections.total),
          },
          {
            label: "Average score",
            value: formatReportingAverageScore(
              overview.inspections.average_score,
            ),
          },
          {
            label: "Scored count",
            value: formatReportingNumber(overview.inspections.scored_count),
          },
        ]}
      />
      <CountTable
        caption="Inspection counts by status"
        rows={formatReportingCountEntries(
          overview.inspections.by_status,
          formatReportingStatusLabel,
        )}
      />
    </SectionCard>
  );
}
