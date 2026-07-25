import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export const Card = ({
  children,
  icon,
  title,
  subtitle,
  style = {},
  contentStyle = {},
  variant = 'default',
  accessibilityLabel,
}) => {
  const { theme } = useTheme();
  const { colors, typography, borderRadius, shadows } = theme;
  const styles = useMemo(
    () => createStyles(colors, typography, borderRadius, shadows),
    [colors, typography, borderRadius, shadows]
  );

  const isDanger = variant === 'danger';

  return (
    <View
      style={[styles.card, isDanger && styles.dangerCard, style]}
      accessibilityLabel={accessibilityLabel || title}
    >
      {(title || icon) && (
        <View style={styles.cardHeader}>
          {icon && <View style={styles.cardIcon}>{icon}</View>}
          <View style={{ flex: 1 }}>
            {title && <Text style={typography.h3}>{title}</Text>}
            {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
          </View>
        </View>
      )}
      <View style={contentStyle}>{children}</View>
    </View>
  );
};

const createStyles = (colors, typography, borderRadius, shadows) => StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: 24,
    marginBottom: 24,
    ...shadows.light,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: colors.error || '#FCA5A5',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.mutedBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.textMedium,
    marginTop: 2,
  },
});
