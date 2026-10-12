import { evaluateCondition, parseCondition } from '../conditions';

const ctx = { online: true, role: 'teacher', can: { collect_payments: true }, student: { billing: { pending_total: 300, has_pending: true }, grade: 'g3' }, mode: 'pay' };

describe('the condition language the backend may write', () => {
  it('reads dotted names, compares, combines and negates', () => {
    expect(evaluateCondition('student.billing.pending_total > 0 && online', ctx)).toBe(true);
    expect(evaluateCondition('student.billing.pending_total > 500', ctx)).toBe(false);
    expect(evaluateCondition('!online || role == "parent"', ctx)).toBe(false);
    expect(evaluateCondition("role == 'teacher' && can.collect_payments", ctx)).toBe(true);
    expect(evaluateCondition('can.reply_tickets', ctx)).toBe(false);
    expect(evaluateCondition("mode in ['pay', 'revision'] && (student.grade != 'g1')", ctx)).toBe(true);
    expect(evaluateCondition('student.billing.has_pending == true', ctx)).toBe(true);
    expect(evaluateCondition('student.missing.deep == null', ctx)).toBe(true);
  });

  it('never executes anything and treats a malformed expression as "say nothing"', () => {
    expect(parseCondition('online && (')).toBeNull();
    expect(evaluateCondition('online && (', ctx)).toBeUndefined();
    expect(evaluateCondition('process.exit(1)', ctx)).toBeUndefined();
    expect(evaluateCondition('student.billing.pending_total > 0 ; alert(1)', ctx)).toBeUndefined();
  });
});
