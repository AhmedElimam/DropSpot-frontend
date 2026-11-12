/**
 * «حضوري / أونلاين» — the decisions of src/remote/delivery.ts: what a row's `delivery` means,
 * where the «أونلاين» chip is drawn, which scopes the teacher is offered, when the control is
 * drawn at all, what a student is told while an online session has not started, and that every
 * word the screens ask for exists.
 */
import {
  DELIVERY_CHANGED_NOTIFICATION,
  canChangeDelivery,
  deliveryAskKey,
  deliveryDoneKey,
  deliveryLabelKey,
  deliveryOf,
  deliveryScopeOptions,
  isRemoteDelivery,
  otherDelivery,
  scopeHintKey,
  scopeLabelKey,
  showsDeliveryControl,
  showsOnlineChip,
  waitsForTeacher,
  type DeliveryScope,
  type SessionDelivery,
} from '../delivery';
import ar from '@/i18n/ar.json';
import { remotePaths } from '@/api/remoteSession';

jest.mock('@/api/client', () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn() } }));

const NOW = new Date('2026-11-07T16:55:00+02:00').getTime();
const at = (iso: string) => new Date(iso).toISOString();
const TODAY_5PM = at('2026-11-07T17:00:00+02:00');
const LAST_WEEK = at('2026-10-31T17:00:00+02:00');

describe('what a row says', () => {
  it('only `remote` is online; everything else is in person', () => {
    expect(deliveryOf('remote')).toBe('remote');
    for (const v of ['in_person', undefined, null, '', 'REMOTE', 'online', 1, true, {}]) expect(deliveryOf(v)).toBe('in_person');
  });

  it('an older server (no field) and a missing row read as in person', () => {
    expect(isRemoteDelivery({})).toBe(false);
    expect(isRemoteDelivery(null)).toBe(false);
    expect(isRemoteDelivery(undefined)).toBe(false);
    expect(isRemoteDelivery({ delivery: 'in_person' })).toBe(false);
    expect(isRemoteDelivery({ delivery: 'remote' })).toBe(true);
  });

  it('the other value is the one a tap asks for', () => {
    expect(otherDelivery('in_person')).toBe('remote');
    expect(otherDelivery('remote')).toBe('in_person');
  });

  it('the notification type is the server\'s', () => {
    expect(DELIVERY_CHANGED_NOTIFICATION).toBe('session_delivery_changed');
  });
});

describe('the «أونلاين» chip', () => {
  it('is drawn on an online session while the feature is on', () => {
    expect(showsOnlineChip({ delivery: 'remote', status: 'scheduled' }, true)).toBe(true);
    // A group row has no status.
    expect(showsOnlineChip({ delivery: 'remote' }, true)).toBe(true);
  });

  it('stays on a session that is over — it was held online', () => {
    expect(showsOnlineChip({ delivery: 'remote', status: 'completed' }, true)).toBe(true);
  });

  it('is not drawn with the feature off, on an in-person row, or on a cancelled session', () => {
    expect(showsOnlineChip({ delivery: 'remote', status: 'scheduled' }, false)).toBe(false);
    expect(showsOnlineChip({ delivery: 'in_person', status: 'scheduled' }, true)).toBe(false);
    expect(showsOnlineChip({ status: 'scheduled' }, true)).toBe(false);
    expect(showsOnlineChip({ delivery: 'remote', status: 'cancelled' }, true)).toBe(false);
    expect(showsOnlineChip(null, true)).toBe(false);
  });
});

describe('what the teacher is offered', () => {
  it('from a session: the three scopes, the narrowest first', () => {
    expect(deliveryScopeOptions('session')).toEqual(['session', 'group', 'all']);
  });

  it('from a group\'s schedule: that group, nothing to choose', () => {
    expect(deliveryScopeOptions('group')).toEqual(['group']);
  });

  it('a session can change until it is over', () => {
    expect(canChangeDelivery({ status: 'scheduled', scheduled_at: TODAY_5PM, duration_minutes: 60 }, NOW)).toBe(true);
    // Running: 17:59 of a 17:00–18:00 session.
    expect(canChangeDelivery({ status: 'scheduled', scheduled_at: TODAY_5PM, duration_minutes: 60 }, NOW + 64 * 60_000)).toBe(true);
    // Its hour has passed.
    expect(canChangeDelivery({ status: 'scheduled', scheduled_at: TODAY_5PM, duration_minutes: 60 }, NOW + 66 * 60_000)).toBe(false);
    // No length on the row: an hour.
    expect(canChangeDelivery({ status: 'scheduled', scheduled_at: TODAY_5PM }, NOW + 66 * 60_000)).toBe(false);
  });

  it('a cancelled, a completed or an undated session cannot', () => {
    expect(canChangeDelivery({ status: 'cancelled', scheduled_at: TODAY_5PM }, NOW)).toBe(false);
    expect(canChangeDelivery({ status: 'scheduled', is_cancelled: true, scheduled_at: TODAY_5PM }, NOW)).toBe(false);
    expect(canChangeDelivery({ status: 'completed', scheduled_at: TODAY_5PM }, NOW)).toBe(false);
    expect(canChangeDelivery({ status: 'scheduled', is_completed: true, scheduled_at: TODAY_5PM }, NOW)).toBe(false);
    expect(canChangeDelivery({ status: 'scheduled', scheduled_at: LAST_WEEK, duration_minutes: 60 }, NOW)).toBe(false);
    expect(canChangeDelivery({ status: 'scheduled', scheduled_at: null }, NOW)).toBe(false);
    expect(canChangeDelivery({ status: 'scheduled', scheduled_at: 'not a date' }, NOW)).toBe(false);
    expect(canChangeDelivery(null, NOW)).toBe(false);
  });

  it('the control is drawn only with the feature on, a `delivery` from the server, and a session that can change', () => {
    const row = { delivery: 'in_person', status: 'scheduled', scheduled_at: TODAY_5PM, duration_minutes: 60 };
    expect(showsDeliveryControl(row, true, NOW)).toBe(true);
    expect(showsDeliveryControl({ ...row, delivery: 'remote' }, true, NOW)).toBe(true);
    expect(showsDeliveryControl(row, false, NOW)).toBe(false);
    // An older server sends no field: nothing to switch.
    expect(showsDeliveryControl({ ...row, delivery: undefined }, true, NOW)).toBe(false);
    expect(showsDeliveryControl({ ...row, status: 'cancelled' }, true, NOW)).toBe(false);
    expect(showsDeliveryControl({ ...row, scheduled_at: LAST_WEEK }, true, NOW)).toBe(false);
    expect(showsDeliveryControl(null, true, NOW)).toBe(false);
  });
});

describe('what a student is told before the class is opened', () => {
  const row = { delivery: 'remote', status: 'scheduled', scheduled_at: TODAY_5PM, duration_minutes: 60, remote: { live: false }, attendance_status: null };

  it('an online session not opened yet waits for the teacher', () => {
    expect(waitsForTeacher(row, true, NOW)).toBe(true);
    // The server may send no `remote` field at all.
    expect(waitsForTeacher({ ...row, remote: null }, true, NOW)).toBe(true);
  });

  it('not once it is on air — the «ادخل» button is there instead', () => {
    expect(waitsForTeacher({ ...row, remote: { live: true } }, true, NOW)).toBe(false);
  });

  it('not once the student has an outcome, and not for a session cancelled or over', () => {
    expect(waitsForTeacher({ ...row, attendance_status: 'present' }, true, NOW)).toBe(false);
    expect(waitsForTeacher({ ...row, attendance_status: 'absent' }, true, NOW)).toBe(false);
    expect(waitsForTeacher({ ...row, status: 'cancelled' }, true, NOW)).toBe(false);
    expect(waitsForTeacher({ ...row, status: 'completed' }, true, NOW)).toBe(false);
    expect(waitsForTeacher({ ...row, scheduled_at: LAST_WEEK }, true, NOW)).toBe(false);
  });

  it('an in-person session keeps the door, and the feature off says nothing', () => {
    expect(waitsForTeacher({ ...row, delivery: 'in_person' }, true, NOW)).toBe(false);
    expect(waitsForTeacher({ ...row, delivery: undefined }, true, NOW)).toBe(false);
    expect(waitsForTeacher(row, false, NOW)).toBe(false);
    expect(waitsForTeacher(null, true, NOW)).toBe(false);
  });
});

describe('words', () => {
  const remote = (ar as { remote: Record<string, string> }).remote;
  const word = (key: string) => {
    expect(key.startsWith('remote.')).toBe(true);
    return remote[key.slice('remote.'.length)];
  };
  const values: SessionDelivery[] = ['in_person', 'remote'];
  const scopes: DeliveryScope[] = ['session', 'group', 'all'];

  it('the two values read «حضوري» and «أونلاين»', () => {
    expect(word(deliveryLabelKey('in_person'))).toBe('حضوري');
    expect(word(deliveryLabelKey('remote'))).toBe('أونلاين');
  });

  it('the three scopes read as the founder asked', () => {
    expect(word(scopeLabelKey('session'))).toBe('الحصة دي بس');
    expect(word(scopeLabelKey('group'))).toBe('كل حصص المجموعة الجاية');
    expect(word(scopeLabelKey('all'))).toBe('كل مجموعاتي');
  });

  it('every key the screens build exists in the Arabic file', () => {
    for (const v of values) {
      expect(word(deliveryAskKey(v))).toBeTruthy();
      for (const s of scopes) expect(word(deliveryDoneKey(v, s))).toBeTruthy();
    }
    for (const s of scopes) expect(word(scopeHintKey(s))).toBeTruthy();
    for (const k of ['online_chip', 'delivery_label', 'delivery_ask_sub', 'delivery_done_none', 'delivery_told', 'delivery_confirm_cta',
      'group_delivery_label', 'group_delivery_hint', 'group_ask_remote', 'group_ask_in_person', 'group_ask_body', 'waits_for_teacher']) {
      expect(remote[k]).toBeTruthy();
    }
  });

  it('a change of several sessions says how many', () => {
    for (const v of values) for (const s of ['group', 'all'] as const) expect(word(deliveryDoneKey(v, s))).toContain('{{n}}');
  });

  it('a student waiting is told the session is online and starts when the teacher opens it', () => {
    expect(remote.waits_for_teacher).toBe('الحصة دي أونلاين — هتبدأ لما المدرّس يفتحها');
  });
});

describe('the two calls', () => {
  it('a session\'s, and a group\'s from its schedule', () => {
    expect(remotePaths.sessionDelivery(81)).toBe('/teacher/sessions/81/delivery');
    expect(remotePaths.groupDelivery(7, '12')).toBe('/teacher/courses/7/schedules/12/delivery');
  });

  it('an id is never read as a path', () => {
    expect(remotePaths.sessionDelivery('8/../1')).toBe('/teacher/sessions/8%2F..%2F1/delivery');
  });
});
