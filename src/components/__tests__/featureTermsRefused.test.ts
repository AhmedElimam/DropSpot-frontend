jest.mock('@/stores/authStore', () => ({ useAuthStore: Object.assign(() => null, { getState: () => ({}) }) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { refusedFor } = require('../FeatureTermsPrompt') as typeof import('../FeatureTermsPrompt');

const refused = (feature: string) => ({ response: { status: 423, data: { code: 'FEATURE_TERMS_REQUIRED', feature } } });

describe('accepting an agreement refetches only what it unlocked', () => {
  it('matches a 423 for that feature only', () => {
    expect(refusedFor(refused('course_chat'), 'course_chat')).toBe(true);
    expect(refusedFor(refused('threads'), 'course_chat')).toBe(false);
  });
  it('ignores healthy queries and other errors', () => {
    expect(refusedFor(null, 'course_chat')).toBe(false);
    expect(refusedFor({ response: { status: 500 } }, 'course_chat')).toBe(false);
    expect(refusedFor(new Error('Network Error'), 'course_chat')).toBe(false);
  });
});
