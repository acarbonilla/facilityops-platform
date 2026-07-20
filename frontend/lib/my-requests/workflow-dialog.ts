export const WORKFLOW_DIALOG_TITLE_ID = "my-request-workflow-dialog-title";
export const WORKFLOW_DIALOG_DESCRIPTION_ID =
  "my-request-workflow-dialog-description";
export const WORKFLOW_DIALOG_REASON_ID = "my-request-workflow-reason";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export type WorkflowDialogInitialFocusTarget = "reason" | "dismiss";

export function getWorkflowDialogAriaIds(): {
  labelledBy: string;
  describedBy: string;
  titleId: string;
  descriptionId: string;
  reasonId: string;
} {
  return {
    labelledBy: WORKFLOW_DIALOG_TITLE_ID,
    describedBy: WORKFLOW_DIALOG_DESCRIPTION_ID,
    titleId: WORKFLOW_DIALOG_TITLE_ID,
    descriptionId: WORKFLOW_DIALOG_DESCRIPTION_ID,
    reasonId: WORKFLOW_DIALOG_REASON_ID,
  };
}

export function canCloseWorkflowDialog(isPending: boolean): boolean {
  return !isPending;
}

export function getWorkflowDialogInitialFocusTarget(
  requiresReason: boolean,
): WorkflowDialogInitialFocusTarget {
  return requiresReason ? "reason" : "dismiss";
}

export function getFocusableDialogElements(
  container: ParentNode | null,
): HTMLElement[] {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function resolveWorkflowDialogTabCycle(
  event: Pick<KeyboardEvent, "key" | "shiftKey">,
  focusable: HTMLElement[],
  activeElement: Element | null,
): HTMLElement | null {
  if (event.key !== "Tab" || focusable.length === 0) {
    return null;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && activeElement === first) {
    return last;
  }
  if (!event.shiftKey && activeElement === last) {
    return first;
  }
  return null;
}

export function shouldHandleWorkflowDialogEscape(
  key: string,
  isPending: boolean,
): boolean {
  return key === "Escape" && canCloseWorkflowDialog(isPending);
}

export function getWorkflowDialogFocusReturnTarget(
  opener: HTMLElement | null,
): HTMLElement | null {
  return opener;
}
