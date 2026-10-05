import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { ComplaintPill } from '@/components/student/ComplaintSheet';
import { useFileGradeComplaint } from '@/hooks/useComplaints';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatNumber, formatShortDate } from '@/utils/format';
import { parseMarkInput, cleanMarkInput } from '@/utils/markInput';
import type { GradeComplaintState, GradeSource } from '@/api/complaints';
import type { GradeRecord } from '@/types/grade-record';
import type { ExamResult } from '@/api/reports';
import { AnnotatedPhoto } from './AnnotatedPhoto';
import { PhotoAnnotator } from './PhotoAnnotator';
import type { PhotoAnnotations } from './annotationGeometry';

/** The grade being disputed: a session mark (sheet or single-session exam) or a merged exam. */
export interface GradeComplaintTarget {
  source: GradeSource;
  /** attendance_record_id (session) or revision_attendance_id (revision). */
  recordId: number;
  title: string;
  date: string | null;
  mark: number;
  max: number | null;
}

/** A «الدرجات» row as a complaint target — null when it has no mark to dispute. */
export function gradeTargetFromRecord(g: GradeRecord, fallbackTitle: string): GradeComplaintTarget | null {
  if (g.score === null || g.score === undefined || !g.id) return null;
  return { source: 'session', recordId: g.id, title: g.course_name ?? fallbackTitle, date: g.date, mark: Number(g.score), max: g.max_score ?? null };
}

/** An exam result as a complaint target — null when it has no mark or no record id. */
export function gradeTargetFromExam(e: ExamResult, fallbackTitle: string): GradeComplaintTarget | null {
  const id = e.source === 'revision' ? e.revision_attendance_id : e.attendance_record_id;
  if (e.mark === null || e.mark === undefined || !id) return null;
  return { source: e.source === 'revision' ? 'revision' : 'session', recordId: Number(id), title: e.title ?? fallbackTitle, date: e.date ?? null, mark: Number(e.mark), max: e.max ?? null };
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : formatNumber(n, { maximumFractionDigits: 2 }));

/** The server's own Arabic sentence for a refused filing (COMPLAINT_EXISTS, MARK_INVALID, a photo rule…). */
function filingError(e: unknown): string {
  if (isAxiosError(e)) {
    const d: any = e.response?.data;
    const field = d?.errors && typeof d.errors === 'object' ? (Object.values(d.errors).flat()[0] as unknown) : null;
    const msg = typeof field === 'string' ? field : d?.message;
    if (typeof msg === 'string' && msg.length > 0 && msg.length < 300 && /[؀-ۿ]/.test(msg)) return msg;
  }
  return getFriendlyErrorMessage(e);
}

interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
  name?: string | null;
  mimeType?: string | null;
}

/**
 * «اعتراض على الدرجة» (founder 2026-10-05) — the student's sheet, or the parent's for a
 * child. Shows the recorded mark, takes the mark they say is right (optional), a line, and
 * a photo of the paper — taken or picked, cropped (Android's free crop; iOS's editor is
 * square-only, which would cut an A4 page), then drawn on in «علِّم على الخطأ».
 * At least one of mark / note / photo goes with it (the server says the same).
 */
export function GradeComplaintSheet({ visible, onClose, target, forStudentId }: {
  visible: boolean;
  onClose: () => void;
  target: GradeComplaintTarget | null;
  /** Parent mode: the child (students.id) this is filed for. Absent = the student files for themself. */
  forStudentId?: number | null;
}) {
  const { t } = useTranslation();
  const asParent = !!forStudentId;
  const file = useFileGradeComplaint();
  const [claimed, setClaimed] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [annotations, setAnnotations] = useState<PhotoAnnotations | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (visible) {
      setSent(false); setClaimed(''); setNote(''); setPhoto(null); setAnnotations(null); setAnnotating(false); setLocalError(null);
      file.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, target]);

  if (!target) return null;

  const claimedValue = parseMarkInput(claimed);
  const claimedError = !claimed.trim()
    ? null
    : claimedValue === null
      ? t('complaints.grade.claimed_invalid')
      : target.max !== null && claimedValue > target.max
        ? t('complaints.grade.claimed_over_max', { max: fmt(target.max) })
        : Math.abs(claimedValue - target.mark) < 0.001
          ? t('complaints.grade.claimed_same')
          : null;
  const hasSomething = claimedValue !== null || !!note.trim() || !!photo;
  const canSend = !file.isPending && hasSomething && !claimedError;

  const pick = async (from: 'camera' | 'library') => {
    setLocalError(null);
    if (from === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setLocalError(t('complaints.grade.camera_permission')); return; }
    }
    // Android crops freely; iOS's built-in editor is a fixed square, so the whole page is kept there.
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: Platform.OS === 'android' };
    let res: ImagePicker.ImagePickerResult;
    try {
      res = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    } catch {
      setLocalError(t(from === 'camera' ? 'complaints.grade.camera_permission' : 'complaints.grade.gallery_permission'));
      return;
    }
    const a = res.canceled ? null : res.assets?.[0];
    if (!a) return;
    if (a.fileSize && a.fileSize > 10 * 1024 * 1024) { setLocalError(t('complaints.grade.photo_too_big')); return; }
    setPhoto({ uri: a.uri, width: a.width, height: a.height, name: a.fileName, mimeType: a.mimeType });
    setAnnotations(null);
    // iOS: let the picker finish dismissing before the editor is presented over the sheet.
    setTimeout(() => setAnnotating(true), Platform.OS === 'ios' ? 450 : 50);
  };

  const send = () => {
    if (!canSend) return;
    setLocalError(null);
    file.mutate(
      {
        attendance_record_id: target.source === 'session' ? target.recordId : undefined,
        revision_attendance_id: target.source === 'revision' ? target.recordId : undefined,
        claimed_mark: claimedValue ?? undefined,
        note: note.trim() || undefined,
        photo: photo ? { uri: photo.uri, name: photo.name, mimeType: photo.mimeType } : null,
        annotations: photo ? annotations : null,
        student_id: forStudentId ?? undefined,
      },
      { onSuccess: () => setSent(true) },
    );
  };

  const subtitle = `${target.title}${target.date ? ` · ${formatShortDate(target.date)}` : ''}`;
  const imageSize = photo && photo.width && photo.height ? { width: photo.width, height: photo.height } : null;

  return (
    <SheetModal visible={visible} onClose={onClose} avoidKeyboard style={{ backgroundColor: colors.surface }}>
      {sent ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="success" size={32} color={colors.success} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('complaints.sent_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>{t('complaints.sent_body')}</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={{ alignSelf: 'stretch', minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="grades" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('complaints.grade.file')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text>
            </View>
          </View>

          {/* What is recorded now, and what they say is right. */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('complaints.grade.recorded')}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, marginTop: 2 }}>
                {fmt(target.mark)}{target.max !== null ? <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textTertiary }}>{` / ${fmt(target.max)}`}</Text> : null}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginBottom: 4 }} numberOfLines={1}>
                {t(asParent ? 'complaints.grade.claimed_label_child' : 'complaints.grade.claimed_label')}
              </Text>
              <TextInput
                value={claimed}
                onChangeText={(v) => setClaimed(cleanMarkInput(v).slice(0, 7))}
                keyboardType="decimal-pad"
                placeholder={t('complaints.grade.claimed_placeholder')}
                placeholderTextColor={colors.textTertiary}
                style={{ height: 50, backgroundColor: colors.surfaceSunken, borderWidth: 1.5, borderColor: claimedError ? colors.danger : colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' }}
              />
            </View>
          </View>
          {claimedError ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.dangerText, marginTop: -spacing.sm }}>{claimedError}</Text> : null}

          {/* The paper. */}
          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('complaints.grade.photo_label')}</Text>
            {photo ? (
              <>
                <AnnotatedPhoto uri={photo.uri} imageSize={imageSize} annotations={annotations} height={200} />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity onPress={() => setAnnotating(true)} activeOpacity={0.85} accessibilityRole="button"
                    style={{ flex: 1, height: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandTint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon name="brush" size={16} color={colors.brand} outline />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.brand }}>{t('complaints.grade.reannotate')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setPhoto(null); setAnnotations(null); }} activeOpacity={0.85} accessibilityRole="button"
                    style={{ flex: 1, height: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon name="trash" size={16} color={colors.dangerText} outline />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.dangerText }}>{t('complaints.grade.remove_photo')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={{ backgroundColor: colors.infoLight, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <Icon name="info" size={18} color={colors.infoText} outline />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.infoText }}>{t(asParent ? 'complaints.grade.hint_child' : 'complaints.grade.hint')}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {(['camera', 'library'] as const).map((from) => (
                    <TouchableOpacity key={from} onPress={() => pick(from)} activeOpacity={0.85} accessibilityRole="button"
                      style={{ flex: 1, minHeight: 64, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm }}>
                      <Icon name={from === 'camera' ? 'camera' : 'image'} size={22} color={colors.brand} outline />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{t(from === 'camera' ? 'complaints.grade.take_photo' : 'complaints.grade.from_gallery')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>

          <View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('complaints.note_label')}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('complaints.grade.note_placeholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={1000}
              style={{ minHeight: 80, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top' }}
            />
          </View>

          {localError || file.isError ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.dangerText }}>{localError ?? filingError(file.error)}</Text>
          ) : !hasSomething ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }}>{t('complaints.grade.empty_needed')}</Text>
          ) : null}

          <TouchableOpacity onPress={send} disabled={!canSend} activeOpacity={0.85} accessibilityRole="button"
            style={{ minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, opacity: canSend ? 1 : 0.5 }}>
            {file.isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="send" size={18} color={colors.onPrimary} />}
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('complaints.send')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Rendered inside the sheet so it is presented over the sheet's own window. */}
      <PhotoAnnotator
        visible={annotating && !!photo}
        uri={photo?.uri ?? null}
        imageSize={imageSize}
        initial={annotations}
        onCancel={() => setAnnotating(false)}
        onDone={(a) => { setAnnotations(a.strokes.length ? a : null); setAnnotating(false); }}
      />
    </SheetModal>
  );
}

/**
 * Under a grade or exam row: «اعتراض على الدرجة» while nothing was filed, then the same
 * status pill the attendance rows use — with the corrected mark once accepted, and the
 * teacher's reason once refused.
 */
export function GradeComplaintStatus({ complaint, onComplain }: {
  complaint?: GradeComplaintState | null;
  /** Present when this reader may dispute the grade. */
  onComplain?: () => void;
}) {
  const { t } = useTranslation();
  if (complaint) {
    return (
      <View style={{ marginTop: 6, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <ComplaintPill status={complaint.status} />
          {complaint.status === 'approved' && complaint.corrected_mark !== null ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.successText }}>{t('complaints.grade.corrected_to', { mark: fmt(complaint.corrected_mark) })}</Text>
          ) : null}
        </View>
        {complaint.status === 'rejected' && complaint.decision_note ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={3}>«{complaint.decision_note}»</Text>
        ) : null}
      </View>
    );
  }
  if (!onComplain) return null;
  return (
    <TouchableOpacity onPress={onComplain} hitSlop={6} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start' }}>
      <Icon name="note" size={13} color={colors.brand} outline />
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('complaints.grade.file')}</Text>
    </TouchableOpacity>
  );
}
