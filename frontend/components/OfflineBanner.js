import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WifiOff, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';

export const OfflineBanner = ({ onRetry }) => {
  const { isOnline, checkNow } = useNetwork();
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const styles = useMemo(() => createStyles(colors, spacing, borderRadius), [colors, spacing, borderRadius]);

  if (isOnline) return null;

  const handleRetry = async () => {
    await checkNow();
    if (onRetry) onRetry();
  };

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <WifiOff size={16} color="#FFFFFF" />
      <Text style={styles.text}>You are offline. Changes will sync when connection restores.</Text>
      <TouchableOpacity
        onPress={handleRetry}
        style={styles.retryButton}
        accessibilityRole="button"
        accessibilityLabel="Retry connection"
      >
        <RotateCcw size={14} color="#FFFFFF" />
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors, spacing, borderRadius) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B21A8',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
