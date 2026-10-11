import fs from 'fs';
import path from 'path';

const mockPost = jest.fn(async () => ({ data: { ok: true } }));
jest.mock('@/api/client', () => ({ __esModule: true, default: { post: mockPost } }));
jest.mock('@/updates/otaUpdates', () => ({ runningUpdate: () => ({ update_id: 'u-1', runtime: 'fp', embedded: false }) }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.9' } } }));
const mockKv: Record<string, string> = {};
jest.mock('expo-sqlite/kv-store', () => ({ SQLiteStorage: class { getItemAsync = async (k: string) => mockKv[k] ?? null; setItemAsync = async (k: string, v: string) => { mockKv[k] = v; }; } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CAPABILITIES, reportCapabilities } = require('../capabilities') as typeof import('../capabilities');

describe('capabilities the app reports about itself', () => {
  it('names only things that exist in this repo, once each, in the backend\'s key format', () => {
    const root = path.join(__dirname, '../..');
    const keys = CAPABILITIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CAPABILITIES) {
      expect(c.key).toMatch(/^[a-z0-9_]+$/);
      expect(fs.existsSync(path.join(root, c.where))).toBe(true);
    }
  });

  it('reports once per build and tries again after a failure', async () => {
    expect(await reportCapabilities()).toBe(true);
    expect(mockPost).toHaveBeenCalledWith('/app-capabilities', expect.objectContaining({ platform: 'ios', app_version: '1.2.9', update_id: 'u-1', keys: expect.arrayContaining(['sessions', 'scan']) }), expect.anything());
    expect(await reportCapabilities()).toBe(false);
    expect(mockPost).toHaveBeenCalledTimes(1);
    delete mockKv['capabilities:reported'];
    mockPost.mockRejectedValueOnce(new Error('offline'));
    expect(await reportCapabilities()).toBe(false);
    expect(await reportCapabilities()).toBe(true);
  });
});
