"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { useInspectionDetail } from "@/hooks/use-inspection-detail";
import { usePermissions } from "@/hooks/use-permissions";
import { readInspectionFormFlash } from "@/lib/inspection/form";
import type {
  InspectionAttachment,
  InspectionComment,
  InspectionCorrectiveAction,
  InspectionDetail,
  InspectionEscalation,
  InspectionFinding,
  InspectionHistory,
  InspectionItem,
} from "@/types/inspection";

import { InspectionLoadingSkeleton } from "./inspection-loading-skeleton";
import { InspectionPriorityBadge } from "./inspection-priority-badge";
import { InspectionStatusBadge } from "./inspection-status-badge";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLabel(value?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBoolean(value: boolean | null) {
  if (value === null) {
    return "Not scored";
  }

  return value ? "Pass" : "Fail";
}

function formatPersonLabel(value?: string | null) {
  return value || "Not assigned";
}

function formatLocationLabel(parts: Array<string | null | undefined>) {
  const filtered = parts.filter(Boolean);
  return filtered.length > 0 ? filtered.join(" / ") : "Not assigned";
}

function formatScore(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Not scored";
  }

  return String(value);
}

function formatFileSize(value?: number | null) {
  if (!value) {
    return "Size unavailable";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatInspectionError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetadataList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={item.label}>
          <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function buildItemColumns(): DataTableColumn<InspectionItem>[] {
  return [
    { header: "#", cell: (item) => item.sequence.toString() },
    {
      header: "Checklist Item",
      cell: (item) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{item.checklist_item}</p>
          <p className="mt-1 text-xs text-slate-500">{item.expected_result || "No expected result."}</p>
        </div>
      ),
      className: "min-w-72 whitespace-normal",
    },
    {
      header: "Category",
      cell: (item) => item.category || "Not categorized",
      className: "min-w-32 whitespace-normal",
    },
    {
      header: "Score",
      cell: (item) => `${formatScore(item.score)} / ${item.max_score}`,
      className: "min-w-24 whitespace-normal",
    },
    { header: "Pass / Fail", cell: (item) => formatBoolean(item.is_pass) },
    {
      header: "Observation",
      cell: (item) => item.observation || item.notes || "No observation recorded.",
      className: "min-w-72 whitespace-normal",
    },
  ];
}

function buildFindingColumns(): DataTableColumn<InspectionFinding>[] {
  return [
    { header: "Type", cell: (item) => formatLabel(item.finding_type) },
    { header: "Severity", cell: (item) => formatLabel(item.severity) },
    { header: "Status", cell: (item) => formatLabel(item.status) },
    {
      header: "Description",
      cell: (item) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{item.description}</p>
          <p className="mt-1 text-xs text-slate-500">
            {item.recommendation || "No recommendation recorded."}
          </p>
        </div>
      ),
      className: "min-w-80 whitespace-normal",
    },
    {
      header: "Root Cause",
      cell: (item) => item.root_cause || "Not recorded",
      className: "min-w-64 whitespace-normal",
    },
    {
      header: "Updated",
      cell: (item) => formatDateTime(item.updated_at),
      className: "min-w-40 whitespace-normal",
    },
  ];
}

function buildCorrectiveActionColumns(): DataTableColumn<InspectionCorrectiveAction>[] {
  return [
    {
      header: "Assigned To",
      cell: (item) => formatPersonLabel(item.assigned_to_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Due Date",
      cell: (item) => formatDateTime(item.due_date),
      className: "min-w-40 whitespace-normal",
    },
    { header: "Status", cell: (item) => formatLabel(item.status) },
    {
      header: "Verification",
      cell: (item) => formatLabel(item.verification_status),
      className: "min-w-32 whitespace-normal",
    },
    {
      header: "Notes",
      cell: (item) => item.notes || "No notes recorded.",
      className: "min-w-80 whitespace-normal",
    },
  ];
}

function buildAttachmentColumns(): DataTableColumn<InspectionAttachment>[] {
  return [
    {
      header: "File Name",
      cell: (item) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{item.file_name}</p>
          <p className="mt-1 text-xs text-slate-500">{formatFileSize(item.size_bytes)}</p>
        </div>
      ),
      className: "min-w-60 whitespace-normal",
    },
    {
      header: "Type",
      cell: (item) => item.content_type || "Unknown",
      className: "min-w-32 whitespace-normal",
    },
    {
      header: "Uploaded By",
      cell: (item) => formatPersonLabel(item.uploaded_by_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Note",
      cell: (item) => item.note || "No note recorded.",
      className: "min-w-72 whitespace-normal",
    },
    {
      header: "Created",
      cell: (item) => formatDateTime(item.created_at),
      className: "min-w-40 whitespace-normal",
    },
  ];
}

function buildCommentColumns(): DataTableColumn<InspectionComment>[] {
  return [
    {
      header: "Author",
      cell: (item) => formatPersonLabel(item.author_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Comment",
      cell: (item) => item.body,
      className: "min-w-96 whitespace-normal",
    },
    {
      header: "Internal",
      cell: (item) => (item.is_internal ? "Yes" : "No"),
    },
    {
      header: "Created",
      cell: (item) => formatDateTime(item.created_at),
      className: "min-w-40 whitespace-normal",
    },
  ];
}

function buildHistoryColumns(): DataTableColumn<InspectionHistory>[] {
  return [
    {
      header: "Actor",
      cell: (item) => formatPersonLabel(item.actor_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Action",
      cell: (item) => formatLabel(item.action),
      className: "min-w-32 whitespace-normal",
    },
    {
      header: "Description",
      cell: (item) => item.description,
      className: "min-w-96 whitespace-normal",
    },
    {
      header: "Created",
      cell: (item) => formatDateTime(item.created_at),
      className: "min-w-40 whitespace-normal",
    },
  ];
}

function buildEscalationColumns(): DataTableColumn<InspectionEscalation>[] {
  return [
    {
      header: "Type",
      cell: (item) => formatLabel(item.escalation_type),
      className: "min-w-40 whitespace-normal",
    },
    {
      header: "Status",
      cell: (item) => formatLabel(item.status),
    },
    {
      header: "Escalated To",
      cell: (item) => formatPersonLabel(item.escalated_to_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Reason",
      cell: (item) => item.reason,
      className: "min-w-80 whitespace-normal",
    },
    {
      header: "Created",
      cell: (item) => formatDateTime(item.created_at),
      className: "min-w-40 whitespace-normal",
    },
  ];
}

function DataSection<T>({
  title,
  description,
  rows,
  columns,
  caption,
  getRowKey,
  emptyTitle,
  emptyMessage,
}: {
  title: string;
  description: string;
  rows: T[];
  columns: DataTableColumn<T>[];
  caption: string;
  getRowKey: (row: T) => string;
  emptyTitle: string;
  emptyMessage: string;
}) {
  return (
    <SectionCard description={description} title={title}>
      {rows.length === 0 ? (
        <EmptyState message={emptyMessage} title={emptyTitle} />
      ) : (
        <DataTable
          caption={caption}
          columns={columns}
          getRowKey={getRowKey}
          rows={rows}
        />
      )}
    </SectionCard>
  );
}

function renderSummary(detail: InspectionDetail) {
  return (
    <>
      <SectionCard
        title="Summary"
        description="Primary inspection identity, category, scoring, and current workflow state."
      >
        <MetadataList
          items={[
            { label: "Inspection Number", value: detail.inspection_number },
            { label: "Title", value: detail.title },
            { label: "Status", value: <InspectionStatusBadge status={detail.status} /> },
            {
              label: "Priority",
              value: <InspectionPriorityBadge priority={detail.priority} />,
            },
            { label: "Inspection Type", value: formatLabel(detail.inspection_type) },
            { label: "5S Category", value: formatLabel(detail.five_s_category) },
            { label: "Inspection Template", value: detail.inspection_template || "Not recorded" },
            {
              label: "Score",
              value: `${formatScore(detail.score)} / ${formatScore(detail.calculated_score)}`,
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Location"
        description="Tenant, organization, and facility context for this inspection."
      >
        <MetadataList
          items={[
            { label: "Tenant", value: detail.tenant_name },
            { label: "Organization", value: detail.organization_name },
            { label: "Department", value: detail.department_name || "Not assigned" },
            { label: "Building", value: detail.building_name },
            { label: "Floor", value: detail.floor_name || "Not assigned" },
            { label: "Area", value: detail.area_name || "Not assigned" },
            {
              label: "Location",
              value: formatLocationLabel([
                detail.building_name,
                detail.floor_name,
                detail.area_name,
              ]),
            },
            { label: "Remarks", value: detail.remarks || "No remarks recorded." },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="People and Schedule"
        description="Inspection ownership and key lifecycle timestamps."
      >
        <MetadataList
          items={[
            { label: "Inspector", value: formatPersonLabel(detail.inspector_email) },
            { label: "Supervisor", value: formatPersonLabel(detail.supervisor_email) },
            { label: "Scheduled Date", value: formatDateTime(detail.scheduled_date) },
            { label: "Started Date", value: formatDateTime(detail.started_date) },
            { label: "Completed Date", value: formatDateTime(detail.completed_date) },
            { label: "Verified Date", value: formatDateTime(detail.verified_date) },
            { label: "Created Date", value: formatDateTime(detail.created_at) },
            { label: "Updated Date", value: formatDateTime(detail.updated_at) },
          ]}
        />
      </SectionCard>
    </>
  );
}

export function InspectionDetailScreen({ id }: { id: string }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const detailQuery = useInspectionDetail(id);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    setFlashMessage(readInspectionFormFlash());
  }, []);

  if (detailQuery.isPending) {
    return <InspectionLoadingSkeleton cards={4} rows={10} />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Unable to load inspection detail"
        message={formatInspectionError(
          detailQuery.error,
          "The selected inspection could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void detailQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  const detail = detailQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Read-only inspection detail for ${detail.inspection_number}. This page surfaces checklist items, findings, corrective actions, attachments, comments, history, SLA, escalations, and any AI metadata already present in the backend response.`}
        eyebrow="5S Inspection"
        title={detail.title}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/inspection/inspections"
          >
            Back to list
          </Link>
          {!permissionsLoading &&
          (hasPermission("inspection.update") ||
            hasPermission("inspection.manage")) ? (
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/inspection/inspections/${id}/edit`}
            >
              Edit Inspection
            </Link>
          ) : null}
          <InspectionStatusBadge status={detail.status} />
          <InspectionPriorityBadge priority={detail.priority} />
        </div>
      </PageHeader>

      {flashMessage ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {flashMessage}
        </section>
      ) : null}

      {renderSummary(detail)}

      <DataSection
        caption="Inspection checklist items"
        columns={buildItemColumns()}
        description="Checklist items returned directly by the inspection detail endpoint."
        emptyMessage="This inspection does not have checklist items yet."
        emptyTitle="No checklist items"
        getRowKey={(item) => item.id}
        rows={detail.items}
        title="Checklist Items"
      />

      <DataSection
        caption="Inspection findings"
        columns={buildFindingColumns()}
        description="Recorded findings and their current recommendation status."
        emptyMessage="This inspection does not have findings yet."
        emptyTitle="No findings"
        getRowKey={(item) => item.id}
        rows={detail.findings}
        title="Findings"
      />

      <DataSection
        caption="Inspection corrective actions"
        columns={buildCorrectiveActionColumns()}
        description="Corrective actions currently associated with this inspection."
        emptyMessage="This inspection does not have corrective actions yet."
        emptyTitle="No corrective actions"
        getRowKey={(item) => item.id}
        rows={detail.corrective_actions}
        title="Corrective Actions"
      />

      <DataSection
        caption="Inspection attachment metadata"
        columns={buildAttachmentColumns()}
        description="Attachment metadata only. File upload and download remain outside FO-039."
        emptyMessage="No attachment metadata is currently associated with this inspection."
        emptyTitle="No attachments"
        getRowKey={(item) => item.id}
        rows={detail.attachments}
        title="Attachments"
      />

      <DataSection
        caption="Inspection comments"
        columns={buildCommentColumns()}
        description="Comments and internal notes recorded against the inspection."
        emptyMessage="No comments are currently associated with this inspection."
        emptyTitle="No comments"
        getRowKey={(item) => item.id}
        rows={detail.comments}
        title="Comments"
      />

      <DataSection
        caption="Inspection history"
        columns={buildHistoryColumns()}
        description="Read-only audit trail currently returned by the backend detail serializer."
        emptyMessage="No history entries are currently available for this inspection."
        emptyTitle="No history"
        getRowKey={(item) => item.id}
        rows={detail.history}
        title="History"
      />

      <SectionCard
        title="SLA Summary"
        description="SLA timing and breach indicators, when an SLA record exists."
      >
        {detail.sla ? (
          <MetadataList
            items={[
              { label: "SLA Status", value: formatLabel(detail.sla.sla_status) },
              { label: "Target Minutes", value: detail.sla.target_minutes.toString() },
              { label: "Warning Minutes", value: detail.sla.warning_minutes.toString() },
              { label: "Due At", value: formatDateTime(detail.sla.due_at) },
              {
                label: "Verification Due At",
                value: formatDateTime(detail.sla.verification_due_at),
              },
              {
                label: "Completion Breached",
                value: detail.sla.completion_breached ? "Yes" : "No",
              },
              {
                label: "Verification Breached",
                value: detail.sla.verification_breached ? "Yes" : "No",
              },
              {
                label: "Last Recalculated",
                value: formatDateTime(detail.sla.last_recalculated_at),
              },
            ]}
          />
        ) : (
          <EmptyState
            title="No SLA record"
            message="An SLA summary is not currently available for this inspection."
          />
        )}
      </SectionCard>

      <DataSection
        caption="Inspection escalations"
        columns={buildEscalationColumns()}
        description="Escalations that exist for this inspection in the current backend payload."
        emptyMessage="No escalations are currently associated with this inspection."
        emptyTitle="No escalations"
        getRowKey={(item) => item.id}
        rows={detail.escalations}
        title="Escalations"
      />

      <SectionCard
        title="AI Analysis"
        description="Read-only AI analysis metadata already stored in the backend foundation."
      >
        {detail.ai_analysis ? (
          <MetadataList
            items={[
              { label: "Model", value: detail.ai_analysis.model_name || "Not recorded" },
              {
                label: "Generated At",
                value: formatDateTime(detail.ai_analysis.generated_at),
              },
              { label: "Summary", value: detail.ai_analysis.summary || "No summary recorded." },
              {
                label: "Analysis",
                value: detail.ai_analysis.analysis || "No analysis recorded.",
              },
              {
                label: "Recommendation Summary",
                value:
                  detail.ai_analysis.recommendation_summary ||
                  "No recommendation summary recorded.",
              },
              {
                label: "Source Notes",
                value: detail.ai_analysis.source_notes || "No source notes recorded.",
              },
            ]}
          />
        ) : (
          <EmptyState
            title="No AI analysis"
            message="No AI analysis record is currently stored for this inspection."
          />
        )}
      </SectionCard>
    </div>
  );
}
