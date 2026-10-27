import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';

/** The student's teachers as chips to pick one — its own file, so the screens holding it keep
 *  their ScrollView free of a row-per-item map (docs/PERFORMANCE.md). */
export function TeacherChips({ teachers, value, onChange }: { teachers: { id: number; name: string }[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {teachers.map((tc) => {
        const on = value === tc.id;
        return (
          <TouchableOpacity key={tc.id} onPress={() => onChange(tc.id)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surfaceSunken, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: on ? colors.brand : colors.textPrimary }}>{tc.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
