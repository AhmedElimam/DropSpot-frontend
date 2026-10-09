import type { InternalAxiosRequestConfig } from 'axios';
import { bodyString, isQueued, matchQueueRule, queuedLabel, syntheticQueuedResponse } from '../offlineQueue';
import { formatNumber } from '@/utils/format';

jest.mock('@/i18n', () => ({ t: (k: string) => k }));

describe('matchQueueRule', () => {
  it('lets the day-to-day teacher actions wait offline', () => {
    expect(matchQueueRule('post', '/teacher/pending-collections/collect')?.label).toBe('collect');
    expect(matchQueueRule('POST', '/teacher/students/42/collect')?.label).toBe('collect');
    expect(matchQueueRule('post', '/teacher/sessions/7/note')?.label).toBe('session_sheet');
    expect(matchQueueRule('post', '/teacher/excuses/3/approve')?.label).toBe('decision');
    expect(matchQueueRule('patch', '/notifications/9/read')?.label).toBe('notification');
    expect(matchQueueRule('post', '/tickets/5/messages')?.label).toBe('message');
    expect(matchQueueRule('post', '/teacher/students/record')?.label).toBe('record_student');
    expect(matchQueueRule('post', '/teacher/courses')?.label).toBe('course');
  });

  it('keeps sign-in, uploads, money going back and removals live', () => {
    for (const [m, u] of [
      ['post', '/auth/login'], ['post', '/auth/verify-otp'], ['post', '/invoices/3/payment-proofs'],
      ['post', '/payments/reverse'], ['post', '/teacher/students/4/reverse-payment'], ['post', '/payments/waive'],
      ['post', '/teacher/enrollments/4/terminate'], ['delete', '/teacher/locations/2'], ['delete', '/assistants/3'],
      ['post', '/checkin/scan'], ['post', '/teacher/sessions/offline-marks'], ['post', '/teacher/sessions/8/mark'],
      ['post', '/teacher/cash/reconciliation/2/close'], ['get', '/teacher/students/4/collect'],
    ]) {
      expect(matchQueueRule(m, u)).toBeNull();
    }
  });

  it('ignores the host, the API prefix and the query string', () => {
    expect(matchQueueRule('post', 'https://drosspot.app/api/v1/teacher/expenses?x=1')?.label).toBe('expense');
  });
});

describe('queuedLabel / bodyString', () => {
  it('adds the amount when the body carries one', () => {
    const rule = matchQueueRule('post', '/teacher/students/1/collect')!;
    expect(queuedLabel(rule, bodyString({ kind: 'bill', amount: 300 }))).toContain('offline.actions.collect');
    expect(queuedLabel(rule, bodyString({ kind: 'bill', amount: 300 }))).toContain(formatNumber(300));
    expect(queuedLabel(rule, bodyString({ kind: 'bill' }))).toBe('offline.actions.collect');
    expect(queuedLabel(rule, 'not json')).toBe('offline.actions.collect');
  });

  it('stores an already-serialised body as is', () => {
    expect(bodyString('{"a":1}')).toBe('{"a":1}');
    expect(bodyString({ a: 1 })).toBe('{"a":1}');
    expect(bodyString(undefined)).toBeNull();
  });
});

describe('syntheticQueuedResponse', () => {
  it('reads as queued through every shape the API modules use', () => {
    const res = syntheticQueuedResponse({ headers: {} } as unknown as InternalAxiosRequestConfig);
    expect(res.status).toBe(202);
    expect(isQueued(res.data)).toBe(true);
    expect(isQueued(res.data.data)).toBe(true); // `data.data ?? data`
    expect(isQueued(res.data.data.attributes)).toBe(true); // JSON:API
    expect(isQueued({ remaining: '0' })).toBe(false);
    expect(isQueued(null)).toBe(false);
  });
});
