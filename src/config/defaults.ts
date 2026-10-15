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
  /** The «إعادة الإرسال» countdown on every code screen. */
  otp_resend_seconds: number;
  /** App screens and the API agree on this floor. */
  password_min_length: number;
  /** How long before a session the app treats it as «قريبة». */
  session_early_min: number;
  /** Failed requests in a row (no answer / 5xx) while the phone is online before the indicator says «الخادم لا يرد». */
  server_fail_flag_after?: number;
  /** Minutes without one successful answer from the server before the indicator flags the data as old. */
  sync_stale_after_min?: number;
}

export interface AppConfigContact {
  support_email: string;
  support_phone: string;
  company_name: string;
  card_instapay_number: string;
  card_instapay_name: string;
  card_vodafone_number: string; // blank unless the super-admin sets one
}

/** One inline validation rule the backend code declares (config/mobile_ui.php on the server). */
export interface UiValidationRule { pattern?: string; min_words?: number; min?: number; max?: number; message?: string }
/**
 * A button the backend draws (in a popup or a slot block). `action`: dismiss ·
 * navigate:<path> · url:<https…> · popup:<id> · api:<method> </path>. An `api:` button may
 * carry a flat `body` to send and a `confirm` line asked first (src/ui/serverPopup.ts).
 */
export interface UiPopupButton { label: string; action: string; style?: 'cancel' | 'destructive'; body?: Record<string, string | number | boolean | null>; confirm?: string }
export interface UiPopup { title: string; body?: string | null; buttons: UiPopupButton[]; persona?: 'rose' }
export type UiTone = 'info' | 'success' | 'warning' | 'danger' | 'brand';
/**
 * UI the backend ADDS into a slot the app leaves open (src/ui/Slot.tsx): a notice line, a
 * card with up to 3 buttons, or one button. `when` is a condition evaluated on the phone;
 * `id` lets `hidden` switch the block off as `<slot>#<id>`.
 */
export interface UiBlock { type: 'notice' | 'card' | 'button'; title?: string; body?: string; tone?: UiTone; icon?: string; buttons?: UiPopupButton[]; when?: string; id?: string; persona?: 'rose'; /** ISO date after which the block is dropped on the phone too (a cached manifest may still carry it). */ expires_at?: string }
/** Colour tokens the backend repaints, per scheme (src/theme/index.ts setThemeOverrides). */
export type UiTheme = Partial<Record<'light' | 'dark', Record<string, string>>>;
/**
 * What the app obeys from BACKEND CODE (server config/mobile_ui.php, served as `ui`):
 * surfaces switched off (a tab, a card, a button, a screen — see src/ui/surfaces.tsx), the
 * notice a hidden screen shows, inline validation rules (src/utils/validators.ts), named
 * popups (src/ui/serverPopup.ts).
 */
/** A condition on a surface: when `when` is false, the surface is hidden or disabled (with a reason). */
export interface UiCondition { when: string; else?: 'hide' | 'disable'; reason?: string }
export interface UiManifest {
  hidden: string[];
  /** Surface id → the reason shown when it is tapped; the element shows but does nothing. */
  disabled?: Record<string, string>;
  /** Surface id → a condition evaluated on the phone (src/ui/conditions.ts) against the screen's context. */
  conditions?: Record<string, UiCondition>;
  notices: Record<string, string>;
  validation: Record<string, UiValidationRule>;
  popups: Record<string, UiPopup>;
  /** Slot id → the blocks drawn there (docs/MOBILE_SLOTS.md). */
  slots?: Record<string, UiBlock[]>;
  theme?: UiTheme;
  /**
   * Surface id → who among a teacher's staff sees it: 'teacher', 'any', or an ability key.
   * Overrides the surface's bundled `assistantNeeds` (src/ui/surfaces.tsx).
   */
  gates?: Record<string, string>;
}

/** One assistant ability as the server names it (`abilities` in /app-config). */
export interface AbilityDef { key: string; label: string; takeaway?: boolean; default?: boolean }

export interface AppConfigPayload {
  schema_version: number;
  ui?: UiManifest;
  /** The assistant-ability catalog, so a key this build never saw still has a name. */
  abilities?: AbilityDef[];
  /** 'off' stops the app sending JS errors to /app-errors (src/lib/errorReport.ts); anything else = on. */
  error_reporting?: 'on' | 'off';
  min_supported_app_version: string;
  /**
   * Set by the server when THIS app identity has been retired (its store listing is
   * no longer ours to publish to). Carries where the user should go instead. Older
   * builds ignore this field entirely and are stopped by min_supported_app_version
   * alone, with the migration wording delivered through the copy overlay.
   */
  app_retired?: boolean;
  migration?: {
    retired: boolean;
    title: string;
    body: string;
    android_url: string | null;
    ios_url: string | null;
  } | null;
  // Optional remote override of the API base URL (empty/absent = keep the bundled URL).
  api_base_url?: string;
  /** Per-CURRENT-USER flag map (anonymous → the global map). */
  feature_flags: Record<string, boolean>;
  /**
   * Keys this user has ONLY through beta targeting (feature-targeting contract 2026-10-15):
   * the app marks those features «تجريبي». Empty for everyone-releases and anonymous.
   * Optional on the wire — an older server never sends it.
   */
  feature_beta?: string[];
  /** Short hash of (modes + targets + this user's scope); differs → the per-user flags changed. */
  feature_flags_version?: string;
  rules: AppConfigRules;
  copy: Record<string, string>;
  pricing: { tiers: unknown[] };
  // Super-admin-editable contact + card-order payment (server AppConfig 'contact').
  contact: AppConfigContact;
  /**
   * Store listings for the blocking update screen's button (server App\Support\StoreLinks,
   * editable at /admin/config). A null side = the server knows no listing there; the app
   * then falls back to the bundled link below.
   */
  store: AppConfigStore;
}

export interface AppConfigStore {
  ios_url: string | null;
  android_url: string | null;
}

export const CONFIG_DEFAULTS: AppConfigPayload = {
  schema_version: 1,
  min_supported_app_version: '1.0.0',
  app_retired: false,
  migration: null,
  feature_flags: {},
  feature_beta: [],
  rules: {
    geofence_max_accuracy_m: 50,
    checkin_window_before_min: 10,
    checkin_window_after_min: 30,
    late_threshold_min: 30,
    auto_absent_after_min: 20,
    dormancy_days: 30,
    billing_allowance_days: 15,
    offline_bucket_gap_min: 60, // = buckets.ts ONE_HOUR_MS
    otp_resend_seconds: 60,
    password_min_length: 6,
    session_early_min: 30,
    server_fail_flag_after: 2,
    sync_stale_after_min: 30,
  },
  copy: {},
  ui: {
    hidden: [],
    disabled: {},
    conditions: {},
    slots: {},
    theme: {},
    gates: {},
    notices: {},
    // Mirrors src/utils/validators.ts' own constants, which stay the fallback.
    validation: { arabic_name: { pattern: '^[ء-يـ\\s]+$' }, egypt_phone: { pattern: '^01[0-9]{9}$' }, triple_name: { min_words: 3 } },
    popups: {},
  },
  pricing: { tiers: [] },
  contact: {
    support_email: 'drosspot.support@gmail.com',
    support_phone: '01040981855',
    company_name: 'دروس سبوت',
    card_instapay_number: '01208020372',
    card_instapay_name: 'Ahmed Mohamed Imam',
    card_vodafone_number: '',
  },
  // Mirrors AppConfig::META_DEFAULTS store_ios_url / store_android_url.
  store: {
    ios_url: 'https://apps.apple.com/eg/app/dros-spot/id6806775859',
    android_url: 'https://play.google.com/store/apps/details?id=com.drosspot.app',
  },
};
