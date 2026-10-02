import client from './client';

/**
 * Booking requests from already-registered students (student-code shortcut on the family
 * booking page). The teacher accepts (→ enrol) or rejects them in the app.
 */
export interface BookingRequest {
  id: number;
  course_id: number | null;
  student_name: string;
  student_code: string | null;
  grade_name: string | null;
  course_name: string | null;
  created_at: string | null;
}

export async function getBookingRequests(): Promise<BookingRequest[]> {
  const { data } = await client.get('/teacher/booking-requests');
  const rows = (data?.data ?? []) as any[];
  return rows.map((r) => (r.attributes ?? r) as BookingRequest);
}

/** Accept, optionally stating the enrolment terms (position, دفعة, booklet) like every other door. */
export async function acceptBookingRequest(id: number, terms: import('./enrollmentTerms').EnrollmentTermsInput = {}): Promise<void> {
  await client.post(`/teacher/booking-requests/${id}/accept`, terms);
}

export async function rejectBookingRequest(id: number): Promise<void> {
  await client.post(`/teacher/booking-requests/${id}/reject`);
}
