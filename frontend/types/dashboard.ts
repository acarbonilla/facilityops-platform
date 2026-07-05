export type FoundationMetricKey = keyof Omit<FoundationSummary, "service">;

export interface FoundationSummary {
  tenants: number;
  organizations: number;
  departments: number;
  buildings: number;
  floors: number;
  areas: number;
  asset_types: number;
  assets: number;
  service: string;
}

export interface DashboardMetricCard {
  id: FoundationMetricKey;
  label: string;
  value: number;
}

export interface SystemStatus {
  service: string;
  status: string;
  connected: boolean;
  message: string;
}
