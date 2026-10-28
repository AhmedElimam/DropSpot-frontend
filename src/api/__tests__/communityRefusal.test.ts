jest.mock('../client', () => ({ __esModule: true, default: {} }));

import { writeRefusal } from '../community';

const err = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });

describe('community write refusals (guard-rails spec)', () => {
  it('a nudge carries its kind and the server sentence', () => {
    expect(writeRefusal(err(422, { code: 'nudge', kind: 'franco', message: 'اكتب بالعربي' }))).toEqual({ code: 'nudge', kind: 'franco', message: 'اكتب بالعربي' });
  });

  it('a suspension and a slow-down are told apart', () => {
    expect(writeRefusal(err(422, { code: 'suspended', message: 'متوقفة' }))?.code).toBe('suspended');
    expect(writeRefusal(err(429, { code: 'rate_limited', message: 'براحة' }))?.code).toBe('rate_limited');
  });

  it('an ordinary error or a missing sentence is not a refusal', () => {
    expect(writeRefusal(err(422, { message: 'النص أطول من ٤٠٠٠ حرف' }))).toBeNull();
    expect(writeRefusal(err(422, { code: 'nudge' }))).toBeNull();
    expect(writeRefusal(new Error('offline'))).toBeNull();
  });
});
