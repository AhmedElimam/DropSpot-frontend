import { foldForSearch, relationshipLabel } from '../format';

describe('foldForSearch', () => {
  const finds = (haystack: string, needle: string) => foldForSearch(haystack).includes(foldForSearch(needle));

  it('treats the alef forms, taa marbuta and alef maqsura as the letters people type', () => {
    expect(finds('أحمد محمود', 'احمد')).toBe(true);
    expect(finds('إسراء', 'اسراء')).toBe(true);
    expect(finds('فاطمة علي', 'فاطمه')).toBe(true);
    expect(finds('مصطفى', 'مصطفي')).toBe(true);
  });

  it('ignores tashkeel, tatweel, case, spacing and Arabic digits', () => {
    expect(finds('مُحَمَّد', 'محمد')).toBe(true);
    expect(finds('محـــمد', 'محمد')).toBe(true);
    expect(finds('STU-0226', 'stu-٠٢٢')).toBe(true);
    expect(finds('أحمد   علي', 'احمد علي')).toBe(true);
  });

  it('does not match a different name', () => {
    expect(finds('أحمد', 'محمد')).toBe(false);
    expect(foldForSearch(null)).toBe('');
  });
});

describe('relationshipLabel', () => {
  it('shows the stored relationship in Arabic', () => {
    expect(relationshipLabel('father')).toBe('الأب');
    expect(relationshipLabel('Mother')).toBe('الأم');
    expect(relationshipLabel('guardian')).toBe('الوصي');
    expect(relationshipLabel(null)).toBe('');
    expect(relationshipLabel('خال')).toBe('خال');
  });
});
