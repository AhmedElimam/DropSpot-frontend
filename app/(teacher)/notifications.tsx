import { NotificationsFeed } from '@/components/NotificationsFeed';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';

/** The teacher notifications feed — one shared screen; every tap opens what it is about. */
export default function NotificationsScreen() {
  // An assistant's tap never opens a screen the server would refuse them.
  const { can } = useActiveAbilities();
  return <NotificationsFeed can={can} />;
}
