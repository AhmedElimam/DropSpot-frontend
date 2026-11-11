import { UPDATE_PROMPT_SNOOZE_MS, parseSnooze, updateOffered, updatePromptVoice, updateSnoozed } from '../updatePrompt';
import { mergeConfig } from '@/stores/appConfigStore';
import { POPUP_ORDER } from '@/ui/popupSlot';

describe('«حدّث التطبيق» — the update that can be put away (2026-11-12)', () => {
  it('nobody is asked until the server names a newer version', () => {
    expect(updateOffered('1.2.9', null, '1.0.0')).toBe(false);
    expect(updateOffered('1.2.9', undefined, '1.0.0')).toBe(false);
    expect(updateOffered('1.2.9', '', '1.0.0')).toBe(false);
    expect(updateOffered('1.2.9', 'soon', '1.0.0')).toBe(false);
  });

  it('a binary below the newest is asked; the newest itself and anything above it are not', () => {
    expect(updateOffered('1.2.9', '1.3.0', '1.0.0')).toBe(true);
    expect(updateOffered('1.3.0', '1.3.0', '1.0.0')).toBe(false);
    expect(updateOffered('1.3.1', '1.3.0', '1.0.0')).toBe(false);
  });

  it('below the floor the blocking screen speaks, not this popup', () => {
    expect(updateOffered('1.1.0', '1.3.0', '1.2.0')).toBe(false);
  });

  it('مدام روز speaks to the teacher and the assistant, الناظر to the families, nobody to the rest', () => {
    expect(updatePromptVoice('teacher')).toBe('rose');
    expect(updatePromptVoice('assistant')).toBe('rose');
    expect(updatePromptVoice('student')).toBe('nazer');
    expect(updatePromptVoice('parent')).toBe('nazer');
    expect(updatePromptVoice('driver')).toBeNull();
    expect(updatePromptVoice(null)).toBeNull();
  });

  it('«بعدين» holds for a day, and only for the version it was said to', () => {
    const at = 1_000_000;
    expect(updateSnoozed({ version: '1.3.0', at }, '1.3.0', at + UPDATE_PROMPT_SNOOZE_MS - 1)).toBe(true);
    expect(updateSnoozed({ version: '1.3.0', at }, '1.3.0', at + UPDATE_PROMPT_SNOOZE_MS)).toBe(false);
    expect(updateSnoozed({ version: '1.3.0', at }, '1.3.1', at + 5)).toBe(false);
    expect(updateSnoozed(null, '1.3.0', at)).toBe(false);
  });

  it('a damaged «بعدين» on disk counts as none', () => {
    expect(parseSnooze(null)).toBeNull();
    expect(parseSnooze('{bad')).toBeNull();
    expect(parseSnooze('{"version":3}')).toBeNull();
    expect(parseSnooze('{"version":"1.3.0","at":5}')).toEqual({ version: '1.3.0', at: 5 });
  });

  it('an older server (no field) and a blank value both mean no popup', () => {
    expect(mergeConfig({}).latest_app_version).toBeNull();
    expect(mergeConfig({ latest_app_version: '' }).latest_app_version).toBeNull();
    expect(mergeConfig({ latest_app_version: '1.3.0' }).latest_app_version).toBe('1.3.0');
  });

  it('waits its turn: after the subscription sheet, before a survey', () => {
    const at = (id: string) => (POPUP_ORDER as readonly string[]).indexOf(id);
    expect(at('app_update')).toBeGreaterThan(at('subscription_status'));
    expect(at('app_update')).toBeLessThan(at('survey'));
  });
});
