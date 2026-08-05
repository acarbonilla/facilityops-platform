"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  AI_ADMIN_DISCLAIMER,
  AI_ADMIN_PERMISSION,
  FEATURE_FLAG_LABELS,
  THRESHOLD_LABELS,
  formatRateAsPercent,
  healthBadgeClass,
  summarizeConfig,
} from "@/lib/admin/ai-administration";
import { formatReportingError } from "@/lib/reporting/display";
import {
  getAIAdminAudit,
  getAIAdminConfig,
  getAIAdminHealth,
  getAIAdminPolicies,
  getAIAdminPrompts,
  patchAIAdminConfig,
} from "@/services/api/ai-administration";
import type {
  AIAdminConfig,
  AIAdminFeatureFlags,
  AIAdminThresholds,
} from "@/types/ai-administration";

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

const PROVIDER_OPTIONS = [
  { value: "placeholder", label: "Placeholder" },
  { value: "gemini", label: "Gemini" },
];

export function AIAdministrationScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasPermission, permissionsLoading } = usePermissions();
  const canManage = hasPermission(AI_ADMIN_PERMISSION);
  const enabled =
    !isLoading && isAuthenticated && !permissionsLoading && canManage;
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["admin", "ai", "config"],
    queryFn: getAIAdminConfig,
    enabled,
  });
  const promptsQuery = useQuery({
    queryKey: ["admin", "ai", "prompts"],
    queryFn: getAIAdminPrompts,
    enabled,
  });
  const policiesQuery = useQuery({
    queryKey: ["admin", "ai", "policies"],
    queryFn: getAIAdminPolicies,
    enabled,
  });
  const healthQuery = useQuery({
    queryKey: ["admin", "ai", "health"],
    queryFn: getAIAdminHealth,
    enabled,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "ai", "audit"],
    queryFn: () => getAIAdminAudit(50),
    enabled,
  });

  const [draft, setDraft] = useState<AIAdminConfig | null>(null);

  useEffect(() => {
    if (configQuery.data) {
      setDraft(configQuery.data);
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) {
        return Promise.reject(new Error("No draft configuration."));
      }
      return patchAIAdminConfig({
        provider: {
          provider: draft.provider.provider,
          model: draft.provider.model,
          enabled: draft.provider.enabled,
          timeout_seconds: draft.provider.timeout_seconds,
          max_images: draft.provider.max_images,
          max_upload_bytes: draft.provider.max_upload_bytes,
          retry_attempts: draft.provider.retry_attempts,
          store_raw_response: draft.provider.store_raw_response,
        },
        feature_flags: draft.feature_flags,
        thresholds: draft.thresholds,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "ai"] });
    },
  });

  const loading =
    configQuery.isPending ||
    promptsQuery.isPending ||
    policiesQuery.isPending ||
    healthQuery.isPending ||
    auditQuery.isPending;

  const error =
    configQuery.error ||
    promptsQuery.error ||
    policiesQuery.error ||
    healthQuery.error ||
    auditQuery.error ||
    saveMutation.error;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Configure and govern FacilityOps AI providers, feature flags, thresholds, and audit history."
        title="AI Administration & Governance"
      >
        <p className="text-sm text-slate-600">{AI_ADMIN_DISCLAIMER}</p>
        <p className="flex flex-wrap gap-3 text-sm text-slate-600">
          <Link
            className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/admin"
          >
            Back to Admin
          </Link>
          <Link
            className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/admin/ai/monitoring"
          >
            AI Production Monitoring
          </Link>
        </p>
      </PageHeader>

      {loading ? (
        <LoadingState
          message="Loading AI administration configuration."
          title="Loading AI administration"
        />
      ) : null}

      {error ? (
        <ErrorState
          message={formatReportingError(error)}
          title="Unable to load AI administration"
        />
      ) : null}

      {!loading && !error && draft ? (
        <>
          <SectionCard
            description="Platform-global V1 scope. API keys are never editable here."
            title="Overview"
          >
            <p className="text-sm text-slate-700">{summarizeConfig(draft)}</p>
            <p className="text-xs text-slate-500">
              Scope {draft.scope}
              {draft.updated_at ? ` · Updated ${draft.updated_at}` : ""}
            </p>
          </SectionCard>

          <SectionCard title="Provider">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectField
                id="ai-provider"
                label="Provider"
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          provider: {
                            ...current.provider,
                            provider: event.target.value,
                          },
                        }
                      : current,
                  )
                }
                options={PROVIDER_OPTIONS}
                value={draft.provider.provider}
              />
              <FormField htmlFor="ai-model" label="Model">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  id="ai-model"
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            provider: {
                              ...current.provider,
                              model: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                  value={draft.provider.model}
                />
              </FormField>
              <FormField htmlFor="ai-timeout" label="Timeout (seconds)">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  id="ai-timeout"
                  min={5}
                  max={600}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            provider: {
                              ...current.provider,
                              timeout_seconds: Number(event.target.value),
                            },
                          }
                        : current,
                    )
                  }
                  type="number"
                  value={draft.provider.timeout_seconds}
                />
              </FormField>
              <FormField htmlFor="ai-max-images" label="Max images">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  id="ai-max-images"
                  min={1}
                  max={20}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            provider: {
                              ...current.provider,
                              max_images: Number(event.target.value),
                            },
                          }
                        : current,
                    )
                  }
                  type="number"
                  value={draft.provider.max_images}
                />
              </FormField>
              <FormField htmlFor="ai-max-bytes" label="Max upload bytes">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  id="ai-max-bytes"
                  min={1024}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            provider: {
                              ...current.provider,
                              max_upload_bytes: Number(event.target.value),
                            },
                          }
                        : current,
                    )
                  }
                  type="number"
                  value={draft.provider.max_upload_bytes}
                />
              </FormField>
              <FormField htmlFor="ai-retries" label="Retry attempts">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  id="ai-retries"
                  min={1}
                  max={10}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            provider: {
                              ...current.provider,
                              retry_attempts: Number(event.target.value),
                            },
                          }
                        : current,
                    )
                  }
                  type="number"
                  value={draft.provider.retry_attempts}
                />
              </FormField>
              <FormField htmlFor="ai-temperature" label="Temperature (readonly)">
                <input
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  id="ai-temperature"
                  readOnly
                  value={draft.provider.temperature}
                />
              </FormField>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SwitchField
                checked={draft.provider.enabled}
                description="When disabled, Gemini analysis will not run."
                id="ai-enabled"
                label="Provider enabled"
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          provider: {
                            ...current.provider,
                            enabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
              <SwitchField
                checked={draft.provider.store_raw_response}
                description="Controls whether raw provider payloads may be stored."
                id="ai-store-raw"
                label="Store raw response"
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          provider: {
                            ...current.provider,
                            store_raw_response: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              API key configured:{" "}
              {draft.provider.api_key_configured ? "Yes" : "No"} (not editable in
              UI)
            </p>
          </SectionCard>

          <SectionCard
            description="Disabled features fail closed for new requests."
            title="Feature Flags"
          >
            <div className="grid gap-3 md:grid-cols-2">
              {(
                Object.keys(FEATURE_FLAG_LABELS) as Array<
                  keyof AIAdminFeatureFlags
                >
              ).map((key) => (
                <SwitchField
                  checked={draft.feature_flags[key]}
                  id={`flag-${key}`}
                  key={key}
                  label={FEATURE_FLAG_LABELS[key]}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            feature_flags: {
                              ...current.feature_flags,
                              [key]: event.target.checked,
                            },
                          }
                        : current,
                    )
                  }
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Thresholds">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(
                Object.keys(THRESHOLD_LABELS) as Array<keyof AIAdminThresholds>
              ).map((key) => {
                const isRate =
                  key === "acceptance_healthy_rate" ||
                  key === "override_warning_rate";
                return (
                  <FormField htmlFor={`threshold-${key}`} key={key} label={THRESHOLD_LABELS[key]}>
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      id={`threshold-${key}`}
                      max={isRate ? 1 : 100}
                      min={0}
                      step={isRate ? 0.01 : 1}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                thresholds: {
                                  ...current.thresholds,
                                  [key]: Number(event.target.value),
                                },
                              }
                            : current,
                        )
                      }
                      type="number"
                      value={draft.thresholds[key]}
                    />
                    {isRate ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Display {formatRateAsPercent(draft.thresholds[key])}
                      </p>
                    ) : null}
                  </FormField>
                );
              })}
            </div>
          </SectionCard>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:opacity-60"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              type="button"
            >
              {saveMutation.isPending ? "Saving…" : "Save configuration"}
            </button>
            {saveMutation.isSuccess ? (
              <p className="self-center text-sm text-emerald-800" role="status">
                Configuration saved.
              </p>
            ) : null}
          </div>

          <SectionCard
            description="Read-only metadata. Prompt text is never shown."
            title="Prompt Registry"
          >
            {promptsQuery.data?.prompts?.length ? (
              <ul className="space-y-3">
                {promptsQuery.data.prompts.map((prompt) => (
                  <li
                    className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700"
                    key={`${prompt.name}-${prompt.version}`}
                  >
                    <p className="font-medium text-slate-950">
                      {prompt.name} {prompt.version}
                    </p>
                    <p className="mt-1">{prompt.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {prompt.active ? "Active" : "Inactive"} · Updated{" "}
                      {prompt.last_updated}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                message="No prompt registry entries are available."
                title="No prompts"
              />
            )}
          </SectionCard>

          <SectionCard
            description="Read-only governance statements. Editing is out of scope for FO-093."
            title="Governance Policies"
          >
            <ul className="space-y-3">
              {(policiesQuery.data?.policies || []).map((policy) => (
                <li
                  className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700"
                  key={policy.code}
                >
                  <p className="font-medium text-slate-950">{policy.title}</p>
                  <p className="mt-1">{policy.statement}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="AI Health">
            {healthQuery.data ? (
              <div className="space-y-3 text-sm text-slate-700">
                <span
                  className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${healthBadgeClass(healthQuery.data.health_status)}`}
                >
                  {healthQuery.data.health_status_label}
                </span>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="font-medium text-slate-900">Active model</dt>
                    <dd>{healthQuery.data.active_model}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Queued</dt>
                    <dd>{healthQuery.data.queued_analyses}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Failed</dt>
                    <dd>{healthQuery.data.failed_analyses}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Retries</dt>
                    <dd>{healthQuery.data.retry_count}</dd>
                  </div>
                </dl>
                <p className="text-xs text-slate-500">
                  Last success:{" "}
                  {healthQuery.data.last_successful_analysis || "None"}
                </p>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Audit History">
            {auditQuery.data?.entries?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <caption className="sr-only">
                    AI administration audit history
                  </caption>
                  <thead className="border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2 pr-4 font-medium">When</th>
                      <th className="py-2 pr-4 font-medium">User</th>
                      <th className="py-2 pr-4 font-medium">Field</th>
                      <th className="py-2 pr-4 font-medium">Old</th>
                      <th className="py-2 font-medium">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditQuery.data.entries.map((entry) => (
                      <tr className="border-b border-slate-100" key={entry.id}>
                        <td className="py-2 pr-4">{entry.created_at || "—"}</td>
                        <td className="py-2 pr-4">{entry.actor_email || "—"}</td>
                        <td className="py-2 pr-4">{entry.changed_field}</td>
                        <td className="py-2 pr-4">{entry.old_value || "—"}</td>
                        <td className="py-2">{entry.new_value || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                message="No AI administration configuration changes have been recorded yet."
                title="No audit entries"
              />
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
