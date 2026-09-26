import type { AppConfigStore } from '@/config/defaults';

/**
 * The links the update button tries, in order, for this device's store.
 *
 * The first opens the store APP directly (`market://` on Android, `itms-apps://` on
 * iOS); the second is the plain web listing, used when the store app can't take the
 * first (a device without Play, a build where the scheme is refused). The listing comes
 * from /app-config, so a changed store URL reaches installed builds without a release.
 * Android's Play id is read from the listing itself, so an overridden listing for a
 * different package is followed, not our own package name.
 */
export function storeLinksFor(os: string, store: AppConfigStore, ownPackage: string): string[] {
  if (os === 'ios') {
    const web = store.ios_url;
    if (!web) return [];
    const app = /^https:\/\/(apps|itunes)\.apple\.com\//i.test(web) ? web.replace(/^https:/i, 'itms-apps:') : null;
    return app ? [app, web] : [web];
  }
  const web = store.android_url;
  const id = (web && /[?&]id=([^&#]+)/.exec(web)?.[1]) || ownPackage;
  const app = id ? `market://details?id=${id}` : null;
  return [app, web ?? (id ? `https://play.google.com/store/apps/details?id=${id}` : null)].filter((u): u is string => !!u);
}
