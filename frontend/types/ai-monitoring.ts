export type AIMonitoringHealthLevel =
  | "healthy"
  | "warning"
  | "critical"
  | "unavailable";

export type AIMonitoringHealthBadge = {
  status: AIMonitoringHealthLevel | string;
  status_label: string;
};

export type AIMonitoringProvider = {
  provider: string;
  model: string;
  enabled: boolean;
  api_key_configured: boolean;
  provider_available: boolean;
  provider_availability_label: string;
  timeout_seconds: number;
  retry_attempts: number;
  feature_image_analysis: boolean;
};

export type AIMonitoringRuntime = {
  total_analyses: number;
  analyses_today: number;
  completed: number;
  failed: number;
  finished: number;
  success_rate: number;
  failure_rate: number;
  retry_rate: number;
  timeout_rate: number;
  retrying_now: number;
  average_duration_ms: number | null;
  average_queue_wait_ms: number | null;
};

export type AIMonitoringQueue = {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  backlog: number;
  depth: number;
};

export type AIMonitoringAlert = {
  code: string;
  title: string;
  severity: string;
  severity_label: string;
  message: string;
  actionable: boolean;
  remediation_automatic: boolean;
};

export type AIMonitoringActivity = {
  id: string;
  status: string;
  status_label: string;
  error_category: string | null;
  attempt_count: number;
  duration_ms: number | null;
  queued_at: string | null;
  completed_at: string | null;
  provider: string;
  model_name: string;
};

export type AIMonitoringOverview = {
  scope: string;
  overview: {
    provider: string;
    model: string;
    enabled: boolean;
    provider_available: boolean;
    health: {
      overall: AIMonitoringHealthBadge;
      provider: AIMonitoringHealthBadge;
      queue: AIMonitoringHealthBadge;
      worker: AIMonitoringHealthBadge;
      ai: AIMonitoringHealthBadge;
    };
  };
  provider: AIMonitoringProvider;
  runtime: AIMonitoringRuntime;
  queue: AIMonitoringQueue;
  health: {
    overall: AIMonitoringHealthBadge;
    provider: AIMonitoringHealthBadge;
    queue: AIMonitoringHealthBadge;
    worker: AIMonitoringHealthBadge;
    ai: AIMonitoringHealthBadge;
  };
  alerts: AIMonitoringAlert[];
  recent_activity: AIMonitoringActivity[];
  error_categories: Record<string, number>;
  thresholds_used: Record<string, number>;
  interpretation?: {
    note?: string;
    retrying_definition?: string;
  };
  generated_at: string;
};
