"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { EmptyState } from "@/components/common/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useSaveInspectionAIAnalysis } from "@/hooks/use-save-inspection-ai-analysis";
import {
  createEmptyInspectionAIAnalysisFormValues,
  mapInspectionAIAnalysisFormValuesToPayload,
  mapInspectionAIAnalysisToFormValues,
} from "@/lib/inspection/ai-analysis";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";
import { inspectionAIAnalysisFormSchema } from "@/lib/validations/inspection-ai";
import {
  getFieldErrorMessage,
  TextAreaField,
  TextInputField,
} from "@/features/master-data/components/shared";
import type {
  InspectionAIAnalysisFormValues,
  InspectionDetail,
} from "@/types/inspection";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function JsonPreview({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown>;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function AdvisoryNotice() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      AI-assisted analysis is advisory only. Inspectors and supervisors remain
      responsible for validating findings, recommendations, and final decisions.
    </div>
  );
}

export function InspectionAIAnalysis({
  inspection,
}: {
  inspection: InspectionDetail;
}) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const mutation = useSaveInspectionAIAnalysis(inspection.id);
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canManage = hasPermission("inspection.manage");
  const canView = canManage || hasPermission("inspection.view_ai");
  const canSave = canManage || hasPermission("inspection.update");
  const aiAnalysis = inspection.ai_analysis;

  const defaultValues = useMemo(
    () =>
      aiAnalysis
        ? mapInspectionAIAnalysisToFormValues(aiAnalysis)
        : createEmptyInspectionAIAnalysisFormValues(),
    [aiAnalysis],
  );

  const form = useForm<InspectionAIAnalysisFormValues>({
    resolver: zodResolver(inspectionAIAnalysisFormSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = form;

  const mutationError = mutation.isError
    ? getFirstQueryErrorMessage(
        [mutation.error],
        "AI analysis could not be saved.",
      )
    : null;

  const handleCancel = () => {
    mutation.reset();
    setSuccessMessage(null);
    reset(defaultValues);
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    mutation.reset();
    setSuccessMessage(null);
    reset(defaultValues);
    setIsEditing(true);
  };

  const storedPayload =
    aiAnalysis && Object.keys(aiAnalysis.payload).length > 0
      ? aiAnalysis.payload
      : null;
  const contextPreview =
    aiAnalysis?.context_preview &&
    Object.keys(aiAnalysis.context_preview).length > 0
      ? aiAnalysis.context_preview
      : null;

  return (
    <SectionCard
      title="AI Analysis"
      description="Persisted inspection analysis content and advisory review notes stored through the existing backend foundation."
    >
      <AdvisoryNotice />

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {successMessage}
        </div>
      ) : null}

      {mutationError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {mutationError}
        </div>
      ) : null}

      {!permissionsLoading && !canView && !canSave ? (
        <EmptyState
          title="AI analysis unavailable"
          message="You do not have permission to view stored AI analysis for this inspection."
        />
      ) : null}

      {!permissionsLoading && (canView || canSave) ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {canSave && !isEditing ? (
              <button
                className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                onClick={handleStartEditing}
                type="button"
              >
                {aiAnalysis ? "Edit analysis" : "Add analysis"}
              </button>
            ) : null}
            {canSave && isEditing ? (
              <button
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={handleCancel}
                type="button"
              >
                Cancel editing
              </button>
            ) : null}
          </div>

          {isEditing && canSave ? (
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                mutation.reset();
                await mutation.mutateAsync(
                  mapInspectionAIAnalysisFormValuesToPayload(values),
                );
                setSuccessMessage("AI analysis saved successfully.");
                setIsEditing(false);
              })}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <TextInputField
                  error={getFieldErrorMessage(errors.model_name?.message)}
                  id="inspection-ai-model-name"
                  inputProps={register("model_name")}
                  label="Model name"
                  description="Optional. Defaults to manual when left blank."
                />
                <TextInputField
                  error={getFieldErrorMessage(errors.source_notes?.message)}
                  id="inspection-ai-source-notes"
                  inputProps={register("source_notes")}
                  label="Source notes"
                />
              </div>

              <TextAreaField
                error={getFieldErrorMessage(errors.summary?.message)}
                id="inspection-ai-summary"
                label="Summary"
                textAreaProps={register("summary")}
              />
              <TextAreaField
                error={getFieldErrorMessage(errors.analysis?.message)}
                id="inspection-ai-analysis"
                label="Detailed analysis"
                textAreaProps={register("analysis")}
              />
              <TextAreaField
                error={getFieldErrorMessage(
                  errors.recommendation_summary?.message,
                )}
                id="inspection-ai-recommendation-summary"
                label="Recommendation summary"
                textAreaProps={register("recommendation_summary")}
              />
              <TextAreaField
                error={getFieldErrorMessage(errors.payload_json?.message)}
                id="inspection-ai-payload-json"
                label="Structured payload JSON"
                description="Optional. Provide a JSON object only."
                textAreaProps={register("payload_json")}
              />

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={handleCancel}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={mutation.isPending}
                  type="submit"
                >
                  {mutation.isPending ? "Saving..." : "Save analysis"}
                </button>
              </div>
            </form>
          ) : aiAnalysis && canView ? (
            <div className="space-y-4">
              <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Model
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-slate-900">
                    {aiAnalysis.model_name || "manual"}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Generated / Updated
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-slate-900">
                    {formatDateTime(aiAnalysis.generated_at)}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Source Notes
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-slate-900">
                    {aiAnalysis.source_notes || "No source notes recorded."}
                  </dd>
                </div>
              </dl>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
                  <p className="text-sm text-slate-700">
                    {aiAnalysis.summary || "No summary recorded."}
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Detailed analysis
                  </h3>
                  <p className="text-sm text-slate-700">
                    {aiAnalysis.analysis || "No analysis recorded."}
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Recommendation summary
                  </h3>
                  <p className="text-sm text-slate-700">
                    {aiAnalysis.recommendation_summary ||
                      "No recommendation summary recorded."}
                  </p>
                </div>
              </div>

              {storedPayload ? (
                <JsonPreview
                  title="Structured payload preview"
                  value={storedPayload}
                />
              ) : null}

              {contextPreview ? (
                <JsonPreview
                  title="Inspection context preview"
                  value={contextPreview}
                />
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No AI analysis"
              message="No AI analysis record is currently stored for this inspection."
            />
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}
