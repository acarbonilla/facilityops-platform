"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { FormField, getFormFieldAccessibilityProps } from "@/components/common/form-field";
import { FormActions } from "@/components/common/form-actions";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import {
  TicketCreateImageStaging,
  type TicketCreateImageStagingHandle,
} from "@/features/fm-tickets/components/ticket-create-image-staging";
import { useAuth } from "@/hooks/use-auth";
import {
  useCreateMyRequest,
  useMyRequestOptions,
} from "@/hooks/use-my-requests";
import { usePermissions } from "@/hooks/use-permissions";
import { buildTicketCreateSuccessHref } from "@/lib/fm-tickets/create-image-staging";
import {
  formatMyRequestError,
  getAttachmentGuidanceText,
  mapMyRequestFieldValidationErrors,
} from "@/lib/my-requests/display";
import {
  buildMyRequestCreatePayload,
  shouldShowMyRequestDetailSoftWarning,
} from "@/lib/my-requests/form";
import { queueFmTicketAiAnalysis } from "@/services/api/fm-tickets";
import { ATTACHMENT_PERMISSIONS } from "@/types/attachments";
import type { MyRequestFormValues } from "@/types/my-requests";

const EMPTY_VALUES: MyRequestFormValues = {
  title: "",
  description: "",
};

export function MyRequestCreateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const optionsQuery = useMyRequestOptions();
  const createMutation = useCreateMyRequest();
  const { hasPermission } = usePermissions();
  const canUploadAttachments = hasPermission(ATTACHMENT_PERMISSIONS.upload);
  const imageStagingRef = useRef<TicketCreateImageStagingHandle>(null);
  const [values, setValues] = useState<MyRequestFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stagedImageCount, setStagedImageCount] = useState(0);
  const submitGuardRef = useRef(false);

  const organizationName = optionsQuery.data?.organization?.name ?? "Your organization";
  const requesterName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || user?.email || "You";

  const showSoftWarning = shouldShowMyRequestDetailSoftWarning(
    values,
    stagedImageCount,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitGuardRef.current || isSubmitting || createMutation.isPending) {
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setFieldErrors({});

    if (imageStagingRef.current?.hasRejected()) {
      setFormError("Remove or replace rejected images before submitting.");
      return;
    }

    const payload = buildMyRequestCreatePayload(values);
    if (!payload) {
      setFieldErrors({ title: "Title is required." });
      setFormError("Enter a title before submitting your concern.");
      return;
    }

    submitGuardRef.current = true;
    setIsSubmitting(true);
    try {
      const created = await createMutation.mutateAsync(payload);
      let aiQueued = false;
      const uploadable = imageStagingRef.current?.getUploadableFiles().length ?? 0;

      if (uploadable > 0 && imageStagingRef.current) {
        try {
          const attachmentIds = await imageStagingRef.current.uploadAll({
            owner_type: "fm_ticket",
            owner_id: created.id,
            visibility: "requester_visible",
            category: "image_evidence",
          });
          if (attachmentIds.length > 0) {
            await queueFmTicketAiAnalysis(created.id, {
              attachment_ids: attachmentIds,
            });
            aiQueued = true;
          }
        } catch {
          // Ticket remains usable if attachment/AI steps fail (FO-096 / UX-001).
        }
      }

      setFormSuccess(
        "Concern submitted. The Facilities Team will review and classify it.",
      );
      router.replace(
        buildTicketCreateSuccessHref(`/my-requests/${created.id}`, { aiQueued }),
      );
      router.refresh();
    } catch (error) {
      const mapped = mapMyRequestFieldValidationErrors(error);
      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
      }
      setFormError(formatMyRequestError(error));
      submitGuardRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }

  if (optionsQuery.isLoading) {
    return (
      <LoadingState
        message="Loading your organization context."
        title="Preparing concern form"
      />
    );
  }

  if (optionsQuery.isError) {
    return (
      <ErrorState
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void optionsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
        message="Requester context could not be loaded. Retry to continue."
        title="Unable to load request context"
      />
    );
  }

  const busy = isSubmitting || createMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader
        description="Report a facility concern. The Facilities Team will classify and assign the work."
        title="Raise a Facility Concern"
      >
        <Link
          className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href="/my-requests"
        >
          Back to My Requests
        </Link>
      </PageHeader>

      <form
        aria-busy={busy}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        {formError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4" role="alert">
            <p className="font-medium text-red-900">Unable to submit concern</p>
            <p className="mt-1 text-sm text-red-800">{formError}</p>
          </div>
        ) : null}

        {formSuccess ? (
          <p
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            role="status"
          >
            {formSuccess}
          </p>
        ) : null}

        <section
          aria-label="Requester context"
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">Requester context</h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div>
              <dt className="font-medium text-slate-500">Requester</dt>
              <dd>{requesterName}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Organization</dt>
              <dd>{organizationName}</dd>
            </div>
          </dl>
        </section>

        <FormField
          error={fieldErrors.title}
          htmlFor="my-request-title"
          label="Title *"
        >
          <input
            className="block min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="my-request-title"
            maxLength={200}
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
            required
            value={values.title}
            {...getFormFieldAccessibilityProps(
              "my-request-title",
              undefined,
              fieldErrors.title,
            )}
          />
        </FormField>

        <FormField
          description="Optional. Add details when photos cannot capture the issue."
          error={fieldErrors.description}
          htmlFor="my-request-description"
          label="Description"
        >
          <textarea
            className="block min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="my-request-description"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            value={values.description}
            {...getFormFieldAccessibilityProps(
              "my-request-description",
              "Optional. Add details when photos cannot capture the issue.",
              fieldErrors.description,
            )}
          />
        </FormField>

        {canUploadAttachments ? (
          <TicketCreateImageStaging
            ref={imageStagingRef}
            canUpload={canUploadAttachments}
            disabled={busy}
            guidanceText={`${getAttachmentGuidanceText()} Photos are recommended but optional. Images upload when you submit. AI analysis may run in the background afterward and is not a final decision.`}
            onQueueChange={(queue) => {
              setStagedImageCount(
                queue.filter((item) => item.status !== "rejected").length,
              );
            }}
          />
        ) : (
          <p className="text-sm text-slate-600">{getAttachmentGuidanceText()}</p>
        )}

        {showSoftWarning ? (
          <p
            aria-live="polite"
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
            role="status"
          >
            Adding a short description or a photo helps the Facilities Team
            investigate. You can still submit without them.
          </p>
        ) : null}

        <div aria-live="polite" className="sr-only">
          {busy ? "Submitting your concern." : null}
        </div>

        <FormActions
          cancelHref="/my-requests"
          isSubmitting={busy}
          submitLabel="Submit Concern"
        />
      </form>
    </div>
  );
}
