import { editDistance, parseQuery, shopMatches, suggest, wordMatches, type SearchableShop } from '../shopSearch';

const CAPS = { color: 'ألوان', spiral: 'سلك حلزوني', delivery: 'توصيل', duplex: 'وجهين', rush: 'مستعجل', a5: 'مقاس A5' };

const ink: SearchableShop = {
  vendor_id: 12, name: 'ink Town', city: 'المنصورة', tagline: 'ملازم وامتحانات بجودة ليزر', quality_label: 'ممتازة', ink_tech_label: 'ليزر',
  capabilities: ['color', 'spiral', 'delivery', 'duplex', 'rush'], extras: [{ name: 'تصميم غلاف باسم المعلّم' }], logo: 'https://x/logo.png',
};
const kar: SearchableShop = {
  vendor_id: 316, name: 'مطبعة كراوية للدعاية والإعلان', city: 'طنطا', tagline: null, quality_label: 'اقتصادية', ink_tech_label: 'ديجيتال',
  capabilities: ['duplex'], logo: null,
};
const shops = [ink, kar];

describe('shop search', () => {
  it('measures edits and tolerates one typo on longer words', () => {
    expect(editDistance('كراويه', 'كراوية'.replace('ة', 'ه'))).toBe(0);
    expect(editDistance('منصوره', 'منصرره')).toBe(1);
    expect(wordMatches('المنصوره', 'منصرره')).toBe(true);
    expect(wordMatches('ink town', 'tow')).toBe(true);
    expect(wordMatches('ink town', 'xyz')).toBe(false);
  });

  it('reads sorts and capabilities out of everyday words', () => {
    expect(parseQuery('ألوان رخيص', CAPS)).toMatchObject({ sort: 'cheapest', caps: ['color'], rest: [] });
    expect(parseQuery('سلك قريب مني', CAPS)).toMatchObject({ sort: 'nearest', caps: ['spiral'], rest: [] });
    expect(parseQuery('مستعجل توصيل', CAPS).caps.sort()).toEqual(['delivery', 'rush']);
    expect(parseQuery('اقل سعر', CAPS).sort).toBe('cheapest');
    // «ألوان» is colour only, not also the longer «ألوان فوتوغرافي» label
    expect(parseQuery('ألوان', { ...CAPS, color_hq: 'ألوان فوتوغرافي' }).caps).toEqual(['color']);
    expect(parseQuery('كراوية', CAPS)).toMatchObject({ sort: null, caps: [], rest: ['كراويه'] });
  });

  it('matches shops by name, area, tagline, extras and asked capabilities — Arabic folded', () => {
    expect(shopMatches(ink, parseQuery('الوان', CAPS), CAPS)).toBe(true);
    expect(shopMatches(kar, parseQuery('الوان', CAPS), CAPS)).toBe(false);
    expect(shopMatches(kar, parseQuery('كراويه', CAPS), CAPS)).toBe(true);
    expect(shopMatches(kar, parseQuery('مطبعه', CAPS), CAPS)).toBe(true);
    expect(shopMatches(ink, parseQuery('منصوره', CAPS), CAPS)).toBe(true);
    expect(shopMatches(ink, parseQuery('غلاف', CAPS), CAPS)).toBe(true);
    expect(shopMatches(ink, parseQuery('INK', CAPS), CAPS)).toBe(true);
    expect(shopMatches(ink, parseQuery('طنطا', CAPS), CAPS)).toBe(false);
  });

  it('suggests intents, shops and areas while typing', () => {
    const s = suggest('الوان رخيص', shops, CAPS);
    expect(s[0]).toEqual({ kind: 'sort', key: 'cheapest' });
    expect(s).toContainEqual({ kind: 'filter', key: 'color' });

    const named = suggest('كرا', shops, CAPS);
    expect(named).toContainEqual(expect.objectContaining({ kind: 'shop', id: 316 }));
    expect(named.some((x) => x.kind === 'shop' && x.id === 12)).toBe(false);

    expect(suggest('طنط', shops, CAPS)).toContainEqual({ kind: 'area', text: 'طنطا' });
    // still typing a capability label → offered as a filter
    expect(suggest('سل', shops, CAPS)).toContainEqual({ kind: 'filter', key: 'spiral' });
  });
});
