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
  buildFormStateFromResponse,
  buildPreferenceChanges,
  buildPreferenceKey,
  buildPreferenceUpdatePayload,
  EXTERNAL_DELIVERY_AVAILABILITY_MESSAGE,
  EXTERNAL_NOTIFICATION_CHANNELS,
  formatEffectivePreferenceLabel,
  formatNotificationPreferenceError,
  formatNotificationPreferenceSuccess,
  MODULE_PREFERENCE_STATE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_SOURCE_MODULE_LABELS,
  NOTIFICATION_SOURCE_MODULES,
  resolveDraftInheritedChannelDefault,
} from "@/lib/notifications/preferences";
import type { ModulePreferenceState } from "@/lib/notifications/preferences";

type ChannelDefaultFormState = Record<string, boolean>;
type ModuleFormState = Record<string, ModulePreferenceState>;

export function NotificationPreferencesScreen() {
  const preferencesQuery = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();
  const [channelDefaults, setChannelDefaults] = useState<ChannelDefaultFormState>(
    {},
  );
  const [moduleStates, setModuleStates] = useState<ModuleFormState>({});
  const [initialChannelDefaults, setInitialChannelDefaults] =
    useState<ChannelDefaultFormState>({});
  const [initialModuleStates, setInitialModuleStates] = useState<ModuleFormState>(
    {},
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!preferencesQuery.data) {
      return;
    }

    const nextState = buildFormStateFromResponse(preferencesQuery.data);
    setChannelDefaults(nextState.channelDefaults);
    setModuleStates(nextState.moduleStates);
    setInitialChannelDefaults(nextState.channelDefaults);
    setInitialModuleStates(nextState.moduleStates);
  }, [preferencesQuery.data]);

  const hasChanges = useMemo(() => {
    const channelChanged = Object.keys(channelDefaults).some(
      (key) => channelDefaults[key] !== initialChannelDefaults[key],
    );
    const moduleChanged = Object.keys(moduleStates).some(
      (key) => moduleStates[key] !== initialModuleStates[key],
    );
    return channelChanged || moduleChanged;
  }, [
    channelDefaults,
    initialChannelDefaults,
    moduleStates,
    initialModuleStates,
  ]);

  function handleChannelDefaultToggle(key: string, checked: boolean) {
    setChannelDefaults((current) => ({
      ...current,
      [key]: checked,
    }));
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function handleModuleStateChange(key: string, state: ModulePreferenceState) {
    setModuleStates((current) => ({
      ...current,
      [key]: state,
    }));
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  async function handleSave() {
    const changes = buildPreferenceChanges({
      channelDefaults,
      initialChannelDefaults,
      moduleStates,
      initialModuleStates,
    });
    if (changes.length === 0) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await updateMutation.mutateAsync(
        buildPreferenceUpdatePayload(changes),
      );
      const nextState = buildFormStateFromResponse(response);
      setChannelDefaults(nextState.channelDefaults);
      setModuleStates(nextState.moduleStates);
      setInitialChannelDefaults(nextState.channelDefaults);
      setInitialModuleStates(nextState.moduleStates);
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
            const key = buildPreferenceKey("", channel);
            const inputId = `notification-default-${channel}`;
            return (
              <label
                key={key}
                className="flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-3"
                htmlFor={inputId}
              >
                <input
                  checked={channelDefaults[key] ?? false}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  id={inputId}
                  onChange={(event) =>
                    handleChannelDefaultToggle(key, event.target.checked)
                  }
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
          Override channel defaults for specific FacilityOps modules, or inherit the
          channel default.
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
              <div className="mt-4 space-y-4">
                {EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => {
                  const key = buildPreferenceKey(sourceModule, channel);
                  const selectId = `notification-${sourceModule}-${channel}`;
                  const currentState = moduleStates[key] ?? "inherit";
                  const effectiveValue = resolveDraftInheritedChannelDefault({
                    channel,
                    channelDefaults,
                  });

                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <label
                        className="text-sm font-medium text-slate-800"
                        htmlFor={selectId}
                      >
                        {NOTIFICATION_CHANNEL_LABELS[channel]}
                      </label>
                      <div className="flex flex-col gap-1 sm:items-end">
                        <select
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          id={selectId}
                          onChange={(event) =>
                            handleModuleStateChange(
                              key,
                              event.target.value as ModulePreferenceState,
                            )
                          }
                          value={currentState}
                        >
                          {(
                            Object.entries(MODULE_PREFERENCE_STATE_LABELS) as [
                              ModulePreferenceState,
                              string,
                            ][]
                          ).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        {currentState === "inherit" ? (
                          <p className="text-xs text-slate-500">
                            {formatEffectivePreferenceLabel(effectiveValue)}
                          </p>
                        ) : null}
                      </div>
                    </div>
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
              setChannelDefaults(initialChannelDefaults);
              setModuleStates(initialModuleStates);
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
