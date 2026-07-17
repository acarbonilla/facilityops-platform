/** Advisory frontend visibility; destination route guards remain authoritative. */
export function getReportingDrillDownVisibility(options: {
  permissionsLoading: boolean;
  canViewTickets: boolean;
  canViewWorkOrders: boolean;
  canViewInspections: boolean;
}): {
  tickets: boolean;
  workOrders: boolean;
  inspections: boolean;
} {
  if (options.permissionsLoading) {
    return { tickets: false, workOrders: false, inspections: false };
  }
  return {
    tickets: options.canViewTickets,
    workOrders: options.canViewWorkOrders,
    inspections: options.canViewInspections,
  };
}
