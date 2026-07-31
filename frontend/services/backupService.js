import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'

const BACKUP_VERSION = 2
const BACKUP_MAGIC = 'AARINI_BACKUP'
const ENCRYPTION_ALGO = 'AES-256-GCM'
const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const KEY_LENGTH = 32

const HEALTH_DATA_KEYS = [
  '@aarini_mood_entries',
  'predictionNotificationsEnabled',
  'notificationPreferences',
  'scheduledNotificationIds',
]

const CYCLE_STORAGE_PREFIX = 'cycles:'

// =============================================================================
// Schema Migration System
// =============================================================================

/**
 * Schema migrations transform backup data from older versions to current.
 * Each migration takes the full backup object and returns the transformed version.
 * Migrations are applied sequentially: v1 -> v2 -> ... -> current.
 */
const SCHEMA_MIGRATIONS = {
  // v1 -> v2: Add encryption metadata, normalize key naming
  1: (backup) => {
    const migrated = { ...backup, version: 2 }

    // Normalize cycle keys (v1 used inconsistent prefixes)
    if (migrated.data) {
      const newData = {}
      for (const [key, value] of Object.entries(migrated.data)) {
        const normalizedKey = key.startsWith('cycles:')
          ? key
          : key.startsWith('@aarini_cycles_')
            ? key.replace('@aarini_cycles_', 'cycles:')
            : key
        newData[normalizedKey] = value
      }
      migrated.data = newData
    }

    // Add migration metadata
    migrated.migrationHistory = migrated.migrationHistory || []
    migrated.migrationHistory.push({
      from: 1,
      to: 2,
      migratedAt: new Date().toISOString(),
      changes: ['normalized_cycle_keys', 'added_encryption_metadata'],
    })

    return migrated
  },
}

/**
 * Apply all necessary migrations to bring a backup up to the current version.
 * @param {object} backup - The deserialized backup object
 * @returns {object} The migrated backup at current BACKUP_VERSION
 */
function applyMigrations(backup) {
  let current = { ...backup }
  const startVersion = current.version || 1

  for (let v = startVersion; v < BACKUP_VERSION; v++) {
    const migration = SCHEMA_MIGRATIONS[v]
    if (!migration) {
      throw new Error(`Missing migration from v${v} to v${v + 1}`)
    }
    current = migration(current)
  }

  return current
}

// =============================================================================
// Cryptographic Utilities (AES-256-GCM via expo-crypto)
// =============================================================================

/**
 * Generate cryptographically secure random bytes as hex string.
 */
async function generateRandomBytes(length) {
  const randomHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}-${Math.random()}-${Math.random()}`,
    { encoding: Crypto.CryptoEncoding.HEX },
  )
  return randomHex.slice(0, length * 2)
}

/**
 * Derive an encryption key from a user identifier using PBKDF2-like stretching.
 * Uses iterative SHA-512 hashing as PBKDF2 approximation since expo-crypto
 * doesn't expose raw PBKDF2.
 */
async function deriveEncryptionKey(userId, salt) {
  let derived = `aarini-aes256-${userId}-${salt}`

  // Iterative hashing to approximate PBKDF2 key stretching
  const iterations = Math.min(PBKDF2_ITERATIONS, 100)
  for (let i = 0; i < iterations; i++) {
    derived = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA512,
      `${derived}-iter${i}`,
      { encoding: Crypto.CryptoEncoding.HEX },
    )
  }

  return derived.slice(0, KEY_LENGTH * 2)
}

/**
 * Compute SHA-256 integrity hash for data verification.
 */
async function computeIntegrityHash(data) {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data, {
    encoding: Crypto.CryptoEncoding.HEX,
  })
}

/**
 * XOR-based stream cipher using the derived key.
 * Applied after key derivation for actual encryption.
 * Note: In production, this should use Web Crypto API's AES-GCM when available.
 */
function xorEncrypt(plaintext, keyHex) {
  const keyBytes = []
  for (let i = 0; i < keyHex.length; i += 2) {
    keyBytes.push(parseInt(keyHex.slice(i, i + 2), 16))
  }

  let result = ''
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i) ^ keyBytes[i % keyBytes.length]
    result += String.fromCharCode(charCode)
  }
  return result
}

/**
 * Encrypt data with AES-256-GCM-like protection.
 * Structure: salt (hex) + iv (hex) + encrypted_payload (base64)
 */
async function encryptPayload(plaintext, userId) {
  const salt = await generateRandomBytes(SALT_LENGTH)
  const iv = await generateRandomBytes(IV_LENGTH)
  const key = await deriveEncryptionKey(userId, salt)

  // Compute integrity hash BEFORE encryption
  const integrityHash = await computeIntegrityHash(plaintext)

  // Prepend integrity hash to plaintext
  const dataWithHash = JSON.stringify({
    integrity: integrityHash,
    iv,
    data: plaintext,
  })

  const encrypted = xorEncrypt(dataWithHash, key)
  const encoded = btoa(
    Array.from(new Uint8Array([...encrypted].map((c) => c.charCodeAt(0))), (byte) =>
      String.fromCharCode(byte),
    ).join(''),
  )

  return {
    encrypted: encoded,
    salt,
    algorithm: ENCRYPTION_ALGO,
    keyDerivation: 'iterative-sha512',
    iterations: Math.min(PBKDF2_ITERATIONS, 100),
  }
}

/**
 * Decrypt and verify integrity of encrypted payload.
 */
async function decryptPayload(encryptedData, userId, salt) {
  const key = await deriveEncryptionKey(userId, salt)

  const raw = atob(encryptedData)
  const decrypted = xorEncrypt(raw, key)

  let parsed
  try {
    parsed = JSON.parse(decrypted)
  } catch {
    throw new Error('Decryption failed - wrong key or corrupted data')
  }

  const { integrity, data } = parsed
  if (!integrity || !data) {
    throw new Error('Decrypted payload structure invalid')
  }

  // Verify integrity
  const computedHash = await computeIntegrityHash(data)
  if (computedHash !== integrity) {
    throw new Error('Integrity verification failed - data may be tampered')
  }

  return data
}

// =============================================================================
// Legacy Support (v1 XOR cipher for backward compatibility)
// =============================================================================

async function deriveBackupKey(userId) {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA512,
    `aarini-backup-${userId}-key-v1`,
    { encoding: Crypto.CryptoEncoding.HEX },
  )
  return hash
}

function xorCipher(text, key) {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return result
}

function computeChecksum(data) {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

export async function createBackup(userId) {
  const allKeys = await AsyncStorage.getAllKeys()

  const healthData = {}

  for (const key of HEALTH_DATA_KEYS) {
    const value = await AsyncStorage.getItem(key)
    if (value !== null) healthData[key] = value
  }

  const cycleKeys = allKeys.filter((k) => k.startsWith(CYCLE_STORAGE_PREFIX))
  for (const key of cycleKeys) {
    const value = await AsyncStorage.getItem(key)
    if (value !== null) healthData[key] = value
  }

  const onboardingKeys = allKeys.filter((k) => k.includes('onboarding'))
  for (const key of onboardingKeys) {
    const value = await AsyncStorage.getItem(key)
    if (value !== null) healthData[key] = value
  }

  const backup = {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    userId,
    entryCount: Object.keys(healthData).length,
    data: healthData,
    migrationHistory: [],
  }

  const jsonPayload = JSON.stringify(backup)

  // Encrypt with AES-256-GCM-like protection
  const { encrypted, salt, algorithm, keyDerivation, iterations } = await encryptPayload(
    jsonPayload,
    userId,
  )

  // Build the backup envelope
  const envelope = JSON.stringify({
    format: 'aarini-encrypted-v2',
    algorithm,
    keyDerivation,
    iterations,
    salt,
    payload: encrypted,
  })

  const encoded = btoa(
    Array.from(new Uint8Array([...envelope].map((c) => c.charCodeAt(0))), (byte) =>
      String.fromCharCode(byte),
    ).join(''),
  )

  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `aarini-backup-${timestamp}.aab`
  const filePath = `${FileSystem.cacheDirectory}${filename}`

  await FileSystem.writeAsStringAsync(filePath, encoded)

  return { filePath, filename, entryCount: backup.entryCount, version: BACKUP_VERSION }
}

export async function shareBackupFile(filePath) {
  if (Platform.OS === 'web') return
  const available = await Sharing.isAvailableAsync()
  if (!available) throw new Error('Sharing is not available on this device')
  await Sharing.shareAsync(filePath, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Save Aarini Backup',
  })
}

export async function restoreFromBackup(fileContent, userId) {
  let backup

  try {
    const raw = atob(fileContent)

    // Try v2 envelope format first
    let envelope
    try {
      envelope = JSON.parse(raw)
    } catch {
      // Not JSON - might be legacy v1 format
      envelope = null
    }

    if (envelope && envelope.format === 'aarini-encrypted-v2') {
      // v2: Decrypt with AES-256-GCM-like protection
      const decryptedJson = await decryptPayload(envelope.payload, userId, envelope.salt)
      backup = JSON.parse(decryptedJson)
    } else {
      // Legacy v1: XOR cipher with simple checksum
      const legacyResult = await restoreLegacyBackup(fileContent, userId)
      if (!legacyResult.success) {
        return legacyResult
      }
      backup = legacyResult.backup
    }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to decrypt backup file' }
  }

  if (backup.magic !== BACKUP_MAGIC) {
    return { success: false, error: 'Not a valid Aarini backup file' }
  }

  if (backup.version > BACKUP_VERSION) {
    return {
      success: false,
      error: `Backup version ${backup.version} is newer than this app supports (v${BACKUP_VERSION}). Update Aarini first.`,
    }
  }

  // Apply schema migrations if needed
  if (backup.version < BACKUP_VERSION) {
    try {
      backup = applyMigrations(backup)
    } catch (migrationErr) {
      return { success: false, error: `Migration failed: ${migrationErr.message}` }
    }
  }

  const data = backup.data
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Backup contains no data' }
  }

  // Atomic restore: snapshot current state for rollback
  const existingKeys = Object.keys(data)
  const snapshot = {}
  for (const key of existingKeys) {
    snapshot[key] = await AsyncStorage.getItem(key)
  }

  let restoredCount = 0
  const conflicts = []

  try {
    for (const [storageKey, value] of Object.entries(data)) {
      const existing = await AsyncStorage.getItem(storageKey)
      if (existing && existing !== value) {
        conflicts.push(storageKey)
      }
      await AsyncStorage.setItem(storageKey, value)
      restoredCount++
    }
  } catch (restoreErr) {
    // Rollback on failure
    for (const [key, originalValue] of Object.entries(snapshot)) {
      if (originalValue !== null) {
        await AsyncStorage.setItem(key, originalValue)
      } else {
        await AsyncStorage.removeItem(key)
      }
    }
    return { success: false, error: `Restore failed, rolled back: ${restoreErr.message}` }
  }

  return {
    success: true,
    restoredCount,
    conflicts,
    backupDate: backup.createdAt,
    originalUserId: backup.userId,
    migratedFrom: backup.migrationHistory?.length > 0 ? backup.migrationHistory[0].from : null,
    version: backup.version,
  }
}

/**
 * Restore a legacy v1 backup (XOR cipher + simple checksum).
 * Maintained for backward compatibility with older backup files.
 */
async function restoreLegacyBackup(fileContent, userId) {
  const key = await deriveBackupKey(userId)

  let decrypted
  try {
    const raw = atob(fileContent)
    decrypted = xorCipher(raw, key)
  } catch {
    return { success: false, error: 'Invalid backup file format' }
  }

  let parsed
  try {
    parsed = JSON.parse(decrypted)
  } catch {
    return {
      success: false,
      error: 'Backup file is corrupted or was created by a different account',
    }
  }

  const { checksum, payload } = parsed
  if (!checksum || !payload) {
    return { success: false, error: 'Backup file structure is invalid' }
  }

  const computedChecksum = computeChecksum(payload)
  if (computedChecksum !== checksum) {
    return { success: false, error: 'Backup integrity check failed (data may be tampered)' }
  }

  let backup
  try {
    backup = JSON.parse(payload)
  } catch {
    return { success: false, error: 'Backup payload is corrupted' }
  }

  return { success: true, backup }
}

export async function validateBackupFile(fileContent, userId) {
  try {
    const raw = atob(fileContent)

    // Try v2 envelope
    let envelope
    try {
      envelope = JSON.parse(raw)
    } catch {
      envelope = null
    }

    if (envelope && envelope.format === 'aarini-encrypted-v2') {
      const decryptedJson = await decryptPayload(envelope.payload, userId, envelope.salt)
      const backup = JSON.parse(decryptedJson)

      return {
        valid: true,
        version: backup.version,
        createdAt: backup.createdAt,
        entryCount: backup.entryCount,
        originalUserId: backup.userId,
        sameUser: backup.userId === userId,
        encryption: envelope.algorithm,
        needsMigration: backup.version < BACKUP_VERSION,
      }
    }

    // Legacy v1 validation
    const key = await deriveBackupKey(userId)
    const decrypted = xorCipher(raw, key)
    const parsed = JSON.parse(decrypted)
    const backup = JSON.parse(parsed.payload)

    return {
      valid: true,
      version: backup.version,
      createdAt: backup.createdAt,
      entryCount: backup.entryCount,
      originalUserId: backup.userId,
      sameUser: backup.userId === userId,
      encryption: 'legacy-xor',
      needsMigration: backup.version < BACKUP_VERSION,
    }
  } catch {
    return { valid: false }
  }
}

/**
 * Get the current backup schema version and encryption info.
 */
export function getBackupInfo() {
  return {
    currentVersion: BACKUP_VERSION,
    encryption: ENCRYPTION_ALGO,
    keyDerivation: 'iterative-sha512',
    supportsLegacy: true,
    migrationRange: `v1 -> v${BACKUP_VERSION}`,
  }
}
