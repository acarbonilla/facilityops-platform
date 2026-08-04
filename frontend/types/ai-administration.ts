export interface AIAdminProviderConfig {
  provider: string;
  model: string;
  enabled: boolean;
  timeout_seconds: number;
  max_images: number;
  max_upload_bytes: number;
  retry_attempts: number;
  temperature: number;
  temperature_readonly: boolean;
  store_raw_response: boolean;
  api_key_configured: boolean;
  api_key_editable: boolean;
}

export interface AIAdminFeatureFlags {
  image_analysis: boolean;
  recommendation_engine: boolean;
  executive_dashboard: boolean;
  similar_cases: boolean;
  attention_center: boolean;
  operational_insights: boolean;
}

export interface AIAdminThresholds {
  confidence_threshold: number;
  health_warning_threshold: number;
  health_critical_threshold: number;
  attention_warning_threshold: number;
  attention_critical_threshold: number;
  acceptance_healthy_rate: number;
  override_warning_rate: number;
}

export interface AIAdminConfig {
  scope: string;
  provider: AIAdminProviderConfig;
  feature_flags: AIAdminFeatureFlags;
  thresholds: AIAdminThresholds;
  updated_at?: string | null;
  interpretation?: { scope?: string; note?: string };
  generated_at?: string;
}

export interface AIAdminPrompt {
  name: string;
  version: string;
  description: string;
  active: boolean;
  last_updated: string;
}

export interface AIAdminPolicy {
  code: string;
  title: string;
  statement: string;
}

export interface AIAdminHealth {
  scope: string;
  provider_status: string;
  provider_status_label: string;
  active_model: string;
  ai_enabled: boolean;
  feature_image_analysis: boolean;
  last_successful_analysis?: string | null;
  queued_analyses: number;
  processing_analyses: number;
  completed_analyses: number;
  failed_analyses: number;
  retry_count: number;
  health_status: string;
  health_status_label: string;
  generated_at?: string;
}

export interface AIAdminAuditEntry {
  id: string;
  actor_email: string;
  changed_field: string;
  old_value: string;
  new_value: string;
  scope: string;
  note: string;
  created_at?: string | null;
}

export interface AIAdminConfigPatch {
  provider?: Partial<{
    provider: string;
    model: string;
    enabled: boolean;
    timeout_seconds: number;
    max_images: number;
    max_upload_bytes: number;
    retry_attempts: number;
    store_raw_response: boolean;
  }>;
  feature_flags?: Partial<AIAdminFeatureFlags>;
  thresholds?: Partial<AIAdminThresholds>;
}
