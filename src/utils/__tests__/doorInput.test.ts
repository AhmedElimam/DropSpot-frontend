import { normalizeEgyptPhone, cleanDoorName, isDoorName } from '../validators';

// Fast register v2 (founder 2026-11-06): the same rule as the server's App\Support\EgyptPhone
// and App\Rules\ArabicName::clean — the spec's own examples.
describe('normalizeEgyptPhone', () => {
  it.each([
    ['٠١٠ ١٢٣ ٤٥٦٧٨', '01012345678'],
    ['+20 10 1234 5678', '01012345678'],
    ['0020101234 5678', '01012345678'],
    ['010-1234-5678', '01012345678'],
    ['201512345678', '01512345678'],
    ['۰۱۱۲۳۴۵۶۷۸۹', '01123456789'],
  ])('%s → %s', (raw, out) => {
    expect(normalizeEgyptPhone(raw)).toBe(out);
  });

  it.each(['0101234567', '01812345678', '', 'abc', '0131234567x'])('refuses %p', (raw) => {
    expect(normalizeEgyptPhone(raw)).toBeNull();
  });
});

describe('door names', () => {
  it('drops تشكيل, folds spaces and keeps a hyphen tight', () => {
    expect(cleanDoorName('  مُحَمَّد  عبد - الرحمن ')).toBe('محمد عبد-الرحمن');
  });
  it('accepts Arabic with a hyphen, refuses digits and Latin', () => {
    expect(isDoorName('مُحَمَّد عبد-الرحمن')).toBe(true);
    expect(isDoorName('Ahmed')).toBe(false);
    expect(isDoorName('أحمد 2')).toBe(false);
    expect(isDoorName('   ')).toBe(false);
  });
});
