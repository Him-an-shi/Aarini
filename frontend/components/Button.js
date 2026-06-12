import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export const Button = ({
  onPress,
  title,
  variant = 'primary', // primary, secondary, outline, text
  loading = false,
  disabled = false,
  style = {},
  textStyle = {},
  icon,
}) => {
  const { theme } = useTheme();
  const { colors, typography, borderRadius, shadows, spacing } = theme;
  const styles = useMemo(
    () => createStyles(colors, borderRadius, shadows, spacing),
    [borderRadius, colors, shadows, spacing]
  );
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isText = variant === 'text';

  const buttonStyles = [
    styles.base,
    isPrimary && styles.primary,
    isSecondary && styles.secondary,
    isOutline && styles.outline,
    isText && styles.text,
    disabled && styles.disabled,
    style,
  ];

  const labelStyles = [
    typography.buttonText,
    isPrimary && styles.primaryLabel,
    isSecondary && styles.secondaryLabel,
    isOutline && styles.outlineLabel,
    isText && styles.textLabel,
    disabled && styles.disabledLabel,
    textStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={buttonStyles}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={isPrimary ? colors.textOnPrimary : colors.primaryDark} 
        />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={labelStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (colors, borderRadius, shadows, spacing) => StyleSheet.create({
  base: {
    height: 56,
    borderRadius: borderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    width: '100%',
  },
  primary: {
    backgroundColor: colors.primaryDark,
    ...shadows.light,
  },
  secondary: {
    backgroundColor: colors.secondary,
    ...shadows.light,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primaryDark,
  },
  text: {
    backgroundColor: 'transparent',
    height: 'auto',
    paddingHorizontal: 0,
    marginVertical: spacing.xs,
    width: 'auto',
  },
  disabled: {
    backgroundColor: colors.mutedBackground,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryLabel: {
    color: colors.textOnPrimary,
  },
  secondaryLabel: {
    color: colors.textOnSoft,
  },
  outlineLabel: {
    color: colors.primaryDark,
  },
  textLabel: {
    color: colors.primaryDark,
    fontSize: 14,
  },
  disabledLabel: {
    color: colors.textLight,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
});
