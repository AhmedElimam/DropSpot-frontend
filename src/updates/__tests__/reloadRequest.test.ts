import { cleanReloadRequest } from '@/stores/appConfigStore';

const mockPrepare = jest.fn();
const mockStore: Record<string, string> = {};
jest.mock('@/updates/otaUpdates', () => ({ prepareReload: () => mockPrepare(), runningUpdate: () => ({ update_id: 'u', runtime: '1.4.0', embedded: false }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: async (k: string) => mockStore[k] ?? null, setItem: async (k: string, v: string) => { mockStore[k] = v; } },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { answerReloadRequest, appliesHere, markRequestDone } = require('../reloadRequest') as typeof import('../reloadRequest');

const req = (over: Partial<{ id: string; runtime: string | null; force: boolean }> = {}) => ({ id: 'r1', message: 'اقفل وافتح', runtime: null, force: false, issued_at: '', ...over });

beforeEach(() => { mockPrepare.mockReset(); for (const k of Object.keys(mockStore)) delete mockStore[k]; });

describe('«اطلب من الكل إعادة فتح التطبيق» on the phone (2026-10-29)', () => {
  it('locks when a newer bundle is waiting', async () => {
    mockPrepare.mockResolvedValue('pending');
    expect(await answerReloadRequest(req())).toBe('lock');
  });

  it('a phone already up to date notes the request and shows nothing — once', async () => {
    mockPrepare.mockResolvedValue('none');
    expect(await answerReloadRequest(req())).toBe('done');
    expect(await answerReloadRequest(req())).toBe('later');
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    // A new request (new id) is answered again.
    mockPrepare.mockResolvedValue('pending');
    expect(await answerReloadRequest(req({ id: 'r2' }))).toBe('lock');
  });

  it('force locks even with nothing new; updates off (dev) never locks', async () => {
    mockPrepare.mockResolvedValue('none');
    expect(await answerReloadRequest(req({ force: true }))).toBe('lock');
    mockPrepare.mockResolvedValue('off');
    expect(await answerReloadRequest(req({ id: 'r3', force: true }))).toBe('later');
  });

  it('a failed check is asked again later, not marked done', async () => {
    mockPrepare.mockResolvedValue('error');
    expect(await answerReloadRequest(req())).toBe('later');
    mockPrepare.mockResolvedValue('pending');
    expect(await answerReloadRequest(req())).toBe('lock');
  });

  it('a request for another runtime does not apply; a restarted phone is not asked again', async () => {
    expect(appliesHere(req({ runtime: '2.0.0' }), null, '1.4.0')).toBe(false);
    expect(appliesHere(req({ runtime: '1.4.0' }), null, '1.4.0')).toBe(true);
    await markRequestDone('r1');
    expect(await answerReloadRequest(req())).toBe('later');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('a malformed request from the server never locks anybody', () => {
    expect(cleanReloadRequest(null)).toBeNull();
    expect(cleanReloadRequest({ id: '', message: 'x' })).toBeNull();
    expect(cleanReloadRequest({ id: 'a' })).toBeNull();
    expect(cleanReloadRequest({ id: 'a', message: 'm', force: 'yes' })).toEqual({ id: 'a', message: 'm', runtime: null, force: false, issued_at: '' });
  });
});
