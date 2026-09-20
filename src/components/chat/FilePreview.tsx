import { useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

/**
 * Which documents this DEVICE can show inside the app.
 *
 * iOS's WKWebView renders PDF, images, plain text and the Office formats natively. Android's
 * WebView renders images and text but has no PDF or Office renderer — there is no way to
 * preview those in-app without a native library, which cannot ship over the air. So on
 * Android a PDF still goes to "open in another app"; the honest limit is drawn here, once,
 * rather than shown as a blank white pane.
 */
export function canPreviewInApp(mime: string | null | undefined): boolean {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/') || m.startsWith('text/')) return true;
  if (Platform.OS !== 'ios') return false;
  return m === 'application/pdf'
    || m === 'application/msword'
    || m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || m === 'application/vnd.ms-excel'
    || m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || m === 'application/vnd.ms-powerpoint'
    || m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

/**
 * A document opened where the conversation is, not in another app.
 *
 * The private URL needs the bearer token; WebView carries it on the initial request, which
 * is the one that fetches the file. `react-native-webview` is already in the shipped binary
 * (RichTextEditor uses it), so this is safe to deliver over the air.
 */
export function FilePreview({ visible, url, headers, name, onClose, onOpenExternally }: {
  visible: boolean;
  url: string;
  headers: Record<string, string>;
  name: string | null;
  onClose: () => void;
  onOpenExternally: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: insets.top + 4, paddingBottom: 8, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('chat.close')} hitSlop={10}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}>
            {name ?? t('chat.file')}
          </Text>
          <TouchableOpacity onPress={onOpenExternally} accessibilityRole="button" accessibilityLabel={t('chat.open_externally')} hitSlop={10}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.brandTint }}>
            <Icon name="download" size={17} color={colors.brand} outline />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.brand }}>{t('chat.share')}</Text>
          </TouchableOpacity>
        </View>

        {failed ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
            <Icon name="quiz" size={40} color={colors.textTertiary} outline />
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              {t('chat.preview_unavailable')}
            </Text>
            <TouchableOpacity onPress={onOpenExternally} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: spacing.xl }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('chat.open_externally')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ uri: url, headers }}
            style={{ flex: 1, backgroundColor: colors.background }}
            originWhitelist={['*']}
            startInLoadingState
            renderLoading={() => (
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            )}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
          />
        )}
      </View>
    </Modal>
  );
}
