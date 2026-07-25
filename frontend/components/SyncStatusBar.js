import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export const SyncStatusBar = ({ status }) => {
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  if (!status || status === 'synced') return null;

  const statusConfig = {
    offline: { color: colors.errorDark, label: 'Offline - changes saved locally' },
    pending: { color: colors.accentDark, label: 'Some entries pending sync' },
    syncing: { color: colors.primaryDark, label: 'Syncing...' },
  };

  const config = statusConfig[status] || statusConfig.syncing;

  return (
    <View
      style={[styles.container, { marginBottom: spacing.sm }]}
      accessibilityLiveRegion="polite"
    >
      <View
        style={[styles.dot, { backgroundColor: config.color }]}
      />
      <Text style={[styles.text, { color: colors.textLight }]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
  },
});
