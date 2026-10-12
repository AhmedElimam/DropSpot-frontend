import { NotificationsFeed } from '@/components/NotificationsFeed';
import { Surface } from '@/ui/surfaces';


/** The parent notifications feed — one shared screen; every tap opens what it is about. */
export default function NotificationsScreen() {
  return <Surface id="screen.parent.notifications" screen><NotificationsFeed /></Surface>;
}
