const mockPost = jest.fn(async () => ({ data: {} }));
jest.mock('@/api/client', () => ({ __esModule: true, default: { post: mockPost } }));
jest.mock('@/updates/otaUpdates', () => ({ runningUpdate: () => ({ update_id: 'u-9', runtime: 'fp', embedded: false }) }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.9' } } }));

// Required after the mocks exist (an import is hoisted over them).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __resetErrorReportingForTests, installErrorReporting, noteRoute, reportError, setErrorReportingEnabled, setErrorReportingRole } = require('../errorReport') as typeof import('../errorReport');

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { jest.clearAllMocks(); __resetErrorReportingForTests(); });

describe('error reporting', () => {
  it('sends the version, update, screen pattern, role and stack — nothing personal', async () => {
    setErrorReportingRole('teacher');
    noteRoute('/(teacher)/students/[id]');
    await reportError(new Error('Cannot read property x'), { where: 'collect.submit' });
    expect(mockPost).toHaveBeenCalledWith('/app-errors', expect.objectContaining({
      app_version: '1.2.9', update_id: 'u-9', runtime: 'fp', role: 'teacher', route: '/(teacher)/students/[id]',
      where: 'collect.submit', fatal: false, message: 'Cannot read property x',
    }), expect.anything());
    const body = (mockPost.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect(Object.keys(body).sort()).toEqual(['app_version', 'fatal', 'message', 'os_version', 'platform', 'role', 'route', 'runtime', 'stack', 'update_id', 'where']);
  });

  it('reports each distinct error once a session, stops at twenty, and never sends when switched off', async () => {
    await reportError(new Error('same'));
    await reportError(new Error('same'));
    expect(mockPost).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 30; i++) await reportError(new Error(`e${i}`));
    expect(mockPost).toHaveBeenCalledTimes(20);
    __resetErrorReportingForTests();
    mockPost.mockClear();
    setErrorReportingEnabled(false);
    await reportError(new Error('silenced'));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('wraps the global handler once and still lets the previous one run', async () => {
    const previous = jest.fn();
    const g = globalThis as { ErrorUtils?: { getGlobalHandler: () => unknown; setGlobalHandler: (h: unknown) => void } };
    let handler: ((e: Error, f?: boolean) => void) | null = null;
    g.ErrorUtils = { getGlobalHandler: () => previous, setGlobalHandler: (h) => { handler = h as typeof handler; } };
    installErrorReporting();
    installErrorReporting();
    expect(handler).not.toBeNull();
    handler!(new Error('boom'), true);
    await flush();
    expect(previous).toHaveBeenCalledWith(expect.any(Error), true);
    expect(mockPost).toHaveBeenCalledWith('/app-errors', expect.objectContaining({ fatal: true, message: 'boom' }), expect.anything());
    delete g.ErrorUtils;
  });

  it('swallows a failed send', async () => {
    mockPost.mockRejectedValueOnce(new Error('offline'));
    await expect(reportError(new Error('x'))).resolves.toBeUndefined();
  });
});
