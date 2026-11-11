import { create } from 'zustand';
import type { ShiftSettings } from '@/api/courses';

/**
 * The teacher's «الفترات» switch and hours (founder 2026-11-07). They ride on GET
 * /teacher/courses (no extra request); getCourses() files them here, the shifts screen saves
 * them with PUT /teacher/shift-settings.
 */
export const useShiftSettingsStore = create<{ settings: ShiftSettings | null; set: (s: ShiftSettings) => void }>((set) => ({
  settings: null,
  set: (settings) => set({ settings }),
}));
