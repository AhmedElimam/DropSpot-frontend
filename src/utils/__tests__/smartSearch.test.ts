import { normalizeArabic, phoneDigits, searchScore } from '../smartSearch';

describe('smartSearch', () => {
  const ahmed = { name: 'أحمد عبدالله', code: 'STU-0412', phones: ['01012345678', '+201112223334'], tags: ['فيزياء السبت'] };
  const fatma = { name: 'فاطمة الزهراء', code: 'STU-0007', phones: ['01200000001'], tags: ['كيمياء'] };

  it('folds hamza, taa marbuta, alef maqsura, marks and Arabic digits', () => {
    expect(normalizeArabic('إِسْراء')).toBe('اسراء');
    expect(normalizeArabic('فاطمة')).toBe('فاطمه');
    expect(normalizeArabic('مصطفى')).toBe('مصطفي');
    expect(normalizeArabic('٠١٠')).toBe('010');
  });

  it('reads +20 and 0020 numbers the local way', () => {
    expect(phoneDigits('+201112223334')).toBe('01112223334');
    expect(phoneDigits('00201112223334')).toBe('01112223334');
    expect(phoneDigits('٠١٠١٢٣٤٥٦٧٨')).toBe('01012345678');
  });

  it('finds a name typed without hamza, with the words in any order', () => {
    expect(searchScore(ahmed, 'احمد')).toBeGreaterThan(0);
    expect(searchScore(ahmed, 'عبد الله احمد')).toBeGreaterThan(0);
    expect(searchScore(fatma, 'فاطمه')).toBeGreaterThan(0);
    expect(searchScore(fatma, 'احمد')).toBe(0);
  });

  it('every word must match something', () => {
    expect(searchScore(ahmed, 'احمد كيمياء')).toBe(0);
    expect(searchScore(ahmed, 'احمد فيزياء')).toBeGreaterThan(0);
  });

  it('finds a student by any part of their or a parent number, Arabic digits too', () => {
    expect(searchScore(ahmed, '5678')).toBeGreaterThan(0);
    expect(searchScore(ahmed, '٢٢٢٣')).toBeGreaterThan(0);
    expect(searchScore(ahmed, '01112223334')).toBeGreaterThan(0);
    expect(searchScore(fatma, '5678')).toBe(0);
  });

  it('ranks an exact code and a name start first', () => {
    expect(searchScore(ahmed, 'stu-0412')).toBeGreaterThan(searchScore(fatma, '04'));
    const starts = searchScore({ name: 'محمد علي' }, 'محمد');
    const inside = searchScore({ name: 'علي محمد' }, 'محمد');
    expect(starts).toBeGreaterThan(inside);
  });

  it('an empty query matches everything', () => {
    expect(searchScore(fatma, '  ')).toBe(1);
  });
});
