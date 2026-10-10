import { buildSearch, normalizeArabic } from '../featureSearch';
import { FEATURES } from '../featureIndex';
import ar from '@/i18n/ar.json';

const t = (k: string): string => {
  let v: unknown = ar;
  for (const p of k.split('.')) v = (v as Record<string, unknown>)?.[p];
  return typeof v === 'string' ? v : k;
};
const search = buildSearch(FEATURES, t);
const top = (q: string) => search(q)[0]?.entry.id;

describe('normalizeArabic', () => {
  it('folds the spellings people mix up', () => {
    expect(normalizeArabic('فاتورة')).toBe(normalizeArabic('فاتوره'));
    expect(normalizeArabic('أحمد')).toBe(normalizeArabic('احمد'));
    expect(normalizeArabic('مُدَرِّس')).toBe('مدرس');
    expect(normalizeArabic('الفلوس')).toBe('فلوس');
    expect(normalizeArabic('٢٠٢٦')).toBe('2026');
  });
});

describe('feature search', () => {
  it('finds a feature by its everyday words, not only its title', () => {
    expect(top('فلوس')).toBe('collect');
    expect(top('مين دفع')).toBe('who_paid');
    expect(top('فودافون كاش')).toBe('payment_proofs');
    expect(top('اجازة')).toBe('pause');
    expect(top('باسورد')).toBe('password');
    expect(top('مدام روز')).toBe('rose');
  });

  it('finds editing and cancelling a payment by the words people use', () => {
    expect(top('تعديل تحصيل')).toBe('edit_collection');
    expect(top('تعديل الفاتوره')).toBe('edit_collection');
    expect(top('الغاء دفع')).toBe('cancel_payment');
    expect(top('استرجاع')).toBe('cancel_payment');
    expect(top('refund')).toBe('cancel_payment');
    expect(top('درجات')).toBe('sessions');
    expect(top('سكرتيرة')).toBe('assistants');
  });

  it('forgives a typo, a missing hamza or ta marbuta, and half a word', () => {
    expect(top('مصاريف')).toBe('expenses');
    expect(top('مصرو')).toBe('expenses');
    expect(top('اعتراضات')).toBe('complaints');
    expect(search('فاتوره').map((r) => r.entry.id)).toContain('collect');
  });

  it('every title key exists in ar.json (a result never shows a raw key)', () => {
    for (const f of FEATURES) {
      expect(t(f.titleKey)).not.toBe(f.titleKey);
      if (f.subKey) expect(t(f.subKey)).not.toBe(f.subKey);
    }
  });

  it('says nothing for one letter', () => {
    expect(search('ف')).toEqual([]);
  });
});
