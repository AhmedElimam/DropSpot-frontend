import { NotificationsFeed } from '@/components/NotificationsFeed';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { Surface } from '@/ui/surfaces';

/** The teacher notifications feed — one shared screen; every tap opens what it is about. */
export default function NotificationsScreen() {
  // An assistant's tap never opens a screen the server would refuse them.
  const { can } = useActiveAbilities();
  return (
    <Surface id="screen.teacher.notifications" screen>
      <Surface id="teacher.notifications.feed"><NotificationsFeed can={can} /></Surface>
    </Surface>
  );
}
