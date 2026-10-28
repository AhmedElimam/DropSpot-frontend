import { useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Alert } from '@/ui/dialog';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { useAuthStore } from '@/stores/authStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useCommentOnCommunityPost, useUploadCommunityMedia } from '@/hooks/useCommunity';
import type { CommunityAudience, CommunityComment } from '@/api/community';
import { Surface } from '@/ui/surfaces';

/** The send arrow points the way Arabic reads, like chat's (founder 2026-10-28). */
const SEND_FLIP = { transform: [{ scaleX: -1 }] } as const;

/**
 * Write a comment — on the post, or on one picture (`mediaId`) — with words, a picture, or both
 * (founder 2026-10-28: «comment by media like Facebook»). The picture is uploaded first and
 * claimed by the comment, the same way a post claims its pictures.
 */
export function CommentComposer({ postId, audience, mediaId = null, maxChars = 1000, onSent, dark = false }: {
  postId: number;
  audience: CommunityAudience;
  mediaId?: number | null;
  maxChars?: number;
  onSent?: (c: CommunityComment) => void;
  /** Over a photo: the viewer's black ground. */
  dark?: boolean;
}) {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const meRole = useAuthStore((s) => s.role);
  const mySeed = meRole === 'student' && me?.student_id ? avatarSeed.student(me.student_id) : avatarSeed.user(me?.id);
  const [text, setText] = useState('');
  const [pic, setPic] = useState<{ uri: string; name: string; mime: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const comment = useCommentOnCommunityPost(postId);
  const upload = useUploadCommunityMedia(audience);
  const busy = uploading || comment.isPending;
  const ready = (text.trim().length > 0 || !!pic) && !busy;

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false, exif: false });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setPic({ uri: a.uri, name: (a.fileName ?? 'photo.jpg').replace(/[^\w.\-]+/g, '_'), mime: a.mimeType ?? 'image/jpeg' });
    } catch (e) {
      Alert.alert('', getFriendlyErrorMessage(e));
    }
  };

  const send = async () => {
    if (!ready) return;
    try {
      let attachment: number | null = null;
      if (pic) {
        setUploading(true);
        attachment = (await upload.mutateAsync(pic)).id;
        setUploading(false);
      }
      const res = await comment.mutateAsync({ body: text.trim(), media_id: mediaId, attachment_id: attachment });
      setText('');
      setPic(null);
      if (res.comment.status === 'held') Alert.alert(t('community_space.held_title'), res.comment.status_reason === 'awaiting_review' ? t('community_space.held_awaiting') : t('community_space.held_body', { why: res.comment.status_note ?? '' }));
      else if (res.comment.status === 'rejected') Alert.alert(t('community_space.rejected_title'), t('community_space.rejected_body', { why: res.comment.status_note ?? '' }));
      onSent?.(res.comment);
    } catch (e) {
      setUploading(false);
      Alert.alert('', getFriendlyErrorMessage(e));
    }
  };

  const field = dark ? 'rgba(255,255,255,0.12)' : colors.surfaceSunken;
  const ink = dark ? '#FFFFFF' : colors.textPrimary;
  const quiet = dark ? 'rgba(255,255,255,0.55)' : colors.textTertiary;

  return (
    <View style={{ gap: spacing.sm }}>
      {pic ? (
        <View style={{ alignSelf: 'flex-start', marginStart: 42 }}>
          <Image source={{ uri: pic.uri }} style={{ width: 84, height: 84, borderRadius: radius.md, backgroundColor: field }} contentFit="cover" />
          <TouchableOpacity onPress={() => setPic(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('community_space.remove_photo')}
            style={{ position: 'absolute', top: -8, end: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <View style={{ paddingBottom: 3 }}><GeneratedAvatar seed={mySeed} size={34} label={me?.name} /></View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 40, borderRadius: 20, backgroundColor: field, paddingStart: spacing.md, paddingEnd: 4 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('community_space.comment_placeholder')}
            placeholderTextColor={quiet}
            multiline
            maxLength={maxChars}
            style={{ flex: 1, maxHeight: 110, paddingVertical: 9, fontFamily: fonts.regular, fontSize: 14.5, color: ink, textAlign: 'right' }}
          />
          <Surface id="community.comment.photo">
          <TouchableOpacity onPress={pick} disabled={busy} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('community_space.add_photo')}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 3 }}>
            <Icon name="image" size={19} color={dark ? '#FFFFFF' : colors.success} />
          </TouchableOpacity>
          </Surface>
        </View>
        <TouchableOpacity onPress={send} disabled={!ready} accessibilityRole="button" accessibilityLabel={t('community_space.send')}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ready || busy ? colors.brand : field, alignItems: 'center', justifyContent: 'center' }}>
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="send" size={18} color={ready ? colors.onPrimary : quiet} style={SEND_FLIP} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}
