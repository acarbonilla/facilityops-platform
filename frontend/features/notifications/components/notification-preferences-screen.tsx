"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-notifications";
import {
  buildPreferenceUpdatePayload,
  EXTERNAL_DELIVERY_AVAILABILITY_MESSAGE,
  EXTERNAL_NOTIFICATION_CHANNELS,
  formatNotificationPreferenceError,
  formatNotificationPreferenceSuccess,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_SOURCE_MODULE_LABELS,
  NOTIFICATION_SOURCE_MODULES,
  resolveEffectivePreference,
} from "@/lib/notifications/preferences";
import type {
  NotificationChannel,
  NotificationPreferenceUpdateItem,
  NotificationSourceModule,
} from "@/types/notifications";

type PreferenceFormState = Record<string, boolean>;

function buildFormState(
  preferences: NonNullable<ReturnType<typeof useNotificationPreferences>["data"]>,
): PreferenceFormState {
  const nextState: PreferenceFormState = {};

  for (const channel of EXTERNAL_NOTIFICATION_CHANNELS) {
    nextState[`default::${channel}`] = resolveEffectivePreference({
      channel,
      defaults: preferences.defaults,
      storedPreferences: preferences.preferences,
    });
  }

  for (const sourceModule of NOTIFICATION_SOURCE_MODULES) {
    for (const channel of EXTERNAL_NOTIFICATION_CHANNELS) {
      nextState[`${sourceModule}::${channel}`] = resolveEffectivePreference({
        channel,
        sourceModule,
        defaults: preferences.defaults,
        storedPreferences: preferences.preferences,
      });
    }
  }

  return nextState;
}

function buildChangedPreferences(
  formState: PreferenceFormState,
  initialState: PreferenceFormState,
): NotificationPreferenceUpdateItem[] {
  const changes: NotificationPreferenceUpdateItem[] = [];

  for (const [key, isEnabled] of Object.entries(formState)) {
    if (initialState[key] === isEnabled) {
      continue;
    }

    const [scope, channel] = key.split("::") as [string, NotificationChannel];
    changes.push({
      source_module: scope === "default" ? "" : (scope as NotificationSourceModule),
      channel,
      is_enabled: isEnabled,
    });
  }

  return changes;
}

export function NotificationPreferencesScreen() {
  const preferencesQuery = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();
  const [formState, setFormState] = useState<PreferenceFormState>({});
  const [initialState, setInitialState] = useState<PreferenceFormState>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!preferencesQuery.data) {
      return;
    }

    const nextState = buildFormState(preferencesQuery.data);
    setFormState(nextState);
    setInitialState(nextState);
  }, [preferencesQuery.data]);

  const hasChanges = useMemo(
    () =>
      Object.keys(formState).some((key) => formState[key] !== initialState[key]),
    [formState, initialState],
  );

  function handleToggle(key: string, checked: boolean) {
    setFormState((current) => ({
      ...current,
      [key]: checked,
    }));
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  async function handleSave() {
    const changes = buildChangedPreferences(formState, initialState);
    if (changes.length === 0) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await updateMutation.mutateAsync(
        buildPreferenceUpdatePayload(changes),
      );
      const nextState = buildFormState(response);
      setFormState(nextState);
      setInitialState(nextState);
      setSuccessMessage(formatNotificationPreferenceSuccess());
    } catch (error) {
      setErrorMessage(formatNotificationPreferenceError(error));
    }
  }

  if (preferencesQuery.isLoading) {
    return (
      <LoadingState
        title="Loading notification preferences"
        message="Retrieving your saved notification channel settings."
      />
    );
  }

  if (preferencesQuery.isError || !preferencesQuery.data) {
    return (
      <ErrorState
        title="Notification preferences unavailable"
        message="Your notification preference settings could not be loaded."
        action={
          <button
            className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 transition hover:bg-red-100"
            onClick={() => void preferencesQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="Notification preferences"
        description="Manage which channels you want to use for FacilityOps notifications. In-app notifications remain available in the Notification Center."
      >
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {EXTERNAL_DELIVERY_AVAILABILITY_MESSAGE}
        </p>
      </PageHeader>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">In-app notifications</h2>
        <p className="mt-2 text-sm text-slate-600">
          In-app notifications are enabled by default and appear in the Notification
          Center for your account.
        </p>
        <p className="mt-4 text-sm font-medium text-slate-900">
          Status: Enabled
        </p>
        <Link
          className="mt-4 inline-flex text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
          href="/notifications"
        >
          Open Notification Center
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Channel defaults</h2>
        <p className="mt-2 text-sm text-slate-600">
          These defaults apply unless a module-specific override is set below.
        </p>
        <div className="mt-6 space-y-4">
          {EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => {
            const key = `default::${channel}`;
            const inputId = `notification-default-${channel}`;
            return (
              <label
                key={key}
                className="flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-3"
                htmlFor={inputId}
              >
                <input
                  checked={formState[key] ?? false}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  id={inputId}
                  onChange={(event) => handleToggle(key, event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">
                    {NOTIFICATION_CHANNEL_LABELS[channel]}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    Preference only. Enabling this channel does not send messages yet.
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Module overrides</h2>
        <p className="mt-2 text-sm text-slate-600">
          Override channel defaults for specific FacilityOps modules.
        </p>
        <div className="mt-6 space-y-6">
          {NOTIFICATION_SOURCE_MODULES.map((sourceModule) => (
            <div
              key={sourceModule}
              className="rounded-lg border border-slate-200 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                {NOTIFICATION_SOURCE_MODULE_LABELS[sourceModule]}
              </h3>
              <div className="mt-4 space-y-3">
                {EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => {
                  const key = `${sourceModule}::${channel}`;
                  const inputId = `notification-${sourceModule}-${channel}`;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-3"
                      htmlFor={inputId}
                    >
                      <input
                        checked={formState[key] ?? false}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        id={inputId}
                        onChange={(event) =>
                          handleToggle(key, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span className="text-sm text-slate-800">
                        {NOTIFICATION_CHANNEL_LABELS[channel]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {errorMessage ? (
          <p className="mb-4 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="mb-4 text-sm text-emerald-700" role="status">
            {successMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasChanges || updateMutation.isPending}
            onClick={() => void handleSave()}
            type="button"
          >
            {updateMutation.isPending ? "Saving..." : "Save preferences"}
          </button>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasChanges || updateMutation.isPending}
            onClick={() => {
              setFormState(initialState);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            type="button"
          >
            Reset changes
          </button>
        </div>
      </section>
    </div>
  );
}
