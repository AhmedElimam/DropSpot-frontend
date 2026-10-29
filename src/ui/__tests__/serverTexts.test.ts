import i18n from '@/i18n';
import { applyServerTexts } from '../serverTexts';

describe('rewordings from backend code (ui.texts)', () => {
  const bundled = i18n.t('community_space.tab');
  it('replaces a bundled string and keeps the rest', () => {
    applyServerTexts({ 'community_space.tab': 'المجتمع' });
    expect(i18n.t('community_space.tab')).toBe('المجتمع');
    expect(i18n.t('community_space.share_more')).toBe('مشاركة…');
  });
  it('a dropped line brings the bundled wording back', () => {
    applyServerTexts({});
    expect(i18n.t('community_space.tab')).toBe(bundled);
  });
  it('ignores what is not a dotted key or a string', () => {
    applyServerTexts({ tab: 'x', 'community_space.tab': '' as string, 'community_space.share_more': 7 as unknown as string });
    expect(i18n.t('community_space.tab')).toBe(bundled);
    expect(i18n.t('community_space.share_more')).toBe('مشاركة…');
  });
});
