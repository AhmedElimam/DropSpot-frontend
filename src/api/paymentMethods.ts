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
  // Remote booking-link rules template: rich HTML (WordPress-style) takes precedence;
  // the legacy plain text + basic style is the fallback.
  booking_link_html: string | null;
  booking_link_rules: string | null;
  booking_link_font: 'default' | 'cairo' | 'tajawal' | 'amiri';
  booking_link_font_size: 'sm' | 'md' | 'lg';
  booking_link_bold: boolean;
  // Whole-page theme (branding around the fixed booking form).
  booking_logo_url: string | null;
  booking_title: string | null;
  booking_intro: string | null;
  booking_brand_color: string | null;
  booking_bg_color: string | null;
  booking_bg_image_url: string | null;
  booking_font: 'default' | 'cairo' | 'tajawal' | 'amiri';
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
  booking_link_html?: string | null;
  booking_link_rules: string | null;
  booking_link_font: 'default' | 'cairo' | 'tajawal' | 'amiri';
  booking_link_font_size: 'sm' | 'md' | 'lg';
  booking_link_bold: boolean;
  booking_logo_url?: string | null;
  booking_title?: string | null;
  booking_intro?: string | null;
  booking_brand_color?: string | null;
  booking_bg_color?: string | null;
  booking_bg_image_url?: string | null;
  booking_font?: 'default' | 'cairo' | 'tajawal' | 'amiri';
}

export async function saveBookingTemplate(t: BookingTemplate): Promise<void> {
  await client.post('/teacher/payment-methods', t);
}

/**
 * Upload one inline image for the booking-link rich editor; returns its public URL to
 * embed in the WYSIWYG. Teacher-only on the backend (re-validated against our storage
 * on render).
 */
export async function uploadBookingLinkImage(uri: string): Promise<string> {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
  const type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const form = new FormData();
  form.append('image', { uri, name: `rules.${ext}`, type } as any);
  const { data } = await client.post('/teacher/booking-link-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (data?.data?.url ?? data?.url) as string;
}
