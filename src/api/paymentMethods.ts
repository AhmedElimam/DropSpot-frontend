import client from './client';

/**
 * Teacher billing settings — Vodafone Cash / InstaPay receiving details shown to
 * parents on invoices. Informational only; teacher-only on the backend.
 */
export type BookingSecures = 'session' | 'booklet' | 'flat';

export interface PaymentMethods {
  vodafone_enabled: boolean;
  vodafone_number: string | null;
  vodafone_name: string | null;
  instapay_enabled: boolean;
  instapay_number: string | null;
  instapay_name: string | null;
  physical_enabled: boolean;
  // Booking / booklet models (per-course amounts are set on each course page).
  offers_booklets: boolean;
  requires_down_payment: boolean;
  booklet_secures_booking: boolean;
  default_booking_secures: BookingSecures;
  // Remote booking-link rules template + basic style.
  booking_link_rules: string | null;
  booking_link_font: 'default' | 'cairo' | 'tajawal' | 'amiri';
  booking_link_font_size: 'sm' | 'md' | 'lg';
  booking_link_bold: boolean;
}

export async function getPaymentMethods(): Promise<PaymentMethods> {
  const { data } = await client.get('/teacher/payment-methods');
  return (data.data ?? data) as PaymentMethods;
}

export async function updatePaymentMethods(payload: PaymentMethods): Promise<PaymentMethods> {
  const { data } = await client.post('/teacher/payment-methods', payload);
  return (data.data ?? data) as PaymentMethods;
}

/** Just the booking-link rules template — the endpoint only writes the fields it receives. */
export interface BookingTemplate {
  booking_link_rules: string | null;
  booking_link_font: 'default' | 'cairo' | 'tajawal' | 'amiri';
  booking_link_font_size: 'sm' | 'md' | 'lg';
  booking_link_bold: boolean;
}

export async function saveBookingTemplate(t: BookingTemplate): Promise<void> {
  await client.post('/teacher/payment-methods', t);
}
