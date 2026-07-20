"use client";

import { useState } from "react";

import { FormField, getFormFieldAccessibilityProps } from "@/components/common/form-field";
import {
  useAcknowledgeMyRequest,
  useCancelMyRequest,
  useReopenMyRequest,
} from "@/hooks/use-my-requests";
import { formatMyRequestError } from "@/lib/my-requests/display";
import {
  getWorkflowActionLabel,
  getWorkflowConfirmationCopy,
  getWorkflowSuccessMessage,
  requiresWorkflowReason,
  resolveMyRequestWorkflowEligibility,
  validateWorkflowReason,
} from "@/lib/my-requests/workflow";
import type { MyRequestDetail, MyRequestWorkflowAction } from "@/types/my-requests";

export function MyRequestWorkflowActions({
  request,
}: {
  request: MyRequestDetail;
}) {
  const eligibility = resolveMyRequestWorkflowEligibility(request);
  const cancelMutation = useCancelMyRequest(request.id);
  const acknowledgeMutation = useAcknowledgeMyRequest(request.id);
  const reopenMutation = useReopenMyRequest(request.id);

  const [activeAction, setActiveAction] = useState<MyRequestWorkflowAction | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isPending =
    cancelMutation.isPending ||
    acknowledgeMutation.isPending ||
    reopenMutation.isPending;

  const hasAnyAction =
    eligibility.canCancel || eligibility.canAcknowledge || eligibility.canReopen;

  if (!hasAnyAction && !successMessage) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-950">Request actions</h2>
        <p className="mt-2 text-sm text-slate-700">
          No requester actions are available for this request in its current status.
        </p>
      </section>
    );
  }

  async function runAction(action: MyRequestWorkflowAction) {
    setActionError(null);
    setSuccessMessage(null);
    const validationError = validateWorkflowReason(action, reason);
    if (validationError) {
      setReasonError(validationError);
      return;
    }
    setReasonError(null);

    try {
      if (action === "cancel") {
        await cancelMutation.mutateAsync(reason.trim());
      } else if (action === "acknowledge") {
        await acknowledgeMutation.mutateAsync();
      } else {
        await reopenMutation.mutateAsync(reason.trim());
      }
      setSuccessMessage(getWorkflowSuccessMessage(action));
      setActiveAction(null);
      setReason("");
    } catch (error) {
      setActionError(formatMyRequestError(error));
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Request actions
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Cancel, acknowledge, or reopen your own request when it is eligible.
        </p>
      </div>

      {successMessage ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      {actionError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3" role="alert">
          <p className="text-sm text-red-800">{actionError}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {eligibility.canCancel ? (
          <button
            className="inline-flex items-center rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-60"
            disabled={isPending}
            onClick={() => {
              setActiveAction("cancel");
              setReason("");
              setReasonError(null);
              setActionError(null);
            }}
            type="button"
          >
            {getWorkflowActionLabel("cancel")}
          </button>
        ) : null}
        {eligibility.canAcknowledge ? (
          <button
            className="inline-flex items-center rounded-md border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60"
            disabled={isPending}
            onClick={() => {
              setActiveAction("acknowledge");
              setReason("");
              setReasonError(null);
              setActionError(null);
            }}
            type="button"
          >
            {getWorkflowActionLabel("acknowledge")}
          </button>
        ) : null}
        {eligibility.canReopen ? (
          <button
            className="inline-flex items-center rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60"
            disabled={isPending}
            onClick={() => {
              setActiveAction("reopen");
              setReason("");
              setReasonError(null);
              setActionError(null);
            }}
            type="button"
          >
            {getWorkflowActionLabel("reopen")}
          </button>
        ) : null}
      </div>

      {activeAction ? (
        <div
          aria-modal="true"
          className="rounded-lg border border-slate-300 bg-slate-50 p-4"
          role="dialog"
        >
          <h3 className="text-lg font-semibold text-slate-950">
            {getWorkflowConfirmationCopy(activeAction).title}
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            {getWorkflowConfirmationCopy(activeAction).description}
          </p>

          {requiresWorkflowReason(activeAction) ? (
            <div className="mt-4">
              <FormField
                error={reasonError ?? undefined}
                htmlFor="my-request-workflow-reason"
                label="Reason"
              >
                <textarea
                  className="block min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  id="my-request-workflow-reason"
                  onChange={(event) => setReason(event.target.value)}
                  required
                  value={reason}
                  {...getFormFieldAccessibilityProps(
                    "my-request-workflow-reason",
                    undefined,
                    reasonError ?? undefined,
                  )}
                />
              </FormField>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-60"
              disabled={isPending}
              onClick={() => {
                setActiveAction(null);
                setReason("");
                setReasonError(null);
              }}
              type="button"
            >
              Keep request
            </button>
            <button
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              disabled={isPending}
              onClick={() => void runAction(activeAction)}
              type="button"
            >
              {isPending
                ? "Working..."
                : getWorkflowConfirmationCopy(activeAction).confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
