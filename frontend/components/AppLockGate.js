/**
 * AppLockGate: overlay that blocks app access until authenticated.
 * Wraps app content and shows a lock screen when returning from background.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  AppState, Animated,
} from 'react-native';
import { Lock, Fingerprint } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  isLockEnabled, shouldLock, updateLastActive,
  authenticateWithBiometric, isBiometricAvailable, verifyPIN,
} from '../services/appLockService';

export function AppLockGate({ children }) {
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPinFallback, setShowPinFallback] = useState(false);
  const appState = useRef(AppState.currentState);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors } = theme;

  const unlock = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setLocked(false);
      setPinInput('');
      setPinError(false);
      setShowPinFallback(false);
      fadeAnim.setValue(1);
    });
    updateLastActive();
  }, [fadeAnim]);

  const attemptBiometric = useCallback(async () => {
    const available = await isBiometricAvailable();
    if (!available) {
      setShowPinFallback(true);
      return;
    }
    const success = await authenticateWithBiometric();
    if (success) {
      unlock();
    } else {
      setShowPinFallback(true);
    }
  }, [unlock]);

  useEffect(() => {
    (async () => {
      const enabled = await isLockEnabled();
      setChecking(false);
      if (!enabled) return;
      setLocked(true);
      attemptBiometric();
    })();
  }, [attemptBiometric]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const enabled = await isLockEnabled();
        if (enabled && shouldLock()) {
          setLocked(true);
          setShowPinFallback(false);
          setPinInput('');
          attemptBiometric();
        }
      }
      if (nextState.match(/inactive|background/)) {
        updateLastActive();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [attemptBiometric]);

  const handlePinSubmit = useCallback(async () => {
    const valid = await verifyPIN(pinInput);
    if (valid) {
      unlock();
    } else {
      setPinError(true);
      setPinInput('');
      setTimeout(() => setPinError(false), 2000);
    }
  }, [pinInput, unlock]);

  useEffect(() => {
    if (pinInput.length === 4) {
      handlePinSubmit();
    }
  }, [pinInput.length, handlePinSubmit]);

  if (checking) return null;
  if (!locked) return children;

  return (
    <View style={StyleSheet.absoluteFill}>
      {children}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim, backgroundColor: colors.background }]}>  
        <View style={styles.content}>
          <Lock size={48} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>
            {t('appLock.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textLight }]}>
            {t('appLock.subtitle')}
          </Text>

          {!showPinFallback ? (
            <TouchableOpacity style={[styles.biometricBtn, { borderColor: colors.border }]} onPress={attemptBiometric}>
              <Fingerprint size={28} color={colors.primary} />
              <Text style={[styles.biometricText, { color: colors.text }]}>
                {t('appLock.useBiometric')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.pinContainer}>
              <Text style={[styles.pinLabel, { color: colors.textLight }]}>
                {t('appLock.enterPin')}
              </Text>
              <View style={styles.pinDots}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: pinInput.length > i ? colors.primary : 'transparent',
                        borderColor: pinError ? '#ef4444' : colors.border,
                      },
                    ]}
                  />
                ))}
              </View>
              <TextInput
                style={styles.hiddenInput}
                value={pinInput}
                onChangeText={(val) => setPinInput(val.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
                secureTextEntry
              />
              {pinError && (
                <Text style={styles.errorText}>{t('appLock.wrongPin')}</Text>
              )}
            </View>
          )}

          {!showPinFallback && (
            <TouchableOpacity onPress={() => setShowPinFallback(true)}>
              <Text style={[styles.fallbackLink, { color: colors.primary }]}>
                {t('appLock.usePin')}
              </Text>
            </TouchableOpacity>
          )}
          {showPinFallback && (
            <TouchableOpacity onPress={attemptBiometric}>
              <Text style={[styles.fallbackLink, { color: colors.primary }]}>
                {t('appLock.useBiometric')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 32,
    textAlign: 'center',
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 12,
  },
  biometricText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pinContainer: {
    alignItems: 'center',
  },
  pinLabel: {
    fontSize: 14,
    marginBottom: 16,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 8,
  },
  fallbackLink: {
    fontSize: 14,
    marginTop: 24,
    fontWeight: '500',
  },
});
