import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';

export interface TabItem {
  key: string;
  label: string;
  icon: string;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 4,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: isActive ? colors.white : 'transparent',
            }}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={{ fontSize: 14, marginEnd: spacing.xs }}>{tab.icon}</Text>
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 13,
                color: isActive ? colors.primary : colors.textSecondary,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
