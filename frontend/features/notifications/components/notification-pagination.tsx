import { FormField } from "@/components/common/form-field";

export interface NotificationPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  isDisabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function NotificationPagination({
  page,
  pageSize,
  totalCount,
  isDisabled = false,
  onPageChange,
  onPageSizeChange,
}: NotificationPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const canGoPrevious = page > 1 && !isDisabled;
  const canGoNext = page < totalPages && !isDisabled;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Pagination</h2>
          <p className="mt-1 text-sm text-slate-600">
            Page {page} of {totalPages}. {totalCount.toLocaleString()} total
            notifications.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FormField htmlFor="notification-page-size-control" label="Rows per page">
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              disabled={isDisabled}
              id="notification-page-size-control"
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              value={String(pageSize)}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="notification-page-jump" label="Jump to page">
            <input
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              disabled={isDisabled}
              id="notification-page-jump"
              max={totalPages}
              min={1}
              onChange={(event) => {
                const nextPage = Number(event.target.value);
                if (
                  !Number.isNaN(nextPage) &&
                  nextPage >= 1 &&
                  nextPage <= totalPages
                ) {
                  onPageChange(nextPage);
                }
              }}
              type="number"
              value={String(page)}
            />
          </FormField>

          <div className="flex items-end gap-2">
            <button
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canGoPrevious}
              onClick={() => onPageChange(page - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canGoNext}
              onClick={() => onPageChange(page + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
