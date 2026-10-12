/**
 * Which backend this BUILD belongs to (founder 2026-10-12: stg.drosspot.app behind a key).
 * Baked in at build time from EXPO_PUBLIC_APP_ENV; absent = production, so every existing
 * build, workflow and store release keeps doing exactly what it did. A staging build is its
 * own app (bundle id com.drosspot.app.stg, see app.config.ts), sits beside the real one on a
 * phone, talks only to stg.drosspot.app, and sends the access key on every request.
 */
export type AppEnv = 'production' | 'staging';

export const APP_ENV: AppEnv = process.env.EXPO_PUBLIC_APP_ENV === 'staging' ? 'staging' : 'production';
export const IS_STAGING = APP_ENV === 'staging';

/** The staging door key (server config/staging.php). Never present in a production build. */
export const STAGING_KEY: string | null = IS_STAGING ? process.env.EXPO_PUBLIC_STAGING_KEY || null : null;

/** The header the staging gate reads. */
export const STAGING_HEADER = 'X-Staging-Key';
