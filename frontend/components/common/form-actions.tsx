import Link from "next/link";

export interface FormActionsProps {
  cancelHref: string;
  isSubmitting: boolean;
  submitLabel: string;
}

export function FormActions({
  cancelHref,
  isSubmitting,
  submitLabel,
}: FormActionsProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
      <Link
        className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        href={cancelHref}
      >
        Cancel
      </Link>
      <button
        className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
