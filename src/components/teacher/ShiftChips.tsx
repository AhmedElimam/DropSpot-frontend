import { useTranslation } from 'react-i18next';
import { Chips } from '@/components/ui/Form';
import type { CourseShift } from '@/api/courses';

/** «الفترة» (founder 2026-11-06): none · صباحي · مسائي — on the course create and settings screens. */
export function ShiftChips({ value, onChange }: { value: CourseShift | null; onChange: (v: CourseShift | null) => void }) {
  const { t } = useTranslation();
  return (
    <Chips fill value={value ?? ''} onChange={(k) => onChange(k === '' ? null : k)} options={[
      { key: '' as const, label: t('course_shift.none') },
      { key: 'morning' as const, label: t('course_shift.morning'), icon: 'morning' },
      { key: 'evening' as const, label: t('course_shift.evening'), icon: 'evening' },
    ]} />
  );
}
