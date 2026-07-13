"use client";

import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import {
  useNotificationUnreadCount,
  useNotifications,
} from "@/hooks/use-notifications";
import {
  buildNotificationListParams,
  formatNotificationError,
  formatUnreadBadgeCount,
  hasActiveNotificationFilters,
} from "@/lib/notifications/display";
import type { NotificationListFilters } from "@/types/notifications";

import { NotificationFilters } from "./notification-filters";
import { NotificationList } from "./notification-list";
import { NotificationPagination } from "./notification-pagination";

const DEFAULT_FILTERS: NotificationListFilters = {
  readState: "",
  severity: "",
  sourceModule: "",
  pageSize: 20,
};

export function NotificationCenterScreen() {
  const [filters, setFilters] = useState<NotificationListFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const queryParams = buildNotificationListParams(filters, page);
  const notificationsQuery = useNotifications(queryParams);
  const unreadCountQuery = useNotificationUnreadCount();
  const unreadBadge = formatUnreadBadgeCount(
    unreadCountQuery.data?.unread_count ?? 0,
  );
  const filtersActive = hasActiveNotificationFilters(filters);
  const isDisabled = notificationsQuery.isFetching;

  function handleFiltersChange(nextFilters: NotificationListFilters) {
    setFilters(nextFilters);
    setPage(1);
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review in-app updates for your account. Notification interactions remain read-only in this release."
        eyebrow="Notifications"
        title="Notification Center"
      />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Unread summary</h2>
        <p className="mt-2 text-sm text-slate-600">
          {unreadCountQuery.isPending ? (
            "Loading unread count..."
          ) : unreadCountQuery.isError ? (
            "Unread count is temporarily unavailable."
          ) : unreadBadge ? (
            <>
              You have <span className="font-semibold text-slate-950">{unreadBadge}</span>{" "}
              unread notification{unreadCountQuery.data?.unread_count === 1 ? "" : "s"}.
            </>
          ) : (
            "You are caught up. There are no unread notifications."
          )}
        </p>
      </section>

      <NotificationFilters
        filters={filters}
        isDisabled={isDisabled}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {notificationsQuery.isPending ? (
        <LoadingState
          message="Retrieving your notifications from the backend."
          title="Loading notifications"
        />
      ) : null}

      {notificationsQuery.isError ? (
        <ErrorState
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-800"
              onClick={() => {
                void notificationsQuery.refetch();
              }}
              type="button"
            >
              Retry
            </button>
          }
          message={formatNotificationError(
            notificationsQuery.error,
            "Notifications could not be loaded.",
          )}
          title="Notification Center unavailable"
        />
      ) : null}

      {notificationsQuery.data &&
      notificationsQuery.data.results.length === 0 &&
      !filtersActive ? (
        <EmptyState
          message="You do not have any notifications yet."
          title="No notifications"
        />
      ) : null}

      {notificationsQuery.data &&
      notificationsQuery.data.results.length === 0 &&
      filtersActive ? (
        <EmptyState
          action={
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={handleResetFilters}
              type="button"
            >
              Clear filters
            </button>
          }
          message="No notifications match the current filters."
          title="No matching notifications"
        />
      ) : null}

      {notificationsQuery.data && notificationsQuery.data.results.length > 0 ? (
        <section className="space-y-4">
          <NotificationList notifications={notificationsQuery.data.results} />
          <NotificationPagination
            isDisabled={isDisabled}
            onPageChange={setPage}
            onPageSizeChange={(pageSize) => {
              handleFiltersChange({ ...filters, pageSize });
            }}
            page={page}
            pageSize={filters.pageSize}
            totalCount={notificationsQuery.data.count}
          />
        </section>
      ) : null}
    </div>
  );
}
