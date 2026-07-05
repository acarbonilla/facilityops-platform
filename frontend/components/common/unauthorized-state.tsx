export interface UnauthorizedStateProps {
  title?: string;
  message?: string;
}

export function UnauthorizedState({
  title = "Access denied",
  message = "You do not have permission to access this page.",
}: UnauthorizedStateProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" role="alert">
      <p className="font-medium text-amber-950">{title}</p>
      <p className="mt-1 text-sm text-amber-800">{message}</p>
    </div>
  );
}
