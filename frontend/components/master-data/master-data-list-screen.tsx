"use client";

import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DetailField } from "@/components/common/detail-field";
import { PageHeader } from "@/components/common/page-header";

export interface MasterDataListScreenProps<T> {
  title: string;
  description: string;
  items: T[];
  count: number;
  columns: DataTableColumn<T>[];
  isLoading: boolean;
  errorMessage?: string | null;
  emptyMessage: string;
  onRetry: () => void;
  getRowKey: (row: T) => string;
}

export function MasterDataListScreen<T>({
  columns,
  count,
  description,
  emptyMessage,
  errorMessage,
  getRowKey,
  isLoading,
  items,
  onRetry,
  title,
}: MasterDataListScreenProps<T>) {
  return (
    <div className="space-y-6">
      <PageHeader
        description={description}
        eyebrow="Master data"
        title={title}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Visible rows" value={items.length} />
          <DetailField label="Total records" value={count} />
        </dl>
      </PageHeader>

      {isLoading ? (
        <LoadingState
          title={`Loading ${title.toLowerCase()}`}
          message="Retrieving the latest master data from the backend."
        />
      ) : null}

      {!isLoading && errorMessage ? (
        <ErrorState
          title={`Unable to load ${title.toLowerCase()}`}
          message={errorMessage}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={onRetry}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!isLoading && !errorMessage && items.length === 0 ? (
        <EmptyState
          title={`No ${title.toLowerCase()} found`}
          message={emptyMessage}
        />
      ) : null}

      {!isLoading && !errorMessage && items.length > 0 ? (
        <DataTable
          caption={`${title} list`}
          columns={columns}
          getRowKey={getRowKey}
          rows={items}
        />
      ) : null}
    </div>
  );
}
