import { NotificationsFeed } from '@/components/NotificationsFeed';
import { Surface } from '@/ui/surfaces';


/** The student notifications feed — one shared screen; every tap opens what it is about. */
export default function NotificationsScreen() {
  return <Surface id="screen.student.notifications" screen><NotificationsFeed /></Surface>;
}
