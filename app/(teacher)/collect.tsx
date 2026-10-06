import { Redirect, type Href } from 'expo-router';

/**
 * «تحصيل الدفعات» used to be a page with two cards — the list, and scanning — which was one
 * page too many (founder 2026-10-06). Both live on the collections list now: the list itself,
 * and a scan button always in reach. Kept as a redirect so old links and notifications land.
 */
export default function TeacherCollect() {
  return <Redirect href={'/(teacher)/pending-collections' as Href} />;
}
