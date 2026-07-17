/**
 * Gates Foundation Dashboard queries until auth restoration finishes.
 * Matches the established authenticated-query pattern used elsewhere.
 */
export function isDashboardQueryEnabled(options: {
  isLoading: boolean;
  isAuthenticated: boolean;
}): boolean {
  return !options.isLoading && options.isAuthenticated;
}
