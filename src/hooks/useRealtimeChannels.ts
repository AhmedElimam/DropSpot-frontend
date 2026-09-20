import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { ChatRealtime } from '@/api/chat';

/** off = no broadcaster / not asked; connecting; live = every channel subscribed; error = tried and failed (poll carries on). */
export type RealtimeStatus = 'off' | 'connecting' | 'live' | 'error';

/**
 * One socket, several private channels, a map of event → handler. This is the transport
 * under the course chat and the grade threads alike: Pusher and Reverb speak the same
 * protocol, so the same client serves both; only the connection settings differ.
 *
 * Nothing here is authoritative. A frame that arrives is handed to its handler, which
 * merges into or invalidates the same cache the REST poll fills — and the poll keeps running
 * (slower) as the safety net. A socket that silently dropped must never mean a screen that
 * silently stopped. `connected` is only for the small «مباشر» / «تحديث دوري» label and for
 * choosing the poll cadence.
 *
 * The bearer token authorises every channel through the API's own broadcasting/auth door,
 * so a socket can only ever join a room the REST timeline would also open.
 */
export function useRealtimeChannels(
  realtime: ChatRealtime | null | undefined,
  /** Channel names WITHOUT the `private-` prefix, e.g. `chat.course.12`, `threads.54.1`. */
  channels: readonly string[],
  bindings: Record<string, (data: any) => void>,
  enabled = true,
): { connected: boolean; status: RealtimeStatus } {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<RealtimeStatus>('off');
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;
  // Subscribe by VALUE: a fresh array with the same names must not tear the socket down.
  const channelKey = channels.join('|');

  useEffect(() => {
    if (!enabled || !realtime?.key || !channelKey) {
      setConnected(false);
      setStatus('off');
      return;
    }
    const names = channelKey.split('|');
    let alive = true;
    let pusher: any = null;
    const subscribed: any[] = [];
    const fail = (why: string, detail?: unknown) => {
      // A dead socket used to be indistinguishable from one that never tried: every error
      // was swallowed and the header just never turned green. Name the reason — in dev
      // loudly, in the UI as «تحديث دوري» — so "Pusher doesn't work" can be answered.
      if (__DEV__) console.warn(`[realtime] ${why}`, detail ?? '');
      if (alive) { setConnected(false); setStatus('error'); }
    };

    (async () => {
      try {
        setStatus('connecting');
        const [mod, SecureStore] = await Promise.all([
          import('pusher-js/react-native'),
          import('expo-secure-store'),
        ]);
        // The RN build is a CommonJS bundle; depending on the interop path the class is
        // the module itself or its `default`. Take whichever is the constructor.
        const Pusher: any = (mod as any).default ?? mod;
        if (typeof Pusher !== 'function') { fail('pusher-js/react-native did not export a constructor', Object.keys(mod as any)); return; }
        const token = await SecureStore.getItemAsync('access_token');
        if (!alive) return;
        if (!token) { fail('no access_token in SecureStore — cannot authorise the private channel'); return; }

        const options: Record<string, unknown> = {
          forceTLS: realtime.tls,
          channelAuthorization: {
            transport: 'ajax',
            endpoint: realtime.auth_endpoint,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          },
        };
        if (realtime.driver === 'reverb') {
          Object.assign(options, {
            wsHost: realtime.host, wsPort: realtime.port, wssPort: realtime.port,
            enabledTransports: ['ws', 'wss'], cluster: 'mt1', disableStats: true,
          });
        } else {
          options.cluster = realtime.cluster || 'mt1';
        }

        pusher = new Pusher(realtime.key, options as any);
        pusher.connection.bind('state_change', (s: { current: string }) => {
          if (!alive) return;
          if (s.current !== 'connected') setConnected(false);
          if (s.current === 'connecting' || s.current === 'unavailable') setStatus('connecting');
        });
        pusher.connection.bind('error', (e: unknown) => fail('connection error', e));

        // «مباشر» means every private channel is actually SUBSCRIBED — a connected socket
        // whose channel auth failed delivers nothing, and must not read as live.
        const ready = new Set<string>();
        for (const name of names) {
          const channel = pusher.subscribe(`private-${name}`);
          subscribed.push(channel);
          channel.bind('pusher:subscription_succeeded', () => {
            ready.add(name);
            if (alive && ready.size === names.length) { setConnected(true); setStatus('live'); }
          });
          channel.bind('pusher:subscription_error', (e: unknown) => fail(`channel auth failed for ${name} at ${realtime.auth_endpoint}`, e));
          for (const event of Object.keys(bindingsRef.current)) {
            channel.bind(event, (d: unknown) => { if (alive) bindingsRef.current[event]?.(d); });
          }
        }
      } catch (e) {
        // No socket → the poll is the transport, as before.
        fail('socket setup threw', e);
      }
    })();

    // Backgrounded apps drop sockets; reconnect on return rather than trusting the library's
    // own timers, which the OS may have frozen.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && pusher && pusher.connection?.state !== 'connected') {
        try { pusher.connect(); } catch { /* ignore */ }
      }
    });

    return () => {
      alive = false;
      sub.remove();
      try {
        subscribed.forEach((c) => c?.unbind_all?.());
        names.forEach((n) => pusher?.unsubscribe?.(`private-${n}`));
        pusher?.disconnect?.();
      } catch { /* ignore */ }
      setConnected(false);
      setStatus('off');
    };
    // Bindings are read through a ref on purpose: a new handler identity must not reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, enabled, realtime?.key, realtime?.driver, realtime?.cluster, realtime?.host, realtime?.port, realtime?.tls, realtime?.auth_endpoint]);

  return { connected, status };
}
