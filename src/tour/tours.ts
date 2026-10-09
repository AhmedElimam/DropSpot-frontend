import type { Href } from 'expo-router';
import type { TourDef, TourStep } from './store';

/**
 * The scripts — one per role, about two minutes each: a welcome card, the home screen's
 * pieces, then the tab bar left to right with each tab opened as it is named, then a done
 * card. Target ids are the `<TourTarget id>`s on the screens; a step whose target is not
 * there (an assistant without the scanner) is skipped.
 */
const card = (title: string, body: string, cta: string, extra: Partial<TourStep> = {}): TourStep => ({ title, body, cta, ...extra });
const spot = (target: string, title: string, body: string, route?: Href, extra: Partial<TourStep> = {}): TourStep => ({ target, title, body, route, ...extra });

const T = '/(teacher)/(tabs)' as Href;
// The teacher side is presented by مدام روز in her own voice (founder 2026-10-07: «increase her
// influence … she's the one explaining — teacher side only»). Facts, never approval; never «AI».
export const TEACHER_TOUR: TourDef = {
  id: 'teacher',
  narrator: 'rose',
  steps: [
    card('tour.teacher.welcome_title', 'tour.teacher.welcome_body', 'tour.start'),
    spot('home:stats', 'tour.teacher.stats_title', 'tour.teacher.stats_body', T),
    spot('home:spotlight', 'tour.teacher.spotlight_title', 'tour.teacher.spotlight_body'),
    spot('header:scan', 'tour.teacher.scan_title', 'tour.teacher.scan_body'),
    spot('home:shortcuts', 'tour.teacher.shortcuts_title', 'tour.teacher.shortcuts_body'),
    spot('header:bell', 'tour.teacher.bell_title', 'tour.teacher.bell_body'),
    spot('tab:sessions', 'tour.teacher.sessions_title', 'tour.teacher.sessions_body', '/(teacher)/(tabs)/sessions' as Href),
    spot('tab:manage', 'tour.teacher.manage_title', 'tour.teacher.manage_body', '/(teacher)/(tabs)/manage' as Href),
    spot('tab:students', 'tour.teacher.students_title', 'tour.teacher.students_body', '/(teacher)/(tabs)/students' as Href),
    spot('tab:settings', 'tour.teacher.settings_title', 'tour.teacher.settings_body', '/(teacher)/(tabs)/settings' as Href),
    // «شروحات التطبيق» — down the settings page, so the page hands its scroll to the tour
    // (useTourScroll) and the row is brought into view. Routed, so stepping BACK to it from
    // the home never aims at the hidden settings tab. Teachers only: assistants have no videos.
    spot('settings:tutorials', 'tour.teacher.tutorials_title', 'tour.teacher.tutorials_body', '/(teacher)/(tabs)/settings' as Href, { notFor: ['assistant'] }),
    spot('tab:index', 'tour.teacher.home_again_title', 'tour.teacher.home_again_body', T),
    // The first thing to do, with the button that does it (founder 2026-10-06: «show at the
    // end that you start with the schedule and a course»). Not for an assistant.
    card('tour.teacher.done_title', 'tour.teacher.done_body', 'tour.teacher.done_cta', { href: '/(teacher)/courses/create' as Href, notFor: ['assistant'] }),
    card('tour.teacher.assistant_done_title', 'tour.teacher.assistant_done_body', 'tour.finish', { notFor: ['teacher'] }),
  ],
};

const P = '/(parent)/(tabs)' as Href;
export const PARENT_TOUR: TourDef = {
  id: 'parent',
  steps: [
    card('tour.parent.welcome_title', 'tour.parent.welcome_body', 'tour.start'),
    spot('home:stats', 'tour.parent.stats_title', 'tour.parent.stats_body', P),
    spot('home:spotlight', 'tour.parent.verdict_title', 'tour.parent.verdict_body'),
    spot('header:bell', 'tour.parent.bell_title', 'tour.parent.bell_body'),
    spot('tab:teachers', 'tour.parent.teachers_title', 'tour.parent.teachers_body', '/(parent)/(tabs)/teachers' as Href),
    spot('tab:community', 'tour.parent.community_title', 'tour.parent.community_body', '/(parent)/(tabs)/community' as Href),
    spot('tab:invoices', 'tour.parent.invoices_title', 'tour.parent.invoices_body', '/(parent)/(tabs)/invoices' as Href),
    spot('tab:profile', 'tour.parent.profile_title', 'tour.parent.profile_body', '/(parent)/(tabs)/profile' as Href),
    spot('tab:index', 'tour.parent.done_title', 'tour.parent.done_body', P),
  ],
};

const S = '/(student)/(tabs)' as Href;
export const STUDENT_TOUR: TourDef = {
  id: 'student',
  steps: [
    card('tour.student.welcome_title', 'tour.student.welcome_body', 'tour.start'),
    spot('home:stats', 'tour.student.stats_title', 'tour.student.stats_body', S),
    spot('home:spotlight', 'tour.student.spotlight_title', 'tour.student.spotlight_body'),
    spot('home:shortcuts', 'tour.student.shortcuts_title', 'tour.student.shortcuts_body'),
    spot('header:bell', 'tour.student.bell_title', 'tour.student.bell_body'),
    spot('tab:check-in', 'tour.student.checkin_title', 'tour.student.checkin_body', '/(student)/(tabs)/check-in' as Href),
    spot('tab:chat', 'tour.student.chat_title', 'tour.student.chat_body', '/(student)/(tabs)/chat' as Href),
    spot('tab:invoices', 'tour.student.invoices_title', 'tour.student.invoices_body', '/(student)/(tabs)/invoices' as Href),
    spot('tab:profile', 'tour.student.profile_title', 'tour.student.profile_body', '/(student)/(tabs)/profile' as Href),
    spot('tab:index', 'tour.student.done_title', 'tour.student.done_body', S),
  ],
};

export function tourForRole(role: string | null | undefined): TourDef | null {
  switch (role) {
    case 'teacher':
    case 'assistant':
      return TEACHER_TOUR;
    case 'parent':
      return PARENT_TOUR;
    case 'student':
      return STUDENT_TOUR;
    default:
      return null;
  }
}
