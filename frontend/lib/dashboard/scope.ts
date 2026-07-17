/** Neutral scope copy — avoids claiming tenant-only scope for global admins. */
export const DASHBOARD_SCOPE_SUMMARY =
  "Counts reflect the foundation data available to your account.";

export const DASHBOARD_SCOPE_SUPPORTING =
  "Tenant users see their organization's tenant scope. Approved global administrators may see platform-wide totals.";

export const DASHBOARD_ZERO_CONTEXT =
  "No foundation records are currently available for your account.";

export function getDashboardScopeMessages() {
  return {
    summary: DASHBOARD_SCOPE_SUMMARY,
    supporting: DASHBOARD_SCOPE_SUPPORTING,
    zeroContext: DASHBOARD_ZERO_CONTEXT,
  };
}
