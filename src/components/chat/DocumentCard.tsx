import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { chat } from '@/theme/chat';
import { formatNumber } from '@/utils/format';
import type { ChatAttachment, ChatAttachmentMeta } from '@/api/chat';

/**
 * A document in the room, the way WhatsApp draws one (founder 2026-10-12: «media doesn't
 * display part of it like WhatsApp for PDF and Excel»): a glimpse of the file on top — the
 * first page of a PDF as a picture, the first lines of a Word or PowerPoint file, the first
 * cells of a sheet — then the type badge, the name and «3 صفحات · PDF · 240 ك.ب».
 *
 * The glimpse comes from the server (rendered once, at upload); a file still in the outbox
 * has none yet and shows the badge row alone.
 */
export function DocumentCard({ attachment, headers, mine, hint, onPress, onLongPress }: {
  attachment: ChatAttachment;
  headers: Record<string, string>;
  mine: boolean;
  /** «فتح الملف» / «فتح في تطبيق آخر». */
  hint: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { t } = useTranslation();
  const type = docType(attachment.name, attachment.mime);
  const meta = attachment.meta ?? null;
  const preview = meta?.preview ?? null;
  const facts = [docCountLabel(meta), type.label, fileSizeLabel(attachment.size)].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${attachment.name ?? t('chat.file')} — ${facts}`}
      accessibilityHint={hint}
      style={{
        width: 252, borderRadius: radius.md, overflow: 'hidden',
        backgroundColor: mine ? 'rgba(255,255,255,0.14)' : colors.surfaceSunken,
        borderWidth: mine ? 0 : 1, borderColor: colors.borderLight,
      }}
    >
      {attachment.thumb_url ? (
        <Image
          source={{ uri: attachment.thumb_url, headers }}
          style={{ width: '100%', height: 150, backgroundColor: '#FFFFFF' }}
          contentFit="cover"
          contentPosition="top"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : preview?.kind === 'sheet' ? (
        <SheetGlimpse rows={preview.rows} />
      ) : preview?.kind === 'text' ? (
        <TextGlimpse lines={preview.lines} />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm }}>
        <View style={{ width: 36, height: 40, borderRadius: 6, backgroundColor: type.color, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: type.label.length > 3 ? 8.5 : 10, color: '#FFFFFF', letterSpacing: 0.3 }} numberOfLines={1}>{type.label}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: mine ? '#fff' : colors.textPrimary, textAlign: 'right' }}>
            {attachment.name ?? t('chat.file')}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11.5, color: mine ? chat.metaOnMine : colors.textTertiary, textAlign: 'right', marginTop: 1 }}>
            {facts ? `${facts} · ${hint}` : hint}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** The first lines of a document, on a sheet of paper that fades out at the bottom. */
function TextGlimpse({ lines }: { lines: string[] }) {
  return (
    <View style={{ height: 112, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingTop: 10, overflow: 'hidden' }}>
      {lines.map((l, i) => (
        <Text key={i} numberOfLines={i === 0 ? 1 : 2} style={{ fontFamily: i === 0 ? fonts.bold : fonts.regular, fontSize: i === 0 ? 12.5 : 11, lineHeight: i === 0 ? 18 : 16, color: i === 0 ? '#1F2328' : '#4A4F57', textAlign: 'right', marginBottom: 3 }}>
          {l}
        </Text>
      ))}
      <LinearGradient colors={['rgba(255,255,255,0)', '#FFFFFF']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 34 }} />
    </View>
  );
}

/** The first rows of a sheet as a small grid — the header row bold, like the sheet itself. */
function SheetGlimpse({ rows }: { rows: string[][] }) {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return (
    <View style={{ backgroundColor: '#FFFFFF', paddingVertical: 4, paddingHorizontal: 4 }}>
      {rows.slice(0, 5).map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', borderBottomWidth: r === rows.length - 1 ? 0 : 0.5, borderBottomColor: '#D9DCE1', backgroundColor: r === 0 ? '#EEF6F0' : 'transparent' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Text
              key={c}
              numberOfLines={1}
              style={{
                flex: 1, paddingHorizontal: 5, paddingVertical: 4,
                fontFamily: r === 0 ? fonts.bold : fonts.regular, fontSize: 10.5,
                color: r === 0 ? '#1E5E36' : '#30343A', textAlign: 'right',
                borderStartWidth: c === 0 ? 0 : 0.5, borderStartColor: '#D9DCE1',
              }}
            >
              {row[c] ?? ''}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Pure helpers (tested) ────────────────────────────────────────────────────────────────

/** The type badge: the extension a person recognises, in the colour that format is known by. */
export function docType(name: string | null | undefined, mime: string | null | undefined): { label: string; color: string } {
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? '';
  const m = mime ?? '';
  if (ext === 'pdf' || m === 'application/pdf') return { label: 'PDF', color: '#D93025' };
  if (['doc', 'docx'].includes(ext) || m.includes('word')) return { label: ext === 'doc' ? 'DOC' : 'DOCX', color: '#2B579A' };
  if (['xls', 'xlsx'].includes(ext) || m.includes('spreadsheet') || m.includes('excel')) return { label: ext === 'xls' ? 'XLS' : 'XLSX', color: '#217346' };
  if (ext === 'csv' || m === 'text/csv') return { label: 'CSV', color: '#217346' };
  if (['ppt', 'pptx'].includes(ext) || m.includes('presentation') || m.includes('powerpoint')) return { label: ext === 'ppt' ? 'PPT' : 'PPTX', color: '#C43E1C' };
  if (ext === 'txt' || m === 'text/plain') return { label: 'TXT', color: '#5F6368' };
  return { label: (ext && ext.length <= 4 ? ext : 'FILE').toUpperCase(), color: '#5F6368' };
}

/** «240 ك.ب» / «1.4 م.ب». */
export function fileSizeLabel(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} ك.ب`;
  return `${formatNumber(Math.round((bytes / (1024 * 1024)) * 10) / 10)} م.ب`;
}

const FORMS = {
  pages: ['صفحة واحدة', 'صفحتان', 'صفحات', 'صفحة'],
  sheets: ['ورقة واحدة', 'ورقتان', 'أوراق', 'ورقة'],
  slides: ['شريحة واحدة', 'شريحتان', 'شرائح', 'شريحة'],
} as const;

/** Arabic counting: one / two (dual) / 3–10 (plural) / 11+ (singular). */
export function docCountLabel(meta: ChatAttachmentMeta | null | undefined): string {
  if (!meta) return '';
  const key = meta.pages ? 'pages' : meta.slides ? 'slides' : meta.sheets && meta.sheets > 1 ? 'sheets' : null;
  if (!key) return '';
  const n = meta[key] as number;
  const [one, two, few, many] = FORMS[key];
  if (n === 1) return one;
  if (n === 2) return two;
  return `${formatNumber(n)} ${n <= 10 ? few : many}`;
}
