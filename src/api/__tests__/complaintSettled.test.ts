import { paymentAlreadySettled } from '@/api/complaints';

// Production 2026-11-12: a family filed «دفعت ولم يُسجَّل», the bill was then taken at the
// counter, and «قبول» opened the money sheet against 0 due.
describe('paymentAlreadySettled', () => {
  const base = { type: 'payment' as const, status: 'pending' as const, invoice_settled: false, invoice_remaining: 200 };

  it('is false while something is still due', () => {
    expect(paymentAlreadySettled(base)).toBe(false);
  });
  it('is true when the server says the bill is settled', () => {
    expect(paymentAlreadySettled({ ...base, invoice_settled: true, invoice_remaining: 0 })).toBe(true);
  });
  it('reads 0 remaining as settled when an older server sends no flag', () => {
    expect(paymentAlreadySettled({ ...base, invoice_settled: undefined, invoice_remaining: 0 })).toBe(true);
  });
  it('never applies to a decided complaint or another kind', () => {
    expect(paymentAlreadySettled({ ...base, status: 'approved', invoice_settled: true })).toBe(false);
    expect(paymentAlreadySettled({ ...base, type: 'attendance', invoice_settled: true })).toBe(false);
  });
});
