import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Alert } from '@/ui/dialog';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { SheetModal } from '@/components/ui/SheetModal';
import { useAuthStore } from '@/stores/authStore';
import { useCreateCommunityPost, useEditCommunityPost, useUploadCommunityMedia } from '@/hooks/useCommunity';
import { getFriendlyErrorMessage } from '@/utils/errors';
import type { CommunityAudience, CommunityBackground, CommunityLimits, CommunityPost, CreatedPost } from '@/api/community';
import { LinearGradient } from 'expo-linear-gradient';
import { BACKGROUNDS, BACKGROUND_KEYS, fitsBackground } from './backgrounds';
import { Surface } from '@/ui/surfaces';
import { explainWriteError } from './guard';

/** The send arrow points the way Arabic reads, like chat's (founder 2026-10-28). */
const SEND_FLIP = { transform: [{ scaleX: -1 }] } as const;

type Picked = { uri: string; name: string; mime: string; width?: number; height?: number };

/**
 * «إنشاء منشور», the way a social app opens it: your face and name with where it goes, a big
 * «بم تفكر؟», the pictures you picked as a strip, and the photo and camera chips along the
 * bottom. Pictures are uploaded first, then claimed by the post: a failed upload never leaves
 * a half post. The server's answer says what happened (published / held / rejected).
 */
export function ComposePostSheet({ visible, audience, editing = null, limits, onClose, onCreated }: {
  visible: boolean;
  audience: CommunityAudience;
  /** Your own post to edit (its words and colour; its pictures stay as they are). */
  editing?: CommunityPost | null;
  limits: CommunityLimits | undefined;
  onClose: () => void;
  onCreated: (post: CreatedPost) => void;
}) {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const meRole = useAuthStore((s) => s.role);
  const [body, setBody] = useState('');
  const [pictures, setPictures] = useState<Picked[]>([]);
  // «Text on a colour» (founder 2026-10-28: «editing tools like Facebook»): short text only.
  const [bg, setBg] = useState<CommunityBackground | null>(null);
  const edit = useEditCommunityPost();
  const [uploading, setUploading] = useState(false);
  const create = useCreateCommunityPost(audience);
  const upload = useUploadCommunityMedia(audience);
  // Pictures off on the server (the spec §6: none until each is screened first) = no photo buttons.
  const mediaOn = limits?.media !== false;
  const max = mediaOn ? limits?.images_per_post ?? 4 : 0;
  const bodyMax = limits?.body_max_chars ?? 4000;
  const busy = create.isPending || edit.isPending || uploading;
  const fits = fitsBackground(body, pictures.length + (editing?.media.length ?? 0));
  // The colours the server still offers (limits.backgrounds), drawn from the app's presets.
  const offered = BACKGROUND_KEYS.filter((k) => !limits?.backgrounds || limits.backgrounds.includes(k));
  const onColour = fits && bg && offered.includes(bg) ? BACKGROUNDS[bg] : null;
  const mySeed = meRole === 'student' && me?.student_id ? avatarSeed.student(me.student_id) : avatarSeed.user(me?.id);
  const firstName = (me?.name ?? '').split(' ')[0];

  useEffect(() => {
    if (!visible) return;
    setBody(editing?.body ?? '');
    setBg(editing?.background ?? null);
    setPictures([]);
  }, [visible, editing]);

  const pick = async (camera: boolean) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false, exif: false, allowsMultipleSelection: !camera, selectionLimit: max - pictures.length };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
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
      const background = fits ? bg : null;
      const post = editing
        ? await edit.mutateAsync({ postId: editing.id, body: body.trim(), background })
        : await create.mutateAsync({ body: body.trim(), media: ids, background });
      onCreated(post);
    } catch (e) {
      // The words stay in the box: a nudge («write it in Arabic», «no numbers here») is a rewrite.
      setUploading(false);
      explainWriteError(e, t);
    }
  };

  const canPublish = !busy && (body.trim().length > 0 || pictures.length > 0) && body.length <= bodyMax;
  const where = t(audience === 'parents' ? 'community_space.title_parents' : 'community_space.title_students');

  return (
    <SheetModal visible={visible} onClose={() => { if (!busy) onClose(); }} avoidKeyboard>
      {/* Top row: close · title · publish */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.cancel')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t(editing ? 'community_space.edit_title' : 'community_space.compose_title')}</Text>
        {/* Just the icon (founder 2026-10-28: the word spilled out of the button). */}
        <TouchableOpacity onPress={publish} disabled={!canPublish} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ disabled: !canPublish, busy }}
          accessibilityLabel={uploading ? t('community_space.uploading') : t('community_space.publish')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: canPublish || busy ? colors.brand : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="send" size={20} color={canPublish ? colors.onPrimary : colors.textTertiary} style={SEND_FLIP} />}
        </TouchableOpacity>
      </View>

      {/* Me, and where this goes */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <GeneratedAvatar seed={mySeed} size={44} label={me?.name} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{me?.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: colors.surfaceSunken }}>
              <Icon name="people" size={12} color={colors.textSecondary} outline />
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }} numberOfLines={1}>{where}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* The words — on the chosen colour, as they will show, while the text is short */}
      {onColour ? (
        <LinearGradient colors={onColour.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 210, marginTop: spacing.md, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <TextInput
            value={body}
            onChangeText={setBody}
            maxLength={bodyMax}
            multiline
            autoFocus
            style={{ alignSelf: 'stretch', fontFamily: fonts.bold, fontSize: body.length < 60 ? 24 : 20, lineHeight: body.length < 60 ? 38 : 32, color: onColour.text, textAlign: 'center' }}
          />
        </LinearGradient>
      ) : (
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t('community_space.whats_on_your_mind', { name: firstName })}
          placeholderTextColor={colors.textTertiary}
          maxLength={bodyMax}
          multiline
          autoFocus
          style={{ minHeight: 140, maxHeight: 280, marginTop: spacing.md, fontFamily: fonts.regular, fontSize: body.length < 60 && !pictures.length ? 22 : 17, lineHeight: body.length < 60 && !pictures.length ? 34 : 26, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top' }}
        />
      )}

      {/* The colours: plain «Aa», then each preset — offered while the text is short and has no picture */}
      {offered.length && (fits || (!body.trim() && !pictures.length && !editing?.media.length)) ? (
        <Surface id="community.compose.backgrounds">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity onPress={() => setBg(null)} accessibilityRole="radio" accessibilityState={{ checked: bg === null }} accessibilityLabel={t('community_space.bg_plain')}
            style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: bg === null ? 2.5 : 1, borderColor: bg === null ? colors.brand : colors.border }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Aa</Text>
          </TouchableOpacity>
          {offered.map((k) => (
            <TouchableOpacity key={k} onPress={() => setBg(k)} accessibilityRole="radio" accessibilityState={{ checked: bg === k }} accessibilityLabel={t('community_space.bg_colour')}
              style={{ width: 32, height: 32, borderRadius: 10, padding: bg === k ? 2 : 0, borderWidth: bg === k ? 2.5 : 0, borderColor: colors.brand }}>
              <LinearGradient colors={BACKGROUNDS[k].colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 7 }} />
            </TouchableOpacity>
          ))}
        </View>
        </Surface>
      ) : null}

      {pictures.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
          {pictures.map((p, i) => (
            <View key={p.uri} style={{ width: 84, height: 84 }}>
              <Image source={{ uri: p.uri }} style={{ width: 84, height: 84, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }} contentFit="cover" />
              <TouchableOpacity onPress={() => setPictures((x) => x.filter((_, j) => j !== i))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('community_space.remove_photo')}
                style={{ position: 'absolute', top: -6, end: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
                <Icon name="close" size={12} color={colors.surface} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {/* The bottom strip: photo, camera, the counter */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
        {editing || !mediaOn ? null : <Surface id="community.compose.photos"><View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TouchableOpacity onPress={() => pick(false)} disabled={busy || pictures.length >= max} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('community_space.add_photo')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.surfaceSunken, opacity: pictures.length >= max ? 0.5 : 1 }}>
          <Icon name="image" size={18} color={colors.success} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{t('community_space.add_photo')}{pictures.length ? ` ${pictures.length}/${max}` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => pick(true)} disabled={busy || pictures.length >= max} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('chat.attach_camera', { defaultValue: 'كاميرا' })}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', opacity: pictures.length >= max ? 0.5 : 1 }}>
          <Icon name="camera" size={18} color={colors.brand} />
        </TouchableOpacity>
        </View></Surface>}
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: body.length > bodyMax * 0.9 ? colors.danger : colors.textTertiary }}>{body.length}/{bodyMax}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
        <Icon name="shield" size={13} color={colors.textTertiary} outline />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 17, color: colors.textTertiary }}>{t('community_space.screen_note')}</Text>
      </View>
    </SheetModal>
  );
}
