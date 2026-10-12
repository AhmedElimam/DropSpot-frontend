import { connectionView, syncAge, type NetSnapshot } from '../connectionState';

const wifi = (strength?: number | null): NetSnapshot => ({ isConnected: true, isInternetReachable: true, type: 'wifi', strength });
const cell = (gen: string | null): NetSnapshot => ({ isConnected: true, isInternetReachable: true, type: 'cellular', cellularGeneration: gen });

describe('connectionView', () => {
  it('is offline when the phone says so, whatever else is going on', () => {
    expect(connectionView({ isConnected: false, isInternetReachable: null, type: 'none' }, false, true)).toEqual({ state: 'offline', link: 'none', bars: 0 });
    expect(connectionView({ isConnected: true, isInternetReachable: false, type: 'wifi' }, false, false).state).toBe('offline');
  });

  it('counts bars from the link itself', () => {
    expect(connectionView(wifi(80), false, false)).toEqual({ state: 'online', link: 'wifi', bars: 3 });
    expect(connectionView(wifi(45), false, false)).toEqual({ state: 'online', link: 'wifi', bars: 2 });
    expect(connectionView(wifi(null), false, false)).toEqual({ state: 'online', link: 'wifi', bars: 3 }); // iOS reports no strength
    expect(connectionView(cell('4g'), false, false)).toEqual({ state: 'online', link: 'cellular', bars: 3 });
    expect(connectionView(cell('3g'), false, false)).toEqual({ state: 'online', link: 'cellular', bars: 2 });
  });

  it('is weak on a poor link or right after a request went unanswered', () => {
    expect(connectionView(cell('2g'), false, false)).toEqual({ state: 'weak', link: 'cellular', bars: 1 });
    expect(connectionView(wifi(10), false, false)).toEqual({ state: 'weak', link: 'wifi', bars: 1 });
    expect(connectionView(wifi(90), true, false)).toEqual({ state: 'weak', link: 'wifi', bars: 1 });
  });

  it('shows the send while a sync pass runs, keeping the real bars', () => {
    expect(connectionView(cell('3g'), false, true)).toEqual({ state: 'syncing', link: 'cellular', bars: 2 });
    expect(connectionView(wifi(90), true, true).state).toBe('syncing');
  });

  it('keeps the link it was on when the connection drops (the right icon gets crossed out)', () => {
    expect(connectionView({ isConnected: false, isInternetReachable: false, type: 'cellular' }, false, false)).toEqual({ state: 'offline', link: 'cellular', bars: 0 });
    expect(connectionView({ isConnected: true, isInternetReachable: false, type: 'wifi' }, false, false)).toEqual({ state: 'offline', link: 'wifi', bars: 0 });
  });

  it('treats an unknown first answer as online (no flash at launch)', () => {
    expect(connectionView({ isConnected: null, isInternetReachable: null, type: 'unknown' }, false, false).state).toBe('online');
  });
});

describe('syncAge', () => {
  const now = 10_000_000;
  it('says never / just now / minutes / hours', () => {
    expect(syncAge(null, now)).toEqual({ key: 'never' });
    expect(syncAge(now - 20_000, now)).toEqual({ key: 'just_now' });
    expect(syncAge(now - 5 * 60_000, now)).toEqual({ key: 'minutes_ago', n: 5 });
    expect(syncAge(now - 125 * 60_000, now)).toEqual({ key: 'hours_ago', n: 2 });
  });
});
