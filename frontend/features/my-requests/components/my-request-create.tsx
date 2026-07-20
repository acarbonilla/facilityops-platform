"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FormField, getFormFieldAccessibilityProps } from "@/components/common/form-field";
import { FormActions } from "@/components/common/form-actions";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import {
  useCreateMyRequest,
  useMyRequestOptions,
} from "@/hooks/use-my-requests";
import {
  formatMyRequestError,
  getAttachmentGuidanceText,
  mapMyRequestFieldValidationErrors,
} from "@/lib/my-requests/display";
import {
  applyAreaChange,
  applyBuildingChange,
  applyFloorChange,
  buildMyRequestCreatePayload,
  clearStaleLocationSelections,
  filterCompatibleAssets,
} from "@/lib/my-requests/form";
import type { MyRequestFormValues } from "@/types/my-requests";
import type { FmTicketCategory } from "@/types/fm-tickets";

const EMPTY_VALUES: MyRequestFormValues = {
  title: "",
  description: "",
  category: "",
  building: "",
  floor: "",
  area: "",
  asset: "",
};

function toSelectOptions(
  items: Array<{ id: string; name: string }>,
): Array<{ value: string; label: string }> {
  return items.map((item) => ({ value: item.id, label: item.name }));
}

export function MyRequestCreateScreen() {
  const router = useRouter();
  const optionsQuery = useMyRequestOptions();
  const createMutation = useCreateMyRequest();
  const [values, setValues] = useState<MyRequestFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const options = optionsQuery.data;
  const organizationName = options?.organization?.name ?? "Your organization";

  const sanitizedValues = useMemo(() => {
    if (!options) {
      return values;
    }
    return clearStaleLocationSelections(values, {
      floors: options.floors,
      areas: options.areas,
      assets: options.assets,
    });
  }, [options, values]);

  const floorOptions = useMemo(() => {
    if (!options || !sanitizedValues.building) {
      return [];
    }
    return toSelectOptions(
      options.floors.filter(
        (floor) => floor.building_id === sanitizedValues.building,
      ),
    );
  }, [options, sanitizedValues.building]);

  const areaOptions = useMemo(() => {
    if (!options || !sanitizedValues.building) {
      return [];
    }
    return toSelectOptions(
      options.areas.filter((area) => {
        if (area.building_id !== sanitizedValues.building) {
          return false;
        }
        if (sanitizedValues.floor) {
          return area.floor_id === sanitizedValues.floor;
        }
        return true;
      }),
    );
  }, [options, sanitizedValues.building, sanitizedValues.floor]);

  const assetOptions = useMemo(() => {
    if (!options) {
      return [];
    }
    return toSelectOptions(
      filterCompatibleAssets(options.assets, sanitizedValues).map((asset) => ({
        id: asset.id,
        name: asset.name,
      })),
    );
  }, [options, sanitizedValues]);

  const categoryOptions = useMemo(
    () =>
      (options?.categories ?? []).map((category) => ({
        value: category.value,
        label: category.label,
      })),
    [options?.categories],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setFieldErrors({});

    const payload = buildMyRequestCreatePayload(sanitizedValues);
    if (!payload) {
      setFormError("Complete all required fields before submitting your request.");
      return;
    }

    try {
      const created = await createMutation.mutateAsync(payload);
      setFormSuccess("Request submitted successfully.");
      router.replace(`/my-requests/${created.id}`);
      router.refresh();
    } catch (error) {
      const mapped = mapMyRequestFieldValidationErrors(error);
      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
      }
      setFormError(formatMyRequestError(error));
    }
  }

  if (optionsQuery.isLoading) {
    return (
      <LoadingState
        message="Loading buildings and categories for your organization."
        title="Preparing request form"
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
        message="Request options could not be loaded. Retry to continue."
        title="Unable to load request options"
      />
    );
  }

  const hasBuildings = (options?.buildings.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Submit a facility request for your organization. Only the details below are required."
        title="Submit a Request"
      >
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href="/my-requests"
        >
          Back to My Requests
        </Link>
      </PageHeader>

      {!hasBuildings ? (
        <EmptyState
          message="No buildings are available for your organization yet. Contact your facilities team before submitting a request."
          title="No buildings available"
        />
      ) : (
        <form
          aria-busy={createMutation.isPending}
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
        >
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4" role="alert">
              <p className="font-medium text-red-900">Unable to submit request</p>
              <p className="mt-1 text-sm text-red-800">{formError}</p>
            </div>
          ) : null}

          {formSuccess ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
              {formSuccess}
            </p>
          ) : null}

          <FormField
            description="Your assigned organization for this request."
            htmlFor="my-request-organization"
            label="Organization"
          >
            <input
              className="block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
              id="my-request-organization"
              readOnly
              value={organizationName}
            />
          </FormField>

          <FormField
            error={fieldErrors.title}
            htmlFor="my-request-title"
            label="Title"
          >
            <input
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="my-request-title"
              onChange={(event) =>
                setValues((current) => ({ ...current, title: event.target.value }))
              }
              required
              value={sanitizedValues.title}
              {...getFormFieldAccessibilityProps(
                "my-request-title",
                undefined,
                fieldErrors.title,
              )}
            />
          </FormField>

          <FormField
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
              required
              value={sanitizedValues.description}
              {...getFormFieldAccessibilityProps(
                "my-request-description",
                undefined,
                fieldErrors.description,
              )}
            />
          </FormField>

          <FormField
            error={fieldErrors.category}
            htmlFor="my-request-category"
            label="Category"
          >
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="my-request-category"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  category: event.target.value as FmTicketCategory | "",
                }))
              }
              required
              value={sanitizedValues.category}
              {...getFormFieldAccessibilityProps(
                "my-request-category",
                undefined,
                fieldErrors.category,
              )}
            >
              <option value="">Select a category</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            error={fieldErrors.building}
            htmlFor="my-request-building"
            label="Building"
          >
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="my-request-building"
              onChange={(event) =>
                setValues((current) =>
                  applyBuildingChange(current, event.target.value),
                )
              }
              required
              value={sanitizedValues.building}
              {...getFormFieldAccessibilityProps(
                "my-request-building",
                undefined,
                fieldErrors.building,
              )}
            >
              <option value="">Select a building</option>
              {toSelectOptions(options?.buildings ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            description="Optional"
            error={fieldErrors.floor}
            htmlFor="my-request-floor"
            label="Floor"
          >
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              disabled={!sanitizedValues.building || floorOptions.length === 0}
              id="my-request-floor"
              onChange={(event) =>
                setValues((current) => applyFloorChange(current, event.target.value))
              }
              value={sanitizedValues.floor}
              {...getFormFieldAccessibilityProps(
                "my-request-floor",
                "Optional",
                fieldErrors.floor,
              )}
            >
              <option value="">No floor selected</option>
              {floorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            description="Optional"
            error={fieldErrors.area}
            htmlFor="my-request-area"
            label="Area"
          >
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              disabled={!sanitizedValues.building || areaOptions.length === 0}
              id="my-request-area"
              onChange={(event) =>
                setValues((current) => applyAreaChange(current, event.target.value))
              }
              value={sanitizedValues.area}
              {...getFormFieldAccessibilityProps(
                "my-request-area",
                "Optional",
                fieldErrors.area,
              )}
            >
              <option value="">No area selected</option>
              {areaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            description="Optional"
            error={fieldErrors.asset}
            htmlFor="my-request-asset"
            label="Asset"
          >
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              disabled={!sanitizedValues.building || assetOptions.length === 0}
              id="my-request-asset"
              onChange={(event) =>
                setValues((current) => ({ ...current, asset: event.target.value }))
              }
              value={sanitizedValues.asset}
              {...getFormFieldAccessibilityProps(
                "my-request-asset",
                "Optional",
                fieldErrors.asset,
              )}
            >
              <option value="">No asset selected</option>
              {assetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <p className="text-sm text-slate-600">{getAttachmentGuidanceText()}</p>

          <FormActions
            cancelHref="/my-requests"
            isSubmitting={createMutation.isPending}
            submitLabel="Submit request"
          />
        </form>
      )}
    </div>
  );
}
