"use client";

import { useEffect, useRef, useState } from "react";

import { FormField, getFormFieldAccessibilityProps } from "@/components/common/form-field";
import {
  useAcknowledgeMyRequest,
  useCancelMyRequest,
  useReopenMyRequest,
} from "@/hooks/use-my-requests";
import { formatMyRequestError } from "@/lib/my-requests/display";
import {
  canCloseWorkflowDialog,
  getFocusableDialogElements,
  getWorkflowDialogAriaIds,
  getWorkflowDialogFocusReturnTarget,
  getWorkflowDialogInitialFocusTarget,
  resolveWorkflowDialogTabCycle,
  shouldHandleWorkflowDialogEscape,
  WORKFLOW_DIALOG_REASON_ID,
} from "@/lib/my-requests/workflow-dialog";
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

  const dialogRef = useRef<HTMLDivElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const isPendingRef = useRef(false);

  const isPending =
    cancelMutation.isPending ||
    acknowledgeMutation.isPending ||
    reopenMutation.isPending;
  isPendingRef.current = isPending;

  const hasAnyAction =
    eligibility.canCancel || eligibility.canAcknowledge || eligibility.canReopen;

  useEffect(() => {
    if (!activeAction) {
      return;
    }

    const previouslyFocused = triggerRef.current;
    const requiresReason = requiresWorkflowReason(activeAction);
    const initialFocus = getWorkflowDialogInitialFocusTarget(requiresReason);
    if (initialFocus === "reason") {
      reasonRef.current?.focus();
    } else {
      dismissRef.current?.focus();
    }

    function closeDialog() {
      if (!canCloseWorkflowDialog(isPendingRef.current)) {
        return;
      }
      setActiveAction(null);
      setReason("");
      setReasonError(null);
    }

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (shouldHandleWorkflowDialogEscape(event.key, isPendingRef.current)) {
        event.preventDefault();
        closeDialog();
        return;
      }

      const focusable = getFocusableDialogElements(dialogRef.current);
      const cycleTarget = resolveWorkflowDialogTabCycle(
        event,
        focusable,
        document.activeElement,
      );
      if (cycleTarget) {
        event.preventDefault();
        cycleTarget.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      getWorkflowDialogFocusReturnTarget(previouslyFocused)?.focus();
    };
  }, [activeAction]);

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

  function openDialog(action: MyRequestWorkflowAction, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setActiveAction(action);
    setReason("");
    setReasonError(null);
    setActionError(null);
  }

  function dismissDialog() {
    if (!canCloseWorkflowDialog(isPending)) {
      return;
    }
    setActiveAction(null);
    setReason("");
    setReasonError(null);
  }

  async function runAction(action: MyRequestWorkflowAction) {
    if (isPending) {
      return;
    }
    setActionError(null);
    setSuccessMessage(null);
    const validationError = validateWorkflowReason(action, reason);
    if (validationError) {
      setReasonError(validationError);
      reasonRef.current?.focus();
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

  const ariaIds = activeAction ? getWorkflowDialogAriaIds() : null;
  const confirmation = activeAction
    ? getWorkflowConfirmationCopy(activeAction)
    : null;

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

      {actionError && !activeAction ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3" role="alert">
          <p className="text-sm text-red-800">{actionError}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {eligibility.canCancel ? (
          <button
            className="inline-flex items-center rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-60"
            disabled={isPending}
            onClick={(event) => openDialog("cancel", event.currentTarget)}
            type="button"
          >
            {getWorkflowActionLabel("cancel")}
          </button>
        ) : null}
        {eligibility.canAcknowledge ? (
          <button
            className="inline-flex items-center rounded-md border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60"
            disabled={isPending}
            onClick={(event) => openDialog("acknowledge", event.currentTarget)}
            type="button"
          >
            {getWorkflowActionLabel("acknowledge")}
          </button>
        ) : null}
        {eligibility.canReopen ? (
          <button
            className="inline-flex items-center rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60"
            disabled={isPending}
            onClick={(event) => openDialog("reopen", event.currentTarget)}
            type="button"
          >
            {getWorkflowActionLabel("reopen")}
          </button>
        ) : null}
      </div>

      {activeAction && ariaIds && confirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              dismissDialog();
            }
          }}
        >
          <div
            aria-describedby={ariaIds.describedBy}
            aria-labelledby={ariaIds.labelledBy}
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-xl bg-white p-4 shadow-2xl sm:p-6"
            ref={dialogRef}
            role="dialog"
          >
            <h3
              className="text-lg font-semibold text-slate-950"
              id={ariaIds.titleId}
            >
              {confirmation.title}
            </h3>
            <p
              className="mt-2 text-sm text-slate-700"
              id={ariaIds.descriptionId}
            >
              {confirmation.description}
            </p>

            {actionError ? (
              <div
                className="mt-4 rounded-md border border-red-200 bg-red-50 p-3"
                role="alert"
              >
                <p className="text-sm text-red-800">{actionError}</p>
              </div>
            ) : null}

            {requiresWorkflowReason(activeAction) ? (
              <div className="mt-4">
                <FormField
                  error={reasonError ?? undefined}
                  htmlFor={WORKFLOW_DIALOG_REASON_ID}
                  label="Reason"
                >
                  <textarea
                    className="block min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    id={WORKFLOW_DIALOG_REASON_ID}
                    onChange={(event) => setReason(event.target.value)}
                    ref={reasonRef}
                    required
                    value={reason}
                    {...getFormFieldAccessibilityProps(
                      WORKFLOW_DIALOG_REASON_ID,
                      undefined,
                      reasonError ?? undefined,
                    )}
                  />
                </FormField>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                disabled={isPending}
                onClick={dismissDialog}
                ref={dismissRef}
                type="button"
              >
                Keep request
              </button>
              <button
                className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                disabled={isPending}
                onClick={() => void runAction(activeAction)}
                type="button"
              >
                {isPending ? "Working..." : confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
