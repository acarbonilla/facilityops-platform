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
  /** Explicit connectivity state: checking | ok | unavailable | or a degraded health status string. */
  status: string;
  connected: boolean;
  /** True while connectivity has not been confirmed yet (not a failure). */
  checking: boolean;
  message: string;
}
