import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { ChatMessage, ChatRealtime } from '@/api/chat';

/**
 * A live subscription to one room's private channel, when the server says a broadcaster is
 * configured (`realtime` non-null). Pusher and Reverb speak the same protocol, so the same
 * client serves both; only the connection settings differ.
 *
 * Nothing here is authoritative. A frame that arrives is merged into the same cache the REST
 * poll fills, and the poll keeps running (slower) as the safety net — a socket that silently
 * dropped must never mean a room that silently stopped. `connected` is only for the small
 * «مباشر» / «تحديث دوري» label.
 *
 * The bearer token authorises the channel through the API's own broadcasting/auth door, so a
 * socket can only ever join a room the REST timeline would also open.
 */
export function useChatSocket(
  courseId: number,
  realtime: ChatRealtime | null | undefined,
  handlers: { onMessage: (m: ChatMessage) => void; onHidden: (id: number) => void },
  enabled = true,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !realtime?.key || courseId <= 0) {
      setConnected(false);
      return;
    }
    let alive = true;
    let pusher: any = null;
    let channel: any = null;

    (async () => {
      try {
        const [{ default: Pusher }, SecureStore] = await Promise.all([
          import('pusher-js/react-native'),
          import('expo-secure-store'),
        ]);
        const token = await SecureStore.getItemAsync('access_token');
        if (!alive || !token) return;

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
          if (alive) setConnected(s.current === 'connected');
        });
        channel = pusher.subscribe(`private-${realtime.channel_prefix}${courseId}`);
        channel.bind('message.posted', (d: { message?: ChatMessage }) => {
          if (alive && d?.message) handlersRef.current.onMessage(d.message);
        });
        channel.bind('message.hidden', (d: { id?: number }) => {
          if (alive && d?.id) handlersRef.current.onHidden(d.id);
        });
      } catch {
        // No socket → the poll is the transport, as before.
        if (alive) setConnected(false);
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
      try { channel?.unbind_all?.(); pusher?.unsubscribe?.(`private-${realtime.channel_prefix}${courseId}`); pusher?.disconnect?.(); } catch { /* ignore */ }
      setConnected(false);
    };
  }, [courseId, enabled, realtime?.key, realtime?.driver, realtime?.cluster, realtime?.host, realtime?.port, realtime?.tls, realtime?.auth_endpoint, realtime?.channel_prefix]);

  return { connected };
}
