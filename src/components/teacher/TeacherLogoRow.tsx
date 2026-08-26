import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { getTeacherLogo, uploadTeacherLogo, deleteTeacherLogo } from '@/api/teacherLogo';

/**
 * Teacher settings row: upload / change / remove the teacher's brand logo. The logo is
 * shown to parents in the parent app's "teachers" tab. Teacher-only (an assistant has
 * no Teacher record, so the backend refuses) — render only for teachers.
 */
export function TeacherLogoRow() {
  const { t } = useTranslation();
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getTeacherLogo()
      .then((u) => { if (active) setLogo(u); })
      .catch(() => { /* keep placeholder */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function pickAndUpload() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('teacher.logo_perm_needed')); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      setBusy(true);
      const url = await uploadTeacherLogo(res.assets[0].uri);
      setLogo(url);
    } catch {
      Alert.alert(t('common.error'), t('teacher.logo_upload_failed'));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove() {
    Alert.alert(t('teacher.logo_remove'), t('teacher.logo_remove_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('teacher.logo_remove'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try { await deleteTeacherLogo(); setLogo(null); }
          catch { Alert.alert(t('common.error')); }
          finally { setBusy(false); }
        },
      },
    ]);
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {logo ? (
          <Image source={{ uri: logo }} style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: colors.surfaceSunken }} resizeMode="cover" />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="teacher" size={26} color={colors.brand} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('teacher.logo_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{t('teacher.logo_sub')}</Text>
        </View>
        {loading || busy ? <ActivityIndicator color={colors.brand} /> : null}
      </View>
      {!loading ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity onPress={pickAndUpload} disabled={busy} activeOpacity={0.85} style={{ flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{logo ? t('teacher.logo_change') : t('teacher.logo_upload')}</Text>
          </TouchableOpacity>
          {logo ? (
            <TouchableOpacity onPress={confirmRemove} disabled={busy} activeOpacity={0.85} style={{ minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.dangerText }}>{t('teacher.logo_remove')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
