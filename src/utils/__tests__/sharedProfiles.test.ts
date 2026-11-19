import {
  currentProfile,
  highlightedProfileId,
  isSharedPhone,
  orderProfiles,
  phoneHolderId,
  pickAction,
  profileFirstName,
  profileList,
  profileSubtitle,
  rememberedProfileKey,
  sharedPhoneLine,
  shouldShowProfilePicker,
} from '../sharedProfiles';
import type { StudentProfileEntry } from '@/types/user';

const ahmed: StudentProfileEntry = { user_id: 41, student_id: 30, name: 'أحمد محمد علي', first_name: 'أحمد', student_code: 'STU-1001', grade: 'الصف الأول الثانوي', is_current: true, holds_phone: true };
const omar: StudentProfileEntry = { user_id: 57, student_id: 44, name: 'عمر محمد علي', first_name: 'عمر', student_code: 'STU-1002', grade: null, is_current: false, holds_phone: false };
const sara: StudentProfileEntry = { user_id: 63, student_id: 51, name: 'سارة محمد', student_code: null, grade: 'الصف الثالث الإعدادي' };

describe('shared phone — is it shared', () => {
  it('empty, missing, one profile or junk = not shared', () => {
    expect(isSharedPhone(undefined)).toBe(false);
    expect(isSharedPhone(null)).toBe(false);
    expect(isSharedPhone([])).toBe(false);
    expect(isSharedPhone([ahmed])).toBe(false);
    expect(isSharedPhone('x' as never)).toBe(false);
    expect(profileList([ahmed, null as never, { name: 'x' } as never])).toEqual([ahmed]);
  });

  it('two or more = shared', () => {
    expect(isSharedPhone([ahmed, omar])).toBe(true);
    expect(isSharedPhone([ahmed, omar, sara])).toBe(true);
  });
});

describe('the picker decision', () => {
  it('shows only for a student, right after a sign-in, on a shared phone', () => {
    expect(shouldShowProfilePicker({ role: 'student', pending: true, profiles: [ahmed, omar] })).toBe(true);
  });

  it('never on a cold start (no pending flag)', () => {
    expect(shouldShowProfilePicker({ role: 'student', pending: false, profiles: [ahmed, omar] })).toBe(false);
  });

  it('never for a phone that is not shared', () => {
    expect(shouldShowProfilePicker({ role: 'student', pending: true, profiles: [ahmed] })).toBe(false);
    expect(shouldShowProfilePicker({ role: 'student', pending: true, profiles: undefined })).toBe(false);
  });

  it('never for another role', () => {
    for (const role of ['parent', 'teacher', 'assistant', 'admin', null]) {
      expect(shouldShowProfilePicker({ role, pending: true, profiles: [ahmed, omar] })).toBe(false);
    }
  });

  it('tapping the profile already signed in continues; another one switches', () => {
    expect(pickAction(ahmed, 41)).toBe('continue');
    expect(pickAction({ user_id: 41 }, 41)).toBe('continue');
    expect(pickAction(omar, 41)).toBe('switch');
    expect(pickAction({ ...omar, is_current: true }, 41)).toBe('continue');
  });
});

describe('who is who', () => {
  it('the phone holder is the one holding the phone, else the lowest id', () => {
    expect(phoneHolderId([omar, ahmed])).toBe(41);
    expect(phoneHolderId([{ ...omar, holds_phone: false }, { ...sara }])).toBe(57);
    expect(phoneHolderId([])).toBeNull();
  });

  it('the current profile: is_current, else the signed-in user, else the first', () => {
    expect(currentProfile([omar, ahmed])?.user_id).toBe(41);
    expect(currentProfile([{ ...omar, is_current: false }, { ...sara }], 63)?.user_id).toBe(63);
    expect(currentProfile([{ ...omar, is_current: false }, sara], 999)?.user_id).toBe(57);
    expect(currentProfile([], 1)).toBeNull();
  });

  it('the phone holder first, the others in the server order', () => {
    expect(orderProfiles([omar, sara, ahmed]).map((p) => p.user_id)).toEqual([41, 57, 63]);
  });
});

describe('the remembered choice', () => {
  it('pre-highlights the remembered profile while it is still on the phone', () => {
    expect(highlightedProfileId([ahmed, omar], 57, 41)).toBe(57);
  });

  it('falls back to the current profile when nothing (or a gone profile) is remembered', () => {
    expect(highlightedProfileId([ahmed, omar], null, 41)).toBe(41);
    expect(highlightedProfileId([ahmed, omar], 999, 41)).toBe(41);
    expect(highlightedProfileId([], 57, 41)).toBeNull();
  });

  it('is stored per phone holder', () => {
    expect(rememberedProfileKey(41)).toBe('shared_phone_choice_41');
    expect(rememberedProfileKey(41)).not.toBe(rememberedProfileKey(57));
  });
});

describe('labels', () => {
  it('first name: the server one, else the first word of the name', () => {
    expect(profileFirstName(ahmed)).toBe('أحمد');
    expect(profileFirstName(sara)).toBe('سارة');
    expect(profileFirstName({ name: '  ', first_name: null })).toBe('');
    expect(profileFirstName(null)).toBe('');
  });

  it('subtitle: code · grade, whichever exist', () => {
    expect(profileSubtitle(ahmed)).toBe('STU-1001 · الصف الأول الثانوي');
    expect(profileSubtitle(omar)).toBe('STU-1002');
    expect(profileSubtitle(sara)).toBe('الصف الثالث الإعدادي');
    expect(profileSubtitle({ student_code: null, grade: null })).toBe('');
  });

  it("the teacher's line: holder lists the siblings, sibling names the holder, nothing otherwise", () => {
    const t = (key: string, opts?: Record<string, unknown>) => `${key}|${JSON.stringify(opts ?? {})}`;
    expect(sharedPhoneLine({ role: 'holder', with: [{ name: 'عمر' }, { name: 'سارة' }] }, t))
      .toBe('student_profile_ui.shared_phone_holder|{"names":"عمر، سارة"}');
    expect(sharedPhoneLine({ role: 'sibling', with: [{ name: 'أحمد', student_code: 'STU-1001' }] }, t))
      .toBe('student_profile_ui.shared_phone_sibling|{"name":"أحمد"}');
    expect(sharedPhoneLine(null, t)).toBeNull();
    expect(sharedPhoneLine(undefined, t)).toBeNull();
    expect(sharedPhoneLine({ role: 'holder', with: [] }, t)).toBeNull();
    expect(sharedPhoneLine({ role: 'holder', with: [{ name: ' ' }] }, t)).toBeNull();
  });
});
