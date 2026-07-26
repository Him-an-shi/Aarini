import React, { useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { ArrowLeft, Link, Copy, XCircle, Clock, Shield } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000'

export const ShareScreen = ({ navigation }) => {
  const { userToken, user } = useAuth()
  const { theme } = useTheme()
  const { colors, typography, spacing, borderRadius, shadows } = theme
  const styles = useMemo(() => createStyles(theme), [theme])

  const [creating, setCreating] = useState(false)
  const [links, setLinks] = useState([])
  const [expiryDays, setExpiryDays] = useState(7)

  const getHeaders = useCallback(() => {
    const headers = { 'Content-Type': 'application/json' }
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`
    } else {
      headers['X-User-Id'] = user?.uid || 'mock_user_123'
    }
    return headers
  }, [userToken, user])

  const handleCreateLink = async () => {
    setCreating(true)
    try {
      const resp = await fetch(`${API_BASE}/share/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ expiresInDays: expiryDays }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error)

      setLinks((prev) => [{ ...data, createdAt: Date.now() }, ...prev])
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not create share link.')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (token) => {
    const url = `${API_BASE}/share/view/${token}`
    await Clipboard.setStringAsync(url)
    Alert.alert('Copied', 'Share link copied to clipboard. Send it to your partner or doctor.')
  }

  const handleRevoke = async (token) => {
    try {
      const resp = await fetch(`${API_BASE}/share/revoke`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ token }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error)
      }
      setLinks((prev) => prev.filter((l) => l.token !== token))
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not revoke link.')
    }
  }

  const expiryOptions = [7, 14, 30]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {navigation?.canGoBack?.() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={22} color={colors.textDark} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
          <Text style={[typography.h2, styles.headerTitle]}>Share Cycle Data</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Link size={20} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>Generate Share Link</Text>
              <Text style={styles.cardSubtitle}>
                Create a read-only link for your partner or healthcare provider
              </Text>
            </View>
          </View>

          <View style={styles.privacyNote}>
            <Shield size={14} color={colors.textMedium} />
            <Text style={styles.privacyNoteText}>
              Recipients can only view cycle dates and predictions. No personal details are shared.
            </Text>
          </View>

          <Text style={styles.label}>Link expires after:</Text>
          <View style={styles.expiryRow}>
            {expiryOptions.map((days) => (
              <TouchableOpacity
                key={days}
                style={[styles.expiryChip, expiryDays === days && styles.expiryChipActive]}
                onPress={() => setExpiryDays(days)}
                accessibilityLabel={`Expire in ${days} days`}
              >
                <Text
                  style={[
                    styles.expiryChipText,
                    expiryDays === days && styles.expiryChipTextActive,
                  ]}
                >
                  {days} days
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateLink}
            disabled={creating}
            accessibilityLabel="Create a new share link"
          >
            {creating ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <>
                <Link size={18} color={colors.textOnPrimary} />
                <Text style={styles.createButtonText}>Create Link</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {links.length > 0 && (
          <View style={styles.card}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Active Links</Text>
            {links.map((link) => (
              <View key={link.token} style={styles.linkItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkToken} numberOfLines={1}>
                    {link.token}
                  </Text>
                  <View style={styles.linkMeta}>
                    <Clock size={12} color={colors.textLight} />
                    <Text style={styles.linkMetaText}>Expires in {link.expiresInDays} days</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleCopy(link.token)}
                  style={styles.iconButton}
                  accessibilityLabel="Copy link"
                >
                  <Copy size={18} color={colors.primaryDark} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRevoke(link.token)}
                  style={styles.iconButton}
                  accessibilityLabel="Revoke link"
                >
                  <XCircle size={18} color={colors.error || '#DC2626'} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = ({ colors, typography, spacing, borderRadius, shadows }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBackground,
    },
    headerTitle: { flex: 1, textAlign: 'center' },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.light,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: colors.mutedBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    cardSubtitle: { ...typography.bodySmall, color: colors.textMedium, marginTop: 2 },
    privacyNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.mutedBackground,
      padding: spacing.sm,
      borderRadius: borderRadius.sm,
      marginBottom: spacing.md,
    },
    privacyNoteText: { ...typography.bodySmall, color: colors.textMedium, flex: 1 },
    label: { ...typography.bodyMedium, color: colors.textDark, marginBottom: spacing.xs },
    expiryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    expiryChip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    expiryChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
    expiryChipText: { ...typography.bodySmall, color: colors.textMedium },
    expiryChipTextActive: { color: colors.textOnPrimary },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 14,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primaryDark,
    },
    createButtonText: { ...typography.buttonText, color: colors.textOnPrimary },
    linkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    linkToken: { ...typography.bodyMedium, color: colors.textDark, fontFamily: 'monospace' },
    linkMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    linkMetaText: { ...typography.bodySmall, color: colors.textLight },
    iconButton: { padding: spacing.sm },
  })
