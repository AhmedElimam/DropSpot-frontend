import client from './client';

export type OnboardingStep = 'intro' | 'course_form' | 'sessions';

/** Independent, non-blocking contextual tips — fire the first time each screen is reached, any order. */
export type OnboardingTip = 'billing' | 'invitation' | 'attendance' | 'reports';

/** Any onboarding key the /seen endpoint accepts. */
export type OnboardingKey = OnboardingStep | OnboardingTip;

export interface OnboardingState {
  active: boolean;
  steps: { intro: boolean; course_form: boolean; sessions: boolean };
  next_step: OnboardingStep | null;
  has_courses: boolean;
  tips: { billing: boolean; invitation: boolean; attendance: boolean; reports: boolean };
}

const EMPTY: OnboardingState = {
  active: false,
  steps: { intro: false, course_form: false, sessions: false },
  next_step: null,
  has_courses: false,
  tips: { billing: false, invitation: false, attendance: false, reports: false },
};

/** Teacher Onboarding Walkthrough state — shared with the web dashboard. */
export async function getOnboarding(): Promise<OnboardingState> {
  const { data } = await client.get('/teacher/onboarding');
  return (data?.data ?? data ?? EMPTY) as OnboardingState;
}

/** Mark a step or tip seen/dismissed/skipped (all three complete it). Returns fresh state. */
export async function markOnboardingStep(step: OnboardingKey): Promise<OnboardingState> {
  const { data } = await client.post(`/teacher/onboarding/${step}/seen`);
  return (data?.data ?? data ?? EMPTY) as OnboardingState;
}
