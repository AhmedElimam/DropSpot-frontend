import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { router, type Href } from 'expo-router';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/ui/dialog';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { binaryVersion } from '@/utils/binaryVersion';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { endRemoteSession, remoteErrorSentence, setCourseDelivery, setSessionDelivery, startRemoteSession, type DeliveryChange } from '@/api/remoteSession';
import { canBroadcastFromPhone, offerJoinUrl } from '@/remote/room';
import type { DeliveryScope, SessionDelivery } from '@/remote/delivery';

/** «حصة أونلاين» — the feature switch (super-admin, /app-config). Everything remote hangs off this. */
export const REMOTE_FLAG = 'remote_sessions';

/** True only while the switch is on for this person. Off = no entry point is drawn anywhere. */
export function useRemoteSessionsEnabled(): boolean {
  const { data: flags } = useFeatureFlags();
  return !!flags?.[REMOTE_FLAG];
}

/** The slot the teacher's `join_url` from «start» waits in until the room screen takes it. */
export const teacherRoomKey = (sessionId: string | number) => `teacher:${sessionId}`;

/** The teacher's lists and sheet that show a session's live state and its attendance. */
export function refreshTeacherRemote(qc: QueryClient, sessionId: string | number): void {
  qc.invalidateQueries({ queryKey: ['teacher-sessions-today'] });
  qc.invalidateQueries({ queryKey: ['teacher-session-detail', String(sessionId)] });
  qc.invalidateQueries({ queryKey: ['teacher-session-history'] });
}

/** A family's session cards and attendance (student home, check-in tab, the parent's child page). */
export function refreshFamilyRemote(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['sessions'] });
  qc.invalidateQueries({ queryKey: ['attendance'] });
}

/**
 * «حضوري / أونلاين» changed: the session queries the remote hooks refresh (today's cards, the
 * sessions list, the session pages — every one of them, since a course's or every course's
 * sessions may have moved with this one), the course pages and the course list (the course's
 * type and its «أونلاين» chip).
 */
export function refreshAfterDelivery(qc: QueryClient, courseId?: string | number | null): void {
  qc.invalidateQueries({ queryKey: ['teacher-sessions-today'] });
  qc.invalidateQueries({ queryKey: ['teacher-session-detail'] });
  qc.invalidateQueries({ queryKey: ['teacher-session-history'] });
  qc.invalidateQueries({ queryKey: courseId != null ? ['teacher-course', String(courseId)] : ['teacher-course'] });
  qc.invalidateQueries({ queryKey: ['teacher-courses'] });
}

/**
 * The teacher says how a session is held: that one, its course from now on, or every course.
 * The caller shows the result (the server's refusal is an Arabic sentence — remoteErrorSentence).
 */
export function useSetSessionDelivery(sessionId: string) {
  const qc = useQueryClient();
  return useMutation<DeliveryChange, unknown, { delivery: SessionDelivery; scope: DeliveryScope }>({
    mutationFn: ({ delivery, scope }) => setSessionDelivery(sessionId, delivery, scope),
    // Refused or not, what the cards show may be stale (changed from the website, a room that went live).
    onSettled: () => refreshAfterDelivery(qc),
  });
}

/** «نوع المقرر» from the course page: the course, its groups and its sessions from now on. */
export function useSetCourseDelivery(courseId: string) {
  const qc = useQueryClient();
  return useMutation<DeliveryChange, unknown, SessionDelivery>({
    mutationFn: (delivery) => setCourseDelivery(courseId, delivery),
    onSettled: () => refreshAfterDelivery(qc, courseId),
  });
}

/**
 * Camera and microphone, asked with the APIs already in the binary (expo-camera). Only ever
 * called on a build that may broadcast (canBroadcastFromPhone): asking an older iOS binary
 * for the microphone kills the app. Required lazily so the home tab does not load the camera
 * module to draw a button.
 */
async function ensureBroadcastPermissions(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Camera } = require('expo-camera') as typeof import('expo-camera');
  const cam = await Camera.requestCameraPermissionsAsync();
  if (!cam.granted) return false;
  const mic = await Camera.requestMicrophonePermissionsAsync();
  return mic.granted;
}

export type TeacherRemoteBusy = 'start' | 'enter' | 'end' | null;

/**
 * The teacher's three acts on a session's online class — start, enter, end — with the rules
 * that go before each:
 *  · a store build before 1.3.0 cannot broadcast: no permission is asked, no room is opened;
 *    `needsUpdate` turns true and the caller shows the «حدّث التطبيق» sheet;
 *  · starting asks once (the students get a notification; attendance is automatic);
 *  · camera and microphone are asked BEFORE the room is started, so nobody is notified of a
 *    class its teacher cannot broadcast;
 *  · the `join_url` that «start» returns goes to the room screen in memory, used once.
 */
export function useTeacherRemote(sessionId: string) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<TeacherRemoteBusy>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  // A second tap while the first is still asking / starting must not start twice.
  const running = useRef(false);

  const fail = useCallback((e: unknown) => {
    Alert.alert(t('common.error'), remoteErrorSentence(e) ?? getFriendlyErrorMessage(e));
    // Whatever the server refused, what the cards show may be stale (ended elsewhere, started from the website).
    refreshTeacherRemote(qc, sessionId);
  }, [qc, sessionId, t]);

  /** True when this phone may broadcast and both permissions are granted. Says why when not. */
  const mayBroadcast = useCallback(async (): Promise<boolean> => {
    if (!canBroadcastFromPhone(binaryVersion())) {
      setNeedsUpdate(true);
      return false;
    }
    const granted = await ensureBroadcastPermissions().catch(() => false);
    if (!granted) {
      Alert.alert(t('remote.permission_title'), t('remote.permission_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('remote.permission_settings'), onPress: () => { void Linking.openSettings().catch(() => undefined); } },
      ]);
    }
    return granted;
  }, [t]);

  const run = useCallback(async (what: Exclude<TeacherRemoteBusy, null>, job: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(what);
    try {
      await job();
    } catch (e) {
      fail(e);
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, [fail]);

  const openRoom = useCallback(() => {
    router.push(`/(teacher)/remote/${sessionId}` as Href);
  }, [sessionId]);

  /** «ابدأ حصة أونلاين». */
  const start = useCallback(() => {
    if (!canBroadcastFromPhone(binaryVersion())) {
      setNeedsUpdate(true);
      return;
    }
    Alert.alert(t('remote.start_confirm_title'), t('remote.start_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('remote.start_confirm_cta'),
        onPress: () => {
          void run('start', async () => {
            if (!(await mayBroadcast())) return;
            const started = await startRemoteSession(sessionId);
            offerJoinUrl(teacherRoomKey(sessionId), started.join_url);
            refreshTeacherRemote(qc, sessionId);
            openRoom();
          });
        },
      },
    ]);
  }, [mayBroadcast, openRoom, qc, run, sessionId, t]);

  /** «ادخل الحصة» — back into a class that is on air. */
  const enter = useCallback(() => {
    void run('enter', async () => {
      if (await mayBroadcast()) openRoom();
    });
  }, [mayBroadcast, openRoom, run]);

  /** «إنهاء الحصة» from outside the room (a class started on the website, a phone that left it running). */
  const end = useCallback(() => {
    Alert.alert(t('remote.end_confirm_title'), t('remote.end_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('remote.end_confirm_cta'), style: 'destructive',
        onPress: () => {
          void run('end', async () => {
            await endRemoteSession(sessionId);
            refreshTeacherRemote(qc, sessionId);
          });
        },
      },
    ]);
  }, [qc, run, sessionId, t]);

  const closeNeedsUpdate = useCallback(() => setNeedsUpdate(false), []);

  return { busy, start, enter, end, needsUpdate, closeNeedsUpdate };
}
