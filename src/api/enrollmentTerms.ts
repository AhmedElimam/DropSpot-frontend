import client from './client';

export type BookingSecures = 'session' | 'booklet' | 'flat';

/** What the server says about joining THIS course right now (GET …/enrollment-terms). */
export interface EnrollmentTermsDefaults {
  course_id: number;
  cycle: {
    /** «المقرر الآن على الحصة N من M» — the session a student joining now starts at. */
    position: number;
    threshold: number;
    remaining: number;
    cycle_price: number | null;
    per_session: number | null;
    /** What joining now is billed, before any دفعة credit. */
    remaining_amount: number | null;
    timeline: {
      cohort_position: number;
      threshold: number;
      positions: { n: number; date: string | null; label: string | null; is_past: boolean }[];
    };
  };
  booking: {
    required: boolean;
    default_secures: BookingSecures;
    price_session: number | null;
    price_booklet: number | null;
    price_flat: number | null;
  };
  booklet: { offered: boolean; price: number | null };
}

export async function getEnrollmentTerms(courseId: number): Promise<EnrollmentTermsDefaults> {
  const { data } = await client.get(`/teacher/courses/${courseId}/enrollment-terms`);
  return (data.data ?? data) as EnrollmentTermsDefaults;
}

/**
 * The shared request keys every enrolling endpoint accepts (App\Support\EnrollmentTerms).
 * Absent key = nothing said (defaults + the class's position apply). A PRESENT null
 * `down_payment_amount` = no دفعة for this student.
 */
export interface EnrollmentTermsInput {
  joins_at_session?: number;
  sessions_remaining?: number;
  down_payment_amount?: number | null;
  down_payment_paid?: number | null;
  booking_secures?: BookingSecures;
  booklet_paid?: boolean;
}
