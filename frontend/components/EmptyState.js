import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export const EmptyState = ({
  icon,
  title,
  message,
  action,
  compact = false,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;
  const styles = useMemo(
    () => createStyles(colors, typography, spacing),
    [colors, typography, spacing]
  );

  return (
    <View style={[styles.container, compact && styles.compact]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      {title && <Text style={styles.title}>{title}</Text>}
      {message && <Text style={styles.message}>{message}</Text>}
      {action && <View style={styles.actionContainer}>{action}</View>}
    </View>
  );
};

const createStyles = (colors, typography, spacing) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  compact: {
    paddingVertical: spacing.lg,
  },
  iconContainer: {
    marginBottom: spacing.md,
    opacity: 0.6,
  },
  title: {
    ...typography.h3,
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.bodyMedium,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionContainer: {
    marginTop: spacing.lg,
    width: '100%',
  },
});
