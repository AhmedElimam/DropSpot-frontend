jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) },
}));

import { mergeConfig, useAppConfigStore } from '../appConfigStore';
import { pickFeatureTerms, useFeatureTermsStore } from '../featureTermsStore';
import type { FeatureTermsDoc } from '@/config/defaults';

/**
 * Feature agreements on the phone (founder 2026-10-17): a feature that reaches someone brings
 * its add-on agreement; nothing reaches anyone whose teacher has nothing targeted, so their app
 * is exactly what it was.
 */
const doc = (key: string, extra: Partial<FeatureTermsDoc> = {}): FeatureTermsDoc => ({
  key, version: '1', title: key, role: 'teacher', heading: 'h', intro: 'i', body: ['a'], checkbox: 'c', ...extra,
});

beforeEach(() => {
  useAppConfigStore.getState().setConfig({});
  useFeatureTermsStore.getState().reset();
});

describe('the payload', () => {
  it('carries nothing by default and from an older server', () => {
    expect(mergeConfig({}).feature_terms).toEqual([]);
    expect(mergeConfig({ feature_terms: undefined }).feature_terms).toEqual([]);
  });

  it('keeps only well-formed documents', () => {
    const odd = [doc('course_chat'), { key: 'x' }, null, 'nope', doc('threads', { body: 'not a list' as never })] as never;
    expect(mergeConfig({ feature_terms: odd }).feature_terms!.map((d) => d.key)).toEqual(['course_chat']);
  });

  it('drops an accepted one, and a sign-out forgets them all', () => {
    useAppConfigStore.getState().setConfig({ feature_terms: [doc('course_chat'), doc('threads')] });
    useAppConfigStore.getState().dropFeatureTerms('course_chat');
    expect(useAppConfigStore.getState().config.feature_terms!.map((d) => d.key)).toEqual(['threads']);
    useAppConfigStore.getState().resetUserFlags();
    expect(useAppConfigStore.getState().config.feature_terms).toEqual([]);
  });
});

describe('which agreement is on screen', () => {
  const due = [doc('course_chat'), doc('threads'), doc('print_market')];

  it('the first due one, nothing when none is due', () => {
    expect(pickFeatureTerms(due, [], null)?.key).toBe('course_chat');
    expect(pickFeatureTerms([], [], null)).toBeNull();
  });

  it('«لاحقًا» puts one off for the session; the next follows', () => {
    expect(pickFeatureTerms(due, ['course_chat'], null)?.key).toBe('threads');
    expect(pickFeatureTerms(due, ['course_chat', 'threads', 'print_market'], null)).toBeNull();
  });

  it('touching the feature (or a 423) opens it again even when put off', () => {
    expect(pickFeatureTerms(due, ['course_chat', 'threads', 'print_market'], 'threads')?.key).toBe('threads');
    // Asked for something no longer due → back to the normal order.
    expect(pickFeatureTerms([doc('print_market')], [], 'threads')?.key).toBe('print_market');
  });

  it('the store: put off, asked, done', () => {
    const s = useFeatureTermsStore.getState();
    s.putOff('course_chat');
    s.open('course_chat');
    expect(useFeatureTermsStore.getState()).toMatchObject({ later: ['course_chat'], asked: 'course_chat' });
    useFeatureTermsStore.getState().putOff('course_chat');
    expect(useFeatureTermsStore.getState().asked).toBeNull();
    useFeatureTermsStore.getState().done('course_chat');
    expect(useFeatureTermsStore.getState().later).toEqual([]);
  });
});
