"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { useMaintenanceDetail } from "@/hooks/use-maintenance-detail";
import { useMaintenanceHistory } from "@/hooks/use-maintenance-history";
import { usePermissions } from "@/hooks/use-permissions";
import { readMaintenanceFormFlash } from "@/lib/maintenance/form";
import {
  buildMaintenanceTimeline,
  calculateTaskCompletionPercent,
  formatDateTime,
  formatDurationHours,
  formatFileSize,
  formatLocationLabel,
  formatMaintenanceError,
  formatMaintenanceLabel,
  formatPersonLabel,
} from "@/lib/maintenance/display";
import { getLinkedWorkOrderSyncMessage } from "@/lib/maintenance/ticket-sync";
import type {
  MaintenanceAttachment,
  MaintenanceLabor,
  MaintenanceMaterial,
  MaintenanceTask,
} from "@/types/maintenance";

import { MaintenanceHistoryTimeline } from "./maintenance-history-timeline";
import { MaintenanceAssignmentCard } from "./maintenance-assignment-card";
import { MaintenanceEscalationCard } from "./maintenance-escalation-card";
import { MaintenanceSLACard } from "./maintenance-sla-card";
import { MaintenanceLoadingSkeleton } from "./maintenance-loading-skeleton";
import { MaintenancePriorityBadge } from "./maintenance-priority-badge";
import { MaintenanceStatusBadge } from "./maintenance-status-badge";
import {
  MaintenanceStatusTimeline,
  MaintenanceWorkflowActions,
} from "./maintenance-workflow-actions";
import { MetadataList, SectionCard, UnavailableValue } from "./maintenance-shared";

function renderDisabledAction(label: string) {
  return (
    <button
      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-400"
      disabled
      type="button"
    >
      {label}
    </button>
  );
}

export function MaintenanceDetailScreen({ id }: { id: string }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const detailQuery = useMaintenanceDetail(id);
  const historyQuery = useMaintenanceHistory(id);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    setFlashMessage(readMaintenanceFormFlash());
  }, []);

  if (detailQuery.isPending || historyQuery.isPending) {
    return <MaintenanceLoadingSkeleton cards={4} rows={10} />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Unable to load maintenance work order"
        message={formatMaintenanceError(
          detailQuery.error,
          "The selected maintenance work order could not be loaded.",
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

  if (historyQuery.isError) {
    return (
      <ErrorState
        title="Unable to load maintenance history"
        message={formatMaintenanceError(
          historyQuery.error,
          "The maintenance history timeline could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void historyQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  const workOrder = detailQuery.data;
  const historyEntries = historyQuery.data?.results ?? [];
  const timelineEvents = buildMaintenanceTimeline(
    historyEntries,
    workOrder.status_history,
    workOrder.assignments,
    workOrder.escalations,
    workOrder.completion_record,
  );

  const taskColumns: DataTableColumn<MaintenanceTask>[] = [
    {
      header: "Task Name",
      cell: (task) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{task.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {task.description || "No task description recorded."}
          </p>
        </div>
      ),
      className: "min-w-72 whitespace-normal",
    },
    {
      header: "Status",
      cell: (task) => formatMaintenanceLabel(task.status),
    },
    {
      header: "Assigned To",
      cell: (task) => formatPersonLabel(task.assigned_to_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Estimated Hours",
      cell: () => <UnavailableValue label="Not captured" />,
      className: "min-w-36 whitespace-normal",
    },
    {
      header: "Actual Hours",
      cell: () => <UnavailableValue label="Not captured" />,
      className: "min-w-36 whitespace-normal",
    },
    {
      header: "Completion %",
      cell: (task) => calculateTaskCompletionPercent(task.status),
    },
  ];

  const materialColumns: DataTableColumn<MaintenanceMaterial>[] = [
    { header: "Material", cell: (item) => item.name, className: "min-w-48 whitespace-normal" },
    { header: "Quantity", cell: (item) => item.quantity },
    { header: "Unit", cell: (item) => item.unit },
    {
      header: "Issued By",
      cell: () => <UnavailableValue label="Not captured" />,
      className: "min-w-36 whitespace-normal",
    },
    {
      header: "Issued Date",
      cell: () => <UnavailableValue label="Not captured" />,
      className: "min-w-36 whitespace-normal",
    },
  ];

  const laborColumns: DataTableColumn<MaintenanceLabor>[] = [
    {
      header: "Technician",
      cell: (item) => formatPersonLabel(item.performed_by_email, "Unavailable"),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Hours",
      cell: (item) => formatDurationHours(item.hours),
    },
    {
      header: "Rate",
      cell: () => <UnavailableValue label="Not captured" />,
      className: "min-w-32 whitespace-normal",
    },
    {
      header: "Total Cost",
      cell: () => <UnavailableValue label="Not captured" />,
      className: "min-w-32 whitespace-normal",
    },
  ];

  const attachmentColumns: DataTableColumn<MaintenanceAttachment>[] = [
    {
      header: "File Name",
      cell: (item) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{item.file_name}</p>
          <p className="mt-1 text-xs text-slate-500">{formatFileSize(item.size_bytes)}</p>
        </div>
      ),
      className: "min-w-56 whitespace-normal",
    },
    {
      header: "Preview",
      cell: () => renderDisabledAction("Preview unavailable"),
      className: "min-w-44 whitespace-normal",
    },
    {
      header: "Download",
      cell: () => renderDisabledAction("Download unavailable"),
      className: "min-w-44 whitespace-normal",
    },
    {
      header: "Uploaded By",
      cell: (item) => formatPersonLabel(item.uploaded_by_email, "Unavailable"),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Uploaded Date",
      cell: (item) => formatDateTime(item.created_at),
      className: "min-w-40 whitespace-normal",
    },
  ];

  return (
    <div className="space-y-6">
      {flashMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {flashMessage}
        </div>
      ) : null}
      <PageHeader
        description={`Maintenance work order detail for ${workOrder.work_order_number}. This screen surfaces workflow actions, assignment context, tasks, materials, labor, SLA, AI summary, and backend history.`}
        eyebrow="Maintenance"
        title={workOrder.title}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/maintenance"
          >
            Back to dashboard
          </Link>
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/maintenance/work-orders"
          >
            Back to list
          </Link>
          {!permissionsLoading &&
          (hasPermission("maintenance.update") ||
            hasPermission("maintenance.work_order.update")) ? (
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/maintenance/work-orders/${id}/edit`}
            >
              Edit work order
            </Link>
          ) : null}
          <MaintenanceStatusBadge status={workOrder.status} />
          <MaintenancePriorityBadge priority={workOrder.priority} />
        </div>
      </PageHeader>

      <MaintenanceWorkflowActions workOrder={workOrder} />

      <SectionCard title="Header" description="Primary work order identity and ownership.">
        <MetadataList
          items={[
            { label: "Work Order Number", value: workOrder.work_order_number },
            { label: "Status", value: <MaintenanceStatusBadge status={workOrder.status} /> },
            {
              label: "Priority",
              value: <MaintenancePriorityBadge priority={workOrder.priority} />,
            },
            { label: "Created Date", value: formatDateTime(workOrder.created_at) },
            { label: "Due Date", value: formatDateTime(workOrder.due_at) },
            { label: "Completion Date", value: formatDateTime(workOrder.completed_at) },
            {
              label: "Created By",
              value: formatPersonLabel(workOrder.requester_email, "Unavailable"),
            },
            { label: "Organization", value: workOrder.organization_name },
            {
              label: "Department",
              value: workOrder.department_name || "Not assigned",
            },
          ]}
        />
      </SectionCard>

      {workOrder.source_ticket ? (
        <SectionCard
          title="Source FM Ticket"
          description="This work order was generated from an FM ticket by a coordinator."
        >
          <p className="mb-4 text-sm text-slate-600" role="note">
            {getLinkedWorkOrderSyncMessage(workOrder.source_ticket)}
          </p>
          <MetadataList
            items={[
              {
                label: "Ticket number",
                value: workOrder.source_ticket.ticket_number,
              },
              {
                label: "Ticket status",
                value: formatMaintenanceLabel(workOrder.source_ticket.status),
              },
              {
                label: "Ticket title",
                value: workOrder.source_ticket.title,
              },
              {
                label: "Open ticket",
                value: (
                  <Link
                    className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
                    href={`/fm-tickets/${workOrder.source_ticket.id}`}
                  >
                    View FM ticket
                  </Link>
                ),
              },
            ]}
          />
        </SectionCard>
      ) : null}

      <SectionCard
        title="Basic Information"
        description="Backend foundation fields plus clearly marked placeholders where later tasks extend the data model."
      >
        <MetadataList
          items={[
            { label: "Title", value: workOrder.title },
            {
              label: "Description",
              value: (
                <span className="whitespace-pre-wrap font-normal text-slate-700">
                  {workOrder.description}
                </span>
              ),
            },
            { label: "Category", value: <UnavailableValue /> },
            { label: "Maintenance Type", value: <UnavailableValue /> },
            { label: "Estimated Hours", value: <UnavailableValue /> },
            {
              label: "Actual Hours",
              value: workOrder.completion_record
                ? formatDurationHours(
                    workOrder.labor_entries.reduce(
                      (total, item) => total + Number(item.hours || 0),
                      0,
                    ),
                  )
                : "Not recorded",
            },
            { label: "Notes", value: workOrder.cancellation_reason || "No notes recorded" },
          ]}
        />
      </SectionCard>

      <SectionCard title="Asset Information" description="Asset, site, and location context.">
        <MetadataList
          items={[
            { label: "Asset", value: workOrder.asset_name },
            { label: "Asset Code", value: workOrder.asset_code },
            { label: "Building", value: workOrder.building_name },
            { label: "Floor", value: workOrder.floor_name || "Not assigned" },
            { label: "Area", value: workOrder.area_name || "Not assigned" },
            {
              label: "Location",
              value: formatLocationLabel([
                workOrder.building_name,
                workOrder.floor_name,
                workOrder.area_name,
              ]),
            },
            { label: "QR Code", value: <UnavailableValue label="Not captured in backend" /> },
          ]}
        />
      </SectionCard>

      <MaintenanceAssignmentCard workOrder={workOrder} />

      <SectionCard title="Tasks" description="Maintenance tasks returned directly by the backend detail endpoint.">
        {workOrder.tasks.length === 0 ? (
          <EmptyState
            title="No tasks recorded"
            message="This work order does not have task records yet."
          />
        ) : (
          <DataTable
            caption="Maintenance task list"
            columns={taskColumns}
            getRowKey={(task) => task.id}
            rows={workOrder.tasks}
          />
        )}
      </SectionCard>

      <SectionCard title="Materials" description="Issued materials linked to this work order.">
        {workOrder.materials.length === 0 ? (
          <EmptyState
            title="No materials recorded"
            message="This work order does not have material records yet."
          />
        ) : (
          <DataTable
            caption="Maintenance materials"
            columns={materialColumns}
            getRowKey={(material) => material.id}
            rows={workOrder.materials}
          />
        )}
      </SectionCard>

      <SectionCard title="Labor" description="Labor entries currently recorded for this work order.">
        {workOrder.labor_entries.length === 0 ? (
          <EmptyState
            title="No labor entries recorded"
            message="This work order does not have labor records yet."
          />
        ) : (
          <DataTable
            caption="Maintenance labor entries"
            columns={laborColumns}
            getRowKey={(labor) => labor.id}
            rows={workOrder.labor_entries}
          />
        )}
      </SectionCard>

      <SectionCard title="Attachments" description="Attachment metadata only. File preview and download are deferred until a later attachment task.">
        {workOrder.attachments.length === 0 ? (
          <EmptyState
            title="No attachments"
            message="No attachment metadata is currently associated with this work order."
          />
        ) : (
          <DataTable
            caption="Maintenance attachments"
            columns={attachmentColumns}
            getRowKey={(attachment) => attachment.id}
            rows={workOrder.attachments}
          />
        )}
      </SectionCard>

      <SectionCard title="AI Summary" description="Read-only AI summary fields currently available from the backend foundation.">
        <MetadataList
          items={[
            {
              label: "Issue Summary",
              value: workOrder.ai_summary?.summary || <UnavailableValue />,
            },
            { label: "Probable Cause", value: <UnavailableValue /> },
            {
              label: "Recommended Action",
              value: workOrder.ai_summary?.source_notes || <UnavailableValue />,
            },
            { label: "Risk Level", value: <UnavailableValue /> },
            { label: "Confidence", value: <UnavailableValue /> },
            { label: "Suggested Parts", value: <UnavailableValue /> },
            { label: "Estimated Duration", value: <UnavailableValue /> },
            {
              label: "AI Generated Date",
              value: formatDateTime(workOrder.ai_summary?.generated_at),
            },
          ]}
        />
      </SectionCard>

      <MaintenanceSLACard workOrder={workOrder} />

      <MaintenanceStatusTimeline statusHistory={workOrder.status_history} />
      <MaintenanceHistoryTimeline events={timelineEvents} />

      <SectionCard title="Audit" description="Audit metadata currently exposed by the backend foundation.">
        <MetadataList
          items={[
            {
              label: "Created By",
              value: workOrder.created_by ? (
                <span className="font-mono text-xs">{workOrder.created_by}</span>
              ) : (
                formatPersonLabel(workOrder.requester_email, "Unavailable")
              ),
            },
            { label: "Created Date", value: formatDateTime(workOrder.created_at) },
            {
              label: "Updated By",
              value: workOrder.updated_by ? (
                <span className="font-mono text-xs">{workOrder.updated_by}</span>
              ) : (
                <UnavailableValue label="Not recorded" />
              ),
            },
            { label: "Updated Date", value: formatDateTime(workOrder.updated_at) },
            { label: "Version", value: <UnavailableValue label="Versioning not exposed" /> },
          ]}
        />
      </SectionCard>

      <SectionCard title="Completion Record" description="Completion-specific notes when the work order has been completed.">
        {workOrder.completion_record ? (
          <MetadataList
            items={[
              {
                label: "Completed By",
                value: formatPersonLabel(
                  workOrder.completion_record.completed_by_email,
                  "Unavailable",
                ),
              },
              {
                label: "Completed At",
                value: formatDateTime(workOrder.completion_record.completed_at),
              },
              {
                label: "Resolution Summary",
                value:
                  workOrder.completion_record.resolution_summary || "No resolution summary recorded",
              },
              {
                label: "Completion Notes",
                value:
                  workOrder.completion_record.completion_notes || "No completion notes recorded",
              },
              {
                label: "Downtime",
                value:
                  workOrder.completion_record.downtime_minutes !== null
                    ? `${workOrder.completion_record.downtime_minutes} min`
                    : "Not recorded",
              },
              {
                label: "Follow Up Required",
                value: workOrder.completion_record.follow_up_required ? "Yes" : "No",
              },
            ]}
          />
        ) : (
          <EmptyState
            title="No completion record"
            message="This work order does not have a completion record yet."
          />
        )}
      </SectionCard>

      <MaintenanceEscalationCard workOrder={workOrder} />
    </div>
  );
}
