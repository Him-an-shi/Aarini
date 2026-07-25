/**
 * App lock service: biometric authentication + PIN fallback.
 * Uses expo-local-authentication for biometrics and secureStorage for encrypted PIN.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

const LOCK_ENABLED_KEY = '@aarini:app_lock_enabled';
const PIN_HASH_KEY = '@aarini:app_lock_pin_hash';
const GRACE_PERIOD_MS = 30000;

let lastActiveTimestamp = Date.now();

export function updateLastActive() {
  lastActiveTimestamp = Date.now();
}

export function shouldLock() {
  return Date.now() - lastActiveTimestamp > GRACE_PERIOD_MS;
}

export async function isLockEnabled() {
  const val = await AsyncStorage.getItem(LOCK_ENABLED_KEY);
  return val === 'true';
}

export async function setLockEnabled(enabled) {
  await AsyncStorage.setItem(LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await AsyncStorage.removeItem(PIN_HASH_KEY);
  }
}

async function hashPin(pin) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `aarini-pin-${pin}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

export async function setPIN(pin) {
  const hash = await hashPin(pin);
  await AsyncStorage.setItem(PIN_HASH_KEY, hash);
}

export async function verifyPIN(pin) {
  const stored = await AsyncStorage.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  const hash = await hashPin(pin);
  return hash === stored;
}

export async function hasPINSet() {
  const stored = await AsyncStorage.getItem(PIN_HASH_KEY);
  return !!stored;
}

export async function isBiometricAvailable() {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticateWithBiometric() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Aarini',
    cancelLabel: 'Use PIN',
    disableDeviceFallback: true,
  });
  return result.success;
}
