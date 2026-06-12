import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error = null,
  keyboardType = 'default',
  autoCapitalize = 'none',
  containerStyle = {},
  inputStyle = {},
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, typography, borderRadius, spacing } = theme;
  const styles = useMemo(
    () => createStyles(colors, typography, borderRadius, spacing),
    [borderRadius, colors, spacing, typography]
  );
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const hasError = !!error;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View 
        style={[
          styles.inputContainer,
          isFocused && styles.focusedBorder,
          hasError && styles.errorBorder,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={[styles.input, typography.bodyLarge, inputStyle]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity 
            onPress={togglePasswordVisibility} 
            activeOpacity={0.7}
            style={styles.eyeButton}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color={colors.textMedium} />
            ) : (
              <Eye size={20} color={colors.textMedium} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {hasError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const createStyles = (colors, typography, borderRadius, spacing) => StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textMedium,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  inputContainer: {
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  focusedBorder: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.inputBackground,
  },
  errorBorder: {
    borderColor: colors.errorDark,
    backgroundColor: colors.error,
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.textDark,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.errorDark,
    fontWeight: '500',
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
});
