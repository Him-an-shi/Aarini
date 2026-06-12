import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle = () => {
  const insets = useSafeAreaInsets();
  const { isDark, theme, toggleTheme } = useTheme();
  const { colors, spacing, borderRadius, shadows } = theme;
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, shadows, insets.top),
    [borderRadius, colors, insets.top, shadows, spacing]
  );

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      accessibilityState={{ checked: isDark }}
      hitSlop={12}
      onPress={toggleTheme}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      {isDark ? (
        <Moon size={21} color={colors.primaryDark} />
      ) : (
        <Sun size={21} color={colors.textDark} />
      )}
    </Pressable>
  );
};

const createStyles = (colors, spacing, borderRadius, shadows, safeTop) => StyleSheet.create({
  toggle: {
    position: 'absolute',
    top: Math.max(safeTop + spacing.sm, spacing.xl),
    right: spacing.lg,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.glass,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
