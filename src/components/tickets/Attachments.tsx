import { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator, Platform } from 'react-native';
import { AppModal as Modal } from '@/ui/AppModal';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { openRemotePdf } from '@/utils/openPdf';
import { formatNumber } from '@/utils/format';
import { TICKET_MAX_FILES, TICKET_MAX_MB, type PendingFile, type TicketAttachment } from '@/api/tickets';

/**
 * Files on a ticket (founder 2026-10-11): what a message carries, shown as photo tiles and
 * file chips; what the person is about to send, shown above the composer; and the two
 * pickers. A photo is re-encoded to JPEG (≤ 1600 px, 0.8) before upload — the iPhone gallery
 * hands over HEIC, and 8 MB originals are nobody's idea of a chat.
 */
function kb(size?: number): string {
  if (!size) return '';
  return size >= 1024 * 1024 ? `${formatNumber(Math.round(size / (1024 * 1024) * 10) / 10)} MB` : `${formatNumber(Math.max(1, Math.round(size / 1024)))} KB`;
}

export function MessageAttachments({ items, onDark }: { items?: TicketAttachment[]; onDark?: boolean }) {
  const { t } = useTranslation();
  const [viewing, setViewing] = useState<TicketAttachment | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  if (!items?.length) return null;
  const open = async (a: TicketAttachment) => {
    if (a.is_image) { setViewing(a); return; }
    setBusyId(a.id);
    try { await openRemotePdf(a.url, a.name); } finally { setBusyId(null); }
  };
  return (
    <View style={{ marginTop: 6, gap: 6 }}>
      {items.map((a) => a.is_image ? (
        <TouchableOpacity key={a.id} onPress={() => open(a)} activeOpacity={0.9} accessibilityRole="imagebutton" accessibilityLabel={a.name}>
          <Image source={{ uri: a.url }} style={{ width: 220, height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={120} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity key={a.id} onPress={() => open(a)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('tickets.open_file', { name: a.name })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: onDark ? 'rgba(255,255,255,0.16)' : colors.surfaceSunken, borderWidth: 1, borderColor: onDark ? 'rgba(255,255,255,0.25)' : colors.border, maxWidth: 260 }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: a.kind === 'student_report' ? colors.accentWarmTint : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            {busyId === a.id ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name={a.kind === 'student_report' ? 'reports' : 'download'} size={18} color={a.kind === 'student_report' ? colors.accentWarm : colors.brand} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: onDark ? '#fff' : colors.textPrimary }} numberOfLines={1}>{a.name}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: onDark ? 'rgba(255,255,255,0.75)' : colors.textTertiary }}>{a.kind === 'student_report' ? t('tickets.student_report') : 'PDF'}{a.size ? ` · ${kb(a.size)}` : ''}</Text>
          </View>
        </TouchableOpacity>
      ))}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable onPress={() => setViewing(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          {viewing ? <Image source={{ uri: viewing.url }} style={{ width: '100%', height: '80%' }} contentFit="contain" /> : null}
          <View style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 24, end: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** The files about to go, above the composer: a tile or a chip each, with a remove. */
export function PendingFiles({ files, onRemove }: { files: PendingFile[]; onRemove: (uri: string) => void }) {
  const { t } = useTranslation();
  if (!files.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.surface }}>
      {files.map((f) => (
        <View key={f.uri} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSunken, padding: 4, paddingEnd: 8 }}>
          {f.isImage ? <Image source={{ uri: f.uri }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="cover" /> : (
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}><Icon name="download" size={18} color={colors.brand} /></View>
          )}
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary, maxWidth: 120 }} numberOfLines={1}>{f.name}</Text>
          <TouchableOpacity onPress={() => onRemove(f.uri)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('form_ui.remove')}>
            <Icon name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

/** The paper-clip: photo from the library, or a PDF / image from the files. */
export function AttachButton({ files, onAdd, disabled }: { files: PendingFile[]; onAdd: (f: PendingFile) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const full = files.length >= TICKET_MAX_FILES;

  const tooBig = (size?: number) => !!size && size > TICKET_MAX_MB * 1024 * 1024;

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('tickets.attach_photo'), t('tickets.photo_permission')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: false });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    try {
      const a = res.assets[0];
      // JPEG, bounded: HEIC is not a web format and an original is far bigger than a chat needs.
      const out = await ImageManipulator.manipulateAsync(a.uri, a.width && a.width > 1600 ? [{ resize: { width: 1600 } }] : [], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      onAdd({ uri: out.uri, name: (a.fileName?.replace(/\.[a-z0-9]+$/i, '') || 'photo') + '.jpg', mime: 'image/jpeg', isImage: true });
    } catch {
      Alert.alert(t('common.error'), t('tickets.attach_failed'));
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (tooBig(a.size)) { Alert.alert(t('tickets.attach_file'), t('tickets.file_too_big', { mb: TICKET_MAX_MB })); return; }
    const mime = a.mimeType || (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    onAdd({ uri: a.uri, name: a.name, mime, size: a.size, isImage: mime.startsWith('image/') });
  };

  const choose = () => {
    if (full) { Alert.alert(t('tickets.attach'), t('tickets.max_files', { count: TICKET_MAX_FILES })); return; }
    Alert.alert(t('tickets.attach'), t('tickets.attach_hint', { mb: TICKET_MAX_MB }), [
      { text: t('tickets.attach_photo'), onPress: () => { void pickPhoto(); } },
      { text: t('tickets.attach_file'), onPress: () => { void pickFile(); } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <TouchableOpacity onPress={choose} disabled={disabled || busy} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('tickets.attach')}
      style={{ width: 52, height: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
      {busy ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="image" size={22} color={files.length ? colors.brand : colors.textSecondary} />}
      {files.length ? <View style={{ position: 'absolute', top: -5, end: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{formatNumber(files.length)}</Text></View> : null}
    </TouchableOpacity>
  );
}
