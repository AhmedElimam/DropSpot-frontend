import { mergeConfig, configRule, useAppConfigStore } from '../appConfigStore';
import { CONFIG_DEFAULTS } from '@/config/defaults';
import { computeBuckets } from '@/db/buckets';
import type { OfflineScan } from '@/db/offlineScans';

// Reset the store to bundled defaults between tests.
afterEach(() => useAppConfigStore.setState({ config: CONFIG_DEFAULTS }));

describe('config precedence: bundled → cache → server', () => {
  it('overlays a partial server payload but never drops a bundled default', () => {
    const merged = mergeConfig({ rules: { geofence_max_accuracy_m: 30 } as any });
    // Overridden key wins…
    expect(merged.rules.geofence_max_accuracy_m).toBe(30);
    // …every other rule keeps its bundled default.
    expect(merged.rules.late_threshold_min).toBe(CONFIG_DEFAULTS.rules.late_threshold_min);
    expect(merged.rules.offline_bucket_gap_min).toBe(60);
  });

  it('configRule returns the server value once set, default otherwise', () => {
    expect(configRule('geofence_max_accuracy_m')).toBe(50); // bundled default
    useAppConfigStore.getState().setConfig({ rules: { geofence_max_accuracy_m: 25 } as any });
    expect(configRule('geofence_max_accuracy_m')).toBe(25);
  });
});

describe('offline bucket gap is config-driven', () => {
  const scan = (id: string, iso: string): OfflineScan => ({
    id, card_code: id, scanned_at: iso, teacher_id: 1,
  } as unknown as OfflineScan);

  it('default 60min keeps two scans 40min apart in ONE bucket', () => {
    const buckets = computeBuckets([
      scan('a', '2026-01-01T10:00:00Z'),
      scan('b', '2026-01-01T10:40:00Z'),
    ]);
    expect(buckets).toHaveLength(1);
  });

  it('a 10min override splits them into TWO buckets', () => {
    useAppConfigStore.getState().setConfig({ rules: { offline_bucket_gap_min: 10 } as any });
    const buckets = computeBuckets([
      scan('a', '2026-01-01T10:00:00Z'),
      scan('b', '2026-01-01T10:40:00Z'),
    ]);
    expect(buckets).toHaveLength(2);
  });
});
