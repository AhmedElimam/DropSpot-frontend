import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Choice, Sheet, threadInputStyle } from '@/components/threads/ThreadSheets';
import { useCreateCommunityPost, useUploadCommunityMedia } from '@/hooks/useCommunity';
import { getFriendlyErrorMessage } from '@/utils/errors';
import type { CommunityAudience, CommunityKind, CommunityLimits, CommunityPost, CommunityRole } from '@/api/community';

type Picked = { uri: string; name: string; mime: string; width?: number; height?: number };

/**
 * Write a post: words, up to `images_per_post` pictures, and — for the teacher — the choice
 * between a post and an announcement (pinned, pushed to the whole space). Pictures are uploaded
 * first, then claimed by the post: a failed upload never leaves a half post. The server's
 * answer says what happened to the post (published / held / rejected) and the sheet tells it.
 */
export function ComposePostSheet({ visible, teacherId, audience, role, limits, onClose, onCreated }: {
  visible: boolean;
  teacherId: number;
  audience: CommunityAudience;
  role: CommunityRole;
  limits: CommunityLimits | undefined;
  onClose: () => void;
  onCreated: (post: CommunityPost) => void;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<CommunityKind>('post');
  const [pictures, setPictures] = useState<Picked[]>([]);
  const [uploading, setUploading] = useState(false);
  const create = useCreateCommunityPost(teacherId, audience);
  const upload = useUploadCommunityMedia(teacherId, audience);
  const max = limits?.images_per_post ?? 4;
  const bodyMax = limits?.body_max_chars ?? 4000;
  const busy = create.isPending || uploading;
  const teacher = role === 'teacher';

  useEffect(() => { if (visible) { setBody(''); setKind('post'); setPictures([]); } }, [visible]);

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false, exif: false, allowsMultipleSelection: true, selectionLimit: max - pictures.length });
      if (res.canceled || !res.assets?.length) return;
      const maxKb = limits?.image_max_kb ?? 4096;
      const next = res.assets.slice(0, max - pictures.length).filter((a) => {
        if (a.fileSize && a.fileSize > maxKb * 1024) { Alert.alert('', t('community_space.photo_too_big', { mb: Math.round((maxKb / 1024) * 10) / 10 })); return false; }
        return true;
      }).map((a) => ({ uri: a.uri, name: (a.fileName ?? 'photo.jpg').replace(/[^\w.\-]+/g, '_'), mime: a.mimeType ?? 'image/jpeg', width: a.width, height: a.height }));
      setPictures((p) => [...p, ...next].slice(0, max));
    } catch (e) {
      Alert.alert('', getFriendlyErrorMessage(e));
    }
  };

  const publish = async () => {
    try {
      setUploading(true);
      const ids: number[] = [];
      for (const p of pictures) ids.push((await upload.mutateAsync(p)).id);
      setUploading(false);
      const post = await create.mutateAsync({ body: body.trim(), kind: teacher ? kind : 'post', media: ids });
      onCreated(post);
    } catch (e) {
      setUploading(false);
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    }
  };

  const canPublish = !busy && (body.trim().length > 0 || pictures.length > 0) && body.length <= bodyMax;

  return (
    <Sheet visible={visible} title={t('community_space.compose_title')} subtitle={t(audience === 'parents' ? 'community_space.compose_sub_parents' : 'community_space.compose_sub_students')} icon="people" onClose={onClose} busy={busy}>
      {teacher ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Choice label={t('community_space.kind_post')} active={kind === 'post'} onPress={() => setKind('post')} />
          <Choice label={t('community_space.kind_announcement')} sub={t('community_space.kind_announcement_sub')} active={kind === 'announcement'} onPress={() => setKind('announcement')} />
        </View>
      ) : null}
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={t('community_space.compose_placeholder')}
        placeholderTextColor={colors.textTertiary}
        maxLength={bodyMax}
        multiline
        autoFocus
        style={[threadInputStyle(), { minHeight: 120, textAlignVertical: 'top' }]}
      />
      {pictures.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {pictures.map((p, i) => (
            <View key={p.uri} style={{ width: 72, height: 72 }}>
              <Image source={{ uri: p.uri }} style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }} contentFit="cover" />
              <TouchableOpacity onPress={() => setPictures((x) => x.filter((_, j) => j !== i))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('community_space.remove_photo')}
                style={{ position: 'absolute', top: -6, end: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={12} color={colors.surface} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <TouchableOpacity onPress={pick} disabled={busy || pictures.length >= max} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('community_space.add_photo')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.surfaceSunken, opacity: pictures.length >= max ? 0.5 : 1 }}>
          <Icon name="image" size={17} color={colors.brand} outline />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('community_space.add_photo')} {pictures.length ? `(${pictures.length}/${max})` : ''}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: body.length > bodyMax * 0.9 ? colors.danger : colors.textTertiary }}>{body.length}/{bodyMax}</Text>
      </View>
      {!teacher && role !== 'assistant' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="shield" size={14} color={colors.textTertiary} outline />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary }}>{t('community_space.screen_note')}</Text>
        </View>
      ) : null}
      <Button title={uploading ? t('community_space.uploading') : t('community_space.publish')} onPress={publish} disabled={!canPublish} loading={busy} />
    </Sheet>
  );
}
