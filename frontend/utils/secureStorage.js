/**
 * Encrypted wrapper around AsyncStorage for sensitive health data.
 * Uses expo-crypto for AES-256 key derivation and XOR-based cipher.
 *
 * Note: expo-crypto in SDK 56 provides digestStringAsync (SHA-256/512)
 * and getRandomBytes, but not direct AES. We use SHA-512 to derive a
 * key from the user's UID, then XOR the data with a repeating key stream
 * derived from that hash. This provides meaningful obfuscation against
 * casual file extraction on rooted devices.
 *
 * For production-grade AES-256, consider expo-secure-store (limited to
 * 2KB values) or react-native-keychain + a native AES library.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'

const ENCRYPTED_PREFIX = 'ENC:'
const MIGRATION_KEY_SUFFIX = ':migrated'

let derivedKey = null

async function deriveKey(userId) {
  if (derivedKey && derivedKey.uid === userId) return derivedKey.hash
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA512,
    `aarini-health-${userId}-encryption-key`,
    { encoding: Crypto.CryptoEncoding.HEX },
  )
  derivedKey = { uid: userId, hash }
  return hash
}

function xorCipher(text, key) {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    result += String.fromCharCode(charCode)
  }
  return result
}

function toBase64(str) {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64) {
  const binary = atob(b64)
  return binary
}

function encode(encrypted) {
  return ENCRYPTED_PREFIX + toBase64(encrypted)
}

function decode(stored) {
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return null
  const b64 = stored.slice(ENCRYPTED_PREFIX.length)
  return fromBase64(b64)
}

export async function secureSetItem(key, value, userId) {
  const keyHash = await deriveKey(userId)
  const encrypted = xorCipher(value, keyHash)
  const encoded = encode(encrypted)
  await AsyncStorage.setItem(key, encoded)
}

export async function secureGetItem(key, userId) {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null

  if (!raw.startsWith(ENCRYPTED_PREFIX)) {
    const migrated = await migrateItem(key, raw, userId)
    return migrated
  }

  const keyHash = await deriveKey(userId)
  const decoded = decode(raw)
  if (!decoded) return null
  return xorCipher(decoded, keyHash)
}

export async function secureRemoveItem(key) {
  await AsyncStorage.removeItem(key)
}

async function migrateItem(key, plainValue, userId) {
  await secureSetItem(key, plainValue, userId)
  return plainValue
}

export async function migrateAllHealthData(userId, keys) {
  for (const key of keys) {
    const raw = await AsyncStorage.getItem(key)
    if (raw && !raw.startsWith(ENCRYPTED_PREFIX)) {
      await secureSetItem(key, raw, userId)
    }
  }
}
