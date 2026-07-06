"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";
import { getFmTickets } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";
import type { SelectOption } from "@/components/common/select-field";
import type { FmTicketListItem, FmTicketListParams } from "@/types/fm-tickets";

import { TicketFilters, type TicketFilterValues } from "./ticket-filters";
import { TicketPriorityBadge } from "./ticket-priority-badge";
import { TicketStatusBadge } from "./ticket-status-badge";
import {
  formatDateTime,
  formatPersonLabel,
  formatTicketLabel,
} from "./ticket-shared";

const DEFAULT_LIST_PARAMS: FmTicketListParams = {
  page_size: 100,
};

const DEFAULT_FILTERS: TicketFilterValues = {
  search: "",
  status: "",
  priority: "",
  category: "",
  building: "",
  assignee: "",
};

function CellStack({
  primary,
  secondary,
}: {
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="min-w-0 whitespace-normal">
      <p className="font-medium text-slate-900">{primary}</p>
      {secondary ? <p className="mt-1 text-xs text-slate-500">{secondary}</p> : null}
    </div>
  );
}

function buildFilterOptions(
  tickets: FmTicketListItem[],
  selector: (ticket: FmTicketListItem) => { value: string | null; label: string | null },
): SelectOption[] {
  const seen = new Set<string>();
  const options: SelectOption[] = [];

  for (const ticket of tickets) {
    const option = selector(ticket);
    if (!option.value || !option.label || seen.has(option.value)) {
      continue;
    }

    seen.add(option.value);
    options.push({
      value: option.value,
      label: option.label,
    });
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

export function TicketListScreen() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("fm_tickets.create");
  const canUpdate = hasPermission("fm_tickets.update");
  const [filters, setFilters] = useState<TicketFilterValues>(DEFAULT_FILTERS);
  const deferredSearch = useDeferredValue(filters.search.trim().toLowerCase());

  const queryParams: FmTicketListParams = {
    ...DEFAULT_LIST_PARAMS,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    category: filters.category || undefined,
    building: filters.building || undefined,
    assignee: filters.assignee || undefined,
  };

  const ticketsQuery = useQuery({
    queryKey: fmTicketsQueryKeys.list(queryParams),
    queryFn: () => getFmTickets(queryParams),
  });

  const tickets = ticketsQuery.data?.results ?? [];
  const visibleTickets = tickets.filter((ticket) => {
    if (!deferredSearch) {
      return true;
    }

    const haystack = `${ticket.ticket_number} ${ticket.title}`.toLowerCase();
    return haystack.includes(deferredSearch);
  });

  const buildingOptions = buildFilterOptions(tickets, (ticket) => ({
    value: ticket.building,
    label: ticket.building_name,
  }));
  const assigneeOptions = buildFilterOptions(tickets, (ticket) => ({
    value: ticket.assignee,
    label: ticket.assignee_email,
  }));

  const columns: DataTableColumn<FmTicketListItem>[] = [
    {
      header: "Ticket number",
      cell: (ticket) => ticket.ticket_number,
    },
    {
      header: "Title",
      cell: (ticket) => <CellStack primary={ticket.title} secondary={ticket.organization_name} />,
      className: "min-w-72 whitespace-normal",
    },
    {
      header: "Status",
      cell: (ticket) => <TicketStatusBadge status={ticket.status} />,
    },
    {
      header: "Priority",
      cell: (ticket) => <TicketPriorityBadge priority={ticket.priority} />,
    },
    {
      header: "Category",
      cell: (ticket) => formatTicketLabel(ticket.category),
    },
    {
      header: "Building",
      cell: (ticket) => ticket.building_name,
    },
    {
      header: "Area",
      cell: (ticket) => ticket.area_name || "Not assigned",
    },
    {
      header: "Asset",
      cell: (ticket) => ticket.asset_name || "Not assigned",
    },
    {
      header: "Requester",
      cell: (ticket) => formatPersonLabel(ticket.requester_email, "Unavailable"),
      className: "min-w-56",
    },
    {
      header: "Assignee",
      cell: (ticket) => formatPersonLabel(ticket.assignee_email),
      className: "min-w-56",
    },
    {
      header: "Reported date",
      cell: (ticket) => formatDateTime(ticket.reported_at),
      className: "min-w-44 whitespace-normal",
    },
    {
      header: "Due date",
      cell: (ticket) => formatDateTime(ticket.due_at),
      className: "min-w-44 whitespace-normal",
    },
    {
      header: "Actions",
      cell: (ticket) => (
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/fm-tickets/${ticket.id}`}
          >
            View detail
          </Link>
          {canUpdate ? (
            <Link
              className="inline-flex items-center rounded-md border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              href={`/fm-tickets/${ticket.id}/edit`}
            >
              Edit
            </Link>
          ) : null}
        </div>
      ),
      className: "min-w-48 whitespace-normal",
    },
  ];

  const hasServerRows = tickets.length > 0;
  const hasVisibleRows = visibleTickets.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        description="FM ticket list powered by the existing authenticated API client and permission guard. Create and edit entry points are available for authorized users, while assignment, status-change, comments, and attachments remain out of scope."
        eyebrow="FM Ticketing"
        title="FM Tickets"
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <DetailField label="Visible rows" value={visibleTickets.length} />
          <DetailField label="Loaded rows" value={tickets.length} />
          <DetailField label="Total records" value={ticketsQuery.data?.count ?? 0} />
        </dl>
        {canCreate ? (
          <div className="mt-4">
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href="/fm-tickets/new"
            >
              New Ticket
            </Link>
          </div>
        ) : null}
      </PageHeader>

      <TicketFilters
        assigneeOptions={assigneeOptions}
        buildingOptions={buildingOptions}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        values={filters}
      />

      {ticketsQuery.isPending ? (
        <LoadingState
          title="Loading FM tickets"
          message="Retrieving FM tickets from the backend."
        />
      ) : null}

      {!ticketsQuery.isPending && ticketsQuery.isError ? (
        <ErrorState
          title="Unable to load FM tickets"
          message={getFirstQueryErrorMessage(
            [ticketsQuery.error],
            "FM tickets could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void ticketsQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!ticketsQuery.isPending && !ticketsQuery.isError && !hasServerRows ? (
        <EmptyState
          title="No FM tickets found"
          message="The backend did not return any FM tickets for the current filters."
        />
      ) : null}

      {!ticketsQuery.isPending && !ticketsQuery.isError && hasServerRows && !hasVisibleRows ? (
        <EmptyState
          title="No matching tickets on this page"
          message="The current search text did not match any loaded ticket numbers or titles."
        />
      ) : null}

      {!ticketsQuery.isPending && !ticketsQuery.isError && hasVisibleRows ? (
        <DataTable
          caption="FM ticket list"
          columns={columns}
          getRowKey={(ticket) => ticket.id}
          rows={visibleTickets}
        />
      ) : null}
    </div>
  );
}
