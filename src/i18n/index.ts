import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import { toArabicDigits } from '@/utils/numerals';

i18n.use(initReactI18next).init({
  lng: 'ar',
  fallbackLng: 'ar',
  resources: { ar: { translation: ar } },
  interpolation: {
    escapeValue: false,
    // Arabic-first display: render interpolated NUMBERS in Arabic-Indic digits
    // (covers every `{{count}}` and numeric param). Strings — invite codes, ids,
    // pre-formatted values — pass through untouched so nothing the user types
    // back gets converted. Plural selection still uses the raw numeric count.
    //
    // `interpolation.format` is read at runtime (i18next core: `this.format =
    // options.interpolation.format || ...`) but was removed from the v26 TS
    // types, so the option object is cast to keep this supported hook.
    format: (value: unknown): string =>
      typeof value === 'number' ? toArabicDigits(value) : String(value ?? ''),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
});

export default i18n;
