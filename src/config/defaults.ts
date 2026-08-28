// Bundled config defaults — the shipped fallback for backend-driven config.
// Load order everywhere: these defaults → last-good cache → server overlay.
// Every value here MUST mirror the server's AppConfig::RULE_DEFAULTS so the app
// behaves identically whether or not /app-config is reachable.

export interface AppConfigRules {
  geofence_max_accuracy_m: number;
  checkin_window_before_min: number;
  checkin_window_after_min: number;
  late_threshold_min: number;
  auto_absent_after_min: number;
  dormancy_days: number;
  billing_allowance_days: number;
  offline_bucket_gap_min: number;
}

export interface AppConfigContact {
  support_email: string;
  support_phone: string;
  company_name: string;
  card_instapay_number: string;
  card_instapay_name: string;
  card_vodafone_number: string; // blank unless the super-admin sets one
}

export interface AppConfigPayload {
  schema_version: number;
  min_supported_app_version: string;
  // Optional remote override of the API base URL (empty/absent = keep the bundled URL).
  api_base_url?: string;
  feature_flags: Record<string, boolean>;
  rules: AppConfigRules;
  copy: Record<string, string>;
  pricing: { tiers: unknown[] };
  // Super-admin-editable contact + card-order payment (server AppConfig 'contact').
  contact: AppConfigContact;
}

export const CONFIG_DEFAULTS: AppConfigPayload = {
  schema_version: 1,
  min_supported_app_version: '1.0.0',
  feature_flags: {},
  rules: {
    geofence_max_accuracy_m: 50,
    checkin_window_before_min: 10,
    checkin_window_after_min: 30,
    late_threshold_min: 30,
    auto_absent_after_min: 20,
    dormancy_days: 30,
    billing_allowance_days: 15,
    offline_bucket_gap_min: 60, // = buckets.ts ONE_HOUR_MS
  },
  copy: {},
  pricing: { tiers: [] },
  contact: {
    support_email: 'drosspot.support@gmail.com',
    support_phone: '01040981855',
    company_name: 'دروس سبوت',
    card_instapay_number: '01208020372',
    card_instapay_name: 'Ahmed Mohamed Imam',
    card_vodafone_number: '',
  },
};
