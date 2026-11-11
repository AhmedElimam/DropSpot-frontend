import { parseReceiptAmount } from '../receiptAmount';

describe('parseReceiptAmount', () => {
  it('reads the sum next to a currency word, in either order and either digits', () => {
    expect(parseReceiptAmount('تم تحويل 350.00 جنيه إلى محمد')).toBe(350);
    expect(parseReceiptAmount('Transfer of EGP 1,200.00 succeeded')).toBe(1200);
    expect(parseReceiptAmount('تم تحويل ٤٥٠ ج.م')).toBe(450);
    expect(parseReceiptAmount('Amount: 75.5 EGP, ref 99887766')).toBe(75.5);
  });

  it('ignores numbers without a currency word (references, phone numbers)', () => {
    expect(parseReceiptAmount('رقم العملية 123456789 للرقم 01012345678')).toBeNull();
    expect(parseReceiptAmount(null)).toBeNull();
    expect(parseReceiptAmount('')).toBeNull();
  });
});
