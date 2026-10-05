export type NotificationCategory = 'attendance' | 'money' | 'students' | 'followup' | 'other';

// Order matters: the first family whose word appears in the type wins
// (`assistant_checkin_review` is attendance, `payment_proof_submitted` is money).
const RULES: [NotificationCategory, RegExp][] = [
  ['money', /invoice|payment|cash|expense|billing|financial|subscription/],
  ['attendance', /attendance|absence|left_early|checkin|session|schedule|excuse|swap|pending_scans/],
  ['students', /student|card|enrollment|booking|sibling|parent|guardian|invitation|grade|graduation|linked|termination/],
  ['followup', /ticket|report|assistant|discrepancy|digest/],
];

/** Which feed chip a notification type belongs to (المال · الحضور · الطلاب · المتابعة). */
export function notificationCategory(type: string): NotificationCategory {
  for (const [cat, re] of RULES) if (re.test(type)) return cat;
  return 'other';
}
