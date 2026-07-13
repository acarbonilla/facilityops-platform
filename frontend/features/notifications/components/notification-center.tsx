"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import {
  useBulkUpdateNotificationState,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useNotificationUnreadCount,
  useNotifications,
} from "@/hooks/use-notifications";
import {
  buildNotificationListParams,
  buildBulkStatePayload,
  formatNotificationError,
  formatNotificationMutationSuccess,
  formatUnreadBadgeCount,
  hasActiveNotificationFilters,
  pruneNotificationSelection,
} from "@/lib/notifications/display";
import type { NotificationListFilters } from "@/types/notifications";

import {
  NotificationBulkActions,
  selectAllVisibleNotifications,
  toggleNotificationSelection,
} from "./notification-bulk-actions";
import { NotificationFilters } from "./notification-filters";
import { NotificationList } from "./notification-list";
import { NotificationMarkAllRead } from "./notification-mark-all-read";
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(
    null,
  );
  const [itemErrors, setItemErrors] = useState<Record<string, string | undefined>>(
    {},
  );
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  const queryParams = buildNotificationListParams(filters, page);
  const notificationsQuery = useNotifications(queryParams);
  const unreadCountQuery = useNotificationUnreadCount();
  const markReadMutation = useMarkNotificationRead();
  const markUnreadMutation = useMarkNotificationUnread();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const bulkStateMutation = useBulkUpdateNotificationState();

  const unreadBadge = formatUnreadBadgeCount(
    unreadCountQuery.data?.unread_count ?? 0,
  );
  const filtersActive = hasActiveNotificationFilters(filters);
  const visibleNotifications = notificationsQuery.data?.results ?? [];
  const isMutationPending =
    markReadMutation.isPending ||
    markUnreadMutation.isPending ||
    markAllReadMutation.isPending ||
    bulkStateMutation.isPending;
  const isDisabled = notificationsQuery.isFetching || isMutationPending;

  useEffect(() => {
    setSelectedIds([]);
    setBulkError(null);
    setBulkSuccess(null);
  }, [page, filters]);

  useEffect(() => {
    const visibleIds =
      notificationsQuery.data?.results.map((notification) => notification.id) ?? [];
    setSelectedIds((current) => pruneNotificationSelection(current, visibleIds));
  }, [notificationsQuery.data]);

  function handleFiltersChange(nextFilters: NotificationListFilters) {
    setFilters(nextFilters);
    setPage(1);
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  async function handleMarkRead(notificationId: string) {
    setPendingNotificationId(notificationId);
    setItemErrors((current) => ({ ...current, [notificationId]: undefined }));

    try {
      await markReadMutation.mutateAsync(notificationId);
    } catch (error) {
      setItemErrors((current) => ({
        ...current,
        [notificationId]: formatNotificationError(
          error,
          "Could not mark the notification as read.",
        ),
      }));
    } finally {
      setPendingNotificationId(null);
    }
  }

  async function handleMarkUnread(notificationId: string) {
    setPendingNotificationId(notificationId);
    setItemErrors((current) => ({ ...current, [notificationId]: undefined }));

    try {
      await markUnreadMutation.mutateAsync(notificationId);
    } catch (error) {
      setItemErrors((current) => ({
        ...current,
        [notificationId]: formatNotificationError(
          error,
          "Could not mark the notification as unread.",
        ),
      }));
    } finally {
      setPendingNotificationId(null);
    }
  }

  async function handleBulkState(isRead: boolean) {
    setBulkError(null);
    setBulkSuccess(null);

    try {
      const response = await bulkStateMutation.mutateAsync(
        buildBulkStatePayload(selectedIds, isRead),
      );
      setBulkSuccess(
        formatNotificationMutationSuccess(
          isRead
            ? "Selected notifications marked as read."
            : "Selected notifications marked as unread.",
          response.updated_count,
        ),
      );
      setSelectedIds([]);
    } catch (error) {
      setBulkError(
        formatNotificationError(
          error,
          "Could not update the selected notifications.",
        ),
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review and manage in-app updates for your account. State changes apply only when you choose an action."
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
        <NotificationMarkAllRead
          disabled={!unreadBadge || unreadCountQuery.isPending}
          isPending={markAllReadMutation.isPending}
          onConfirm={() => markAllReadMutation.mutateAsync()}
        />
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
          <NotificationBulkActions
            error={bulkError}
            isDisabled={isDisabled}
            isPending={bulkStateMutation.isPending}
            onBulkRead={() => void handleBulkState(true)}
            onBulkUnread={() => void handleBulkState(false)}
            onClearSelection={() => setSelectedIds([])}
            onSelectAllVisible={() =>
              setSelectedIds((current) =>
                selectAllVisibleNotifications(visibleNotifications, current),
              )
            }
            selectedCount={selectedIds.length}
            successMessage={bulkSuccess}
            visibleCount={visibleNotifications.length}
          />
          <NotificationList
            itemErrors={itemErrors}
            notifications={visibleNotifications}
            onMarkRead={(notificationId) => void handleMarkRead(notificationId)}
            onMarkUnread={(notificationId) => void handleMarkUnread(notificationId)}
            onToggleSelected={(notificationId, selected) =>
              setSelectedIds((current) =>
                toggleNotificationSelection(current, notificationId, selected),
              )
            }
            pendingNotificationId={pendingNotificationId}
            selectedIds={selectedIds}
            showSelection
            showStateActions
          />
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
