/**
 * «حصة أونلاين» — the live room's decisions (src/remote/room.ts): what the page's messages
 * mean, where the page may navigate, which build may broadcast, the one-time hand-off of the
 * link «start» returns, and when a room left in the background is dropped.
 */
import {
  HANDOFF_MAX_AGE_MS,
  MIN_BROADCAST_VERSION,
  REMOTE_LIVE_NOTIFICATION,
  ROOM_BACKGROUND,
  ROOM_BACKGROUND_GRACE_MS,
  canBroadcastFromPhone,
  isAllowedNavigation,
  isRemoteLive,
  isSameLocalDay,
  isTrustedJoinUrl,
  mediaCaptureGrantFor,
  offerJoinUrl,
  originOf,
  roomActionFor,
  roomDroppedAfter,
  takeJoinUrl,
} from '../room';
import { dark } from '@/theme/palettes';

const JOIN = 'https://drosspot.app/remote/room/AbC123?x=1';

describe('messages from the page → what the screen does', () => {
  it('reads the four messages of the contract', () => {
    expect(roomActionFor(JSON.stringify({ type: 'ready' }))).toEqual({ kind: 'ready' });
    expect(roomActionFor(JSON.stringify({ type: 'leave' }))).toEqual({ kind: 'close' });
    expect(roomActionFor(JSON.stringify({ type: 'ended' }))).toEqual({ kind: 'ended' });
    expect(roomActionFor(JSON.stringify({ type: 'checked_in' }))).toEqual({ kind: 'checked_in' });
  });

  it('extra fields beside the type change nothing', () => {
    expect(roomActionFor(JSON.stringify({ type: 'checked_in', student_id: 5, at: '2026-11-12T10:00:00Z' }))).toEqual({ kind: 'checked_in' });
  });

  it('ignores anything that is not one of ours, and never throws', () => {
    for (const raw of [
      '', 'leave', '{', 'null', '[]', '"leave"', '42',
      JSON.stringify({}), JSON.stringify({ type: 5 }), JSON.stringify({ type: 'LEAVE' }), JSON.stringify({ type: 'navigate', url: 'https://evil.example' }),
      JSON.stringify({ type: 'constructor' }), JSON.stringify({ type: 'toString' }), JSON.stringify({ type: '__proto__' }),
      JSON.stringify([{ type: 'leave' }]), JSON.stringify({ kind: 'leave' }),
      undefined, null, 7, { type: 'leave' },
    ]) {
      expect(roomActionFor(raw)).toBeNull();
    }
  });

  it('a message far longer than any of ours is not read at all', () => {
    expect(roomActionFor(JSON.stringify({ type: 'leave', pad: 'x'.repeat(5000) }))).toBeNull();
  });
});

describe('originOf — scheme, host and port, or nothing', () => {
  it('reads an http(s) address, lower-cased, without a default port', () => {
    expect(originOf('https://drosspot.app/remote/room/x')).toBe('https://drosspot.app');
    expect(originOf('HTTPS://DrosSpot.App')).toBe('https://drosspot.app');
    expect(originOf('https://drosspot.app:443/x')).toBe('https://drosspot.app');
    expect(originOf('https://drosspot.app:0443/x')).toBe('https://drosspot.app');
    expect(originOf('https://drosspot.app:8443/x')).toBe('https://drosspot.app:8443');
    expect(originOf('http://192.168.1.50:8000/api/v1')).toBe('http://192.168.1.50:8000');
    expect(originOf('http://10.0.2.2:80/x')).toBe('http://10.0.2.2');
    expect(originOf('https://drosspot.app?x=1')).toBe('https://drosspot.app');
    expect(originOf('https://drosspot.app#x')).toBe('https://drosspot.app');
  });

  it('refuses every other scheme and every trick in the authority', () => {
    for (const url of [
      'javascript:alert(1)', 'data:text/html,<p>x</p>', 'file:///etc/passwd', 'intent://x#Intent;end', 'tel:0100', 'drosspot://x',
      'blob:https://drosspot.app/1', 'about:blank', '//drosspot.app/x', 'drosspot.app', '/remote/room/x', '',
      ' https://drosspot.app', 'https://', 'https:///x', 'https:drosspot.app',
      'https://drosspot.app@evil.example/x', 'https://user:pw@drosspot.app/x',
      'https://evil.example\\@drosspot.app/x', 'https://drosspot.app\\.evil.example/x',
      'https://drosspot.app%2f.evil.example/x', 'https://drosspot .app/x', 'https://drosspot.app\t/x',
      'https://.drosspot.app/x', 'https://drosspot.app./x', 'https://drosspot..app/x',
      'https://drosspot.app:/x', 'https://drosspot.app:99999/x', 'https://drosspot.app:0/x', 'https://drosspot.app:80a/x',
      null, undefined, 5, {},
    ]) {
      expect([url, originOf(url)]).toEqual([url, null]);
    }
  });
});

describe('isAllowedNavigation — the page stays on the origin of its link', () => {
  it('allows the link itself and anything else on the same origin', () => {
    expect(isAllowedNavigation(JOIN, JOIN)).toBe(true);
    expect(isAllowedNavigation('https://drosspot.app/remote/room/AbC123/leave', JOIN)).toBe(true);
    expect(isAllowedNavigation('https://DROSSPOT.app:443/other', JOIN)).toBe(true);
    expect(isAllowedNavigation('https://drosspot.app', JOIN)).toBe(true);
  });

  it('allows the empty document a page makes for itself', () => {
    expect(isAllowedNavigation('about:blank', JOIN)).toBe(true);
    expect(isAllowedNavigation('about:srcdoc', JOIN)).toBe(true);
  });

  it('refuses every other origin — another host, a look-alike, another scheme or port', () => {
    for (const url of [
      'https://evil.example/remote/room/AbC123',
      'https://drosspot.app.evil.example/x', // the library's own whitelist is a prefix match and would pass this
      'https://evildrosspot.app/x',
      'https://stg.drosspot.app/x',
      'https://www.drosspot.app/x',
      'http://drosspot.app/x',
      'https://drosspot.app:8443/x',
      'https://drosspot.app@evil.example/x',
      'https://evil.example\\@drosspot.app/x',
      'https://evil.example/?next=https://drosspot.app/',
      'https://evil.example#https://drosspot.app/',
    ]) {
      expect([url, isAllowedNavigation(url, JOIN)]).toEqual([url, false]);
    }
  });

  it('refuses what is not a web page at all: scripts, files, other apps, the dialler', () => {
    for (const url of [
      'javascript:location="https://evil.example"', 'data:text/html,<script>1</script>', 'file:///data/x', 'blob:https://drosspot.app/1',
      'intent://scan#Intent;scheme=zxing;end', 'market://details?id=x', 'tel:0100', 'mailto:a@b.c', 'whatsapp://send', 'drosspot://resolve',
      'about:config', '', undefined, null,
    ]) {
      expect([url, isAllowedNavigation(url, JOIN)]).toEqual([url, false]);
    }
  });

  it('with no usable link nothing is allowed', () => {
    expect(isAllowedNavigation(JOIN, null)).toBe(false);
    expect(isAllowedNavigation(JOIN, '')).toBe(false);
    expect(isAllowedNavigation(JOIN, 'javascript:1')).toBe(false);
    expect(isAllowedNavigation('javascript:1', 'javascript:1')).toBe(false);
  });
});

describe('isTrustedJoinUrl — the link is on the API\'s own origin, or it is not opened', () => {
  it('production: https on drosspot.app only', () => {
    const api = 'https://drosspot.app/api/v1';
    expect(isTrustedJoinUrl(JOIN, api)).toBe(true);
    expect(isTrustedJoinUrl('http://drosspot.app/remote/room/x', api)).toBe(false);
    expect(isTrustedJoinUrl('https://stg.drosspot.app/remote/room/x', api)).toBe(false);
    expect(isTrustedJoinUrl('https://evil.example/remote/room/x', api)).toBe(false);
    expect(isTrustedJoinUrl('https://drosspot.app.evil.example/remote/room/x', api)).toBe(false);
  });

  it('staging: its own host, so the staging key never leaves it', () => {
    const api = 'https://stg.drosspot.app/api/v1';
    expect(isTrustedJoinUrl('https://stg.drosspot.app/remote/room/x', api)).toBe(true);
    expect(isTrustedJoinUrl(JOIN, api)).toBe(false);
  });

  it('development: the dev machine the API is served from, http and port included', () => {
    const api = 'http://192.168.1.50:8000/api/v1';
    expect(isTrustedJoinUrl('http://192.168.1.50:8000/remote/room/x', api)).toBe(true);
    expect(isTrustedJoinUrl('http://192.168.1.50/remote/room/x', api)).toBe(false);
    expect(isTrustedJoinUrl('http://localhost:8000/remote/room/x', api)).toBe(false);
  });

  it('a missing or malformed side is never trusted', () => {
    expect(isTrustedJoinUrl(undefined, 'https://drosspot.app/api/v1')).toBe(false);
    expect(isTrustedJoinUrl(JOIN, undefined)).toBe(false);
    expect(isTrustedJoinUrl('', '')).toBe(false);
    expect(isTrustedJoinUrl('javascript:1', 'javascript:1')).toBe(false);
  });
});

describe('the broadcaster gate — store builds before 1.3.0 have no microphone usage string', () => {
  it('is 1.3.0', () => expect(MIN_BROADCAST_VERSION).toBe('1.3.0'));

  it.each([
    ['1.2.9', false], ['1.2.10', false], ['1.2', false], ['1.0.0', false], ['0.9.9', false], ['0.0.0', false], ['', false],
    ['1.3.0', true], ['1.3', true], ['1.3.1', true], ['1.10.0', true], ['2.0.0', true],
  ])('%s may broadcast: %s', (version, may) => {
    expect(canBroadcastFromPhone(version)).toBe(may);
  });
});

describe('camera and microphone inside the page', () => {
  it('granted on a build that can broadcast, denied in the WebView itself on an older one', () => {
    expect(mediaCaptureGrantFor('1.3.0')).toBe('grant');
    expect(mediaCaptureGrantFor('1.4.2')).toBe('grant');
    expect(mediaCaptureGrantFor('1.2.9')).toBe('deny');
    expect(mediaCaptureGrantFor('0.0.0')).toBe('deny');
  });
});

describe('the link «start» returns is handed to the room once', () => {
  it('is taken once, by the session it was offered for', () => {
    offerJoinUrl('teacher:81', JOIN, 1000);
    expect(takeJoinUrl('teacher:81', 2000)).toBe(JOIN);
    expect(takeJoinUrl('teacher:81', 2001)).toBeNull();
  });

  it('another session never gets it — and asking spends it', () => {
    offerJoinUrl('teacher:81', JOIN, 1000);
    expect(takeJoinUrl('teacher:82', 1500)).toBeNull();
    expect(takeJoinUrl('teacher:81', 1600)).toBeNull();
  });

  it('a link that waited a minute is thrown away (the server keeps it ~2 minutes)', () => {
    offerJoinUrl('teacher:81', JOIN, 1000);
    expect(takeJoinUrl('teacher:81', 1000 + HANDOFF_MAX_AGE_MS)).toBeNull();
    offerJoinUrl('teacher:81', JOIN, 1000);
    expect(takeJoinUrl('teacher:81', 1000 + HANDOFF_MAX_AGE_MS - 1)).toBe(JOIN);
    expect(HANDOFF_MAX_AGE_MS).toBeLessThanOrEqual(60_000);
  });

  it('a clock that went backwards hands nothing over', () => {
    offerJoinUrl('teacher:81', JOIN, 5000);
    expect(takeJoinUrl('teacher:81', 4000)).toBeNull();
  });

  it('nothing offered, nothing taken', () => {
    expect(takeJoinUrl('teacher:81')).toBeNull();
  });
});

describe('a room is never kept alive behind the app', () => {
  it('survives a glance away, is dropped after the grace', () => {
    expect(roomDroppedAfter(0)).toBe(false);
    expect(roomDroppedAfter(ROOM_BACKGROUND_GRACE_MS - 1)).toBe(false);
    expect(roomDroppedAfter(ROOM_BACKGROUND_GRACE_MS)).toBe(true);
    expect(roomDroppedAfter(10 * 60_000)).toBe(true);
  });

  it('the grace is seconds, not minutes', () => {
    expect(ROOM_BACKGROUND_GRACE_MS).toBeGreaterThanOrEqual(5_000);
    expect(ROOM_BACKGROUND_GRACE_MS).toBeLessThanOrEqual(30_000);
  });
});

describe('which sessions show the entry points', () => {
  it('only a row that says live is live', () => {
    expect(isRemoteLive({ live: true })).toBe(true);
    expect(isRemoteLive({ live: true, viewers: 0 })).toBe(true);
    expect(isRemoteLive({ live: false, viewers: 3 })).toBe(false);
    expect(isRemoteLive(null)).toBe(false);
    expect(isRemoteLive(undefined)).toBe(false);
    expect(isRemoteLive({ live: 'yes' } as never)).toBe(false);
  });

  it('«ابدأ حصة أونلاين» is for today\'s sessions, by the phone\'s own calendar day', () => {
    const now = new Date(2026, 10, 12, 15, 0, 0).getTime();
    expect(isSameLocalDay(new Date(2026, 10, 12, 0, 0, 1).toISOString(), now)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 10, 12, 23, 59, 59).toISOString(), now)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 10, 13, 0, 0, 1).toISOString(), now)).toBe(false);
    expect(isSameLocalDay(new Date(2026, 10, 11, 23, 59, 59).toISOString(), now)).toBe(false);
    expect(isSameLocalDay(null, now)).toBe(false);
    expect(isSameLocalDay('not a date', now)).toBe(false);
  });
});

describe('constants the rest of the app leans on', () => {
  it('the room is the dark palette\'s canvas in both schemes', () => {
    expect(ROOM_BACKGROUND.toLowerCase()).toBe(dark.background.toLowerCase());
  });

  it('the notification type is the backend\'s', () => {
    expect(REMOTE_LIVE_NOTIFICATION).toBe('remote_session_live');
  });
});
