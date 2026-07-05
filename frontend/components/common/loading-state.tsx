export interface LoadingStateProps {
  title?: string;
  message?: string;
}

export function LoadingState({
  title = "Loading",
  message = "Please wait while the latest information is retrieved.",
}: LoadingStateProps) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4" role="status">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
        <div>
          <p className="font-medium text-blue-950">{title}</p>
          <p className="mt-1 text-sm text-blue-800">{message}</p>
        </div>
      </div>
    </div>
  );
}
