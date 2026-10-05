import { TogetherComingSoon } from '@/components/student/TogetherComingSoon';

/**
 * «سوا» — the student's centre tab (founder 2026-10-06). Group chat and threads are not open
 * yet on this build, so the tab shows what is coming. The route is named `chat` so the real
 * conversations screen (threads branch) takes the same slot when it ships.
 */
export default function StudentTogether() {
  return <TogetherComingSoon />;
}
