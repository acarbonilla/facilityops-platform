import type { ReactNode } from "react";

export interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  action,
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
      <p className="font-medium text-red-950">{title}</p>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
