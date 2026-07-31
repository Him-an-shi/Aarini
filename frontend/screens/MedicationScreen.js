import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { ArrowLeft, Check, Pill, Plus, Trash2 } from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../i18n/LanguageContext'
import {
  addMedication,
  deleteMedication,
  getAdherence,
  getMedications,
  getAdherenceForMonth,
  getTodayAdherence,
  markTaken,
  unmarkAdherence,
} from '../services/medicationService'

const HOUR_OPTIONS = [6, 7, 8, 9, 10, 12, 14, 18, 20, 22]

const formatHour = (h) => {
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${display}:00 ${period}`
}

export const MedicationScreen = ({ navigation }) => {
  const { theme } = useTheme()
  const { t } = useLanguage()
  const { colors, typography, spacing, borderRadius, shadows } = theme
  const styles = useMemo(() => createStyles(theme), [theme])

  const [medications, setMedications] = useState([])
  const [adherence, setAdherence] = useState({})
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDosage, setNewDosage] = useState('')
  const [newHour, setNewHour] = useState(8)
  const [selectedMed, setSelectedMed] = useState(null)

  const loadData = useCallback(async () => {
    const meds = await getMedications()
    const adh = await getAdherence()
    setMedications(meds)
    setAdherence(adh)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAdd = async () => {
    if (!newName.trim()) return
    await addMedication({ name: newName.trim(), dosage: newDosage.trim(), reminderHour: newHour })
    setNewName('')
    setNewDosage('')
    setNewHour(8)
    setAddModalVisible(false)
    await loadData()
  }

  const handleToggleTaken = async (medId) => {
    const status = getTodayAdherence(adherence, medId)
    if (status === 'taken') {
      await unmarkAdherence(medId)
    } else {
      await markTaken(medId)
    }
    await loadData()
  }

  const handleDelete = (med) => {
    Alert.alert(t('medication.deleteTitle'), t('medication.deleteConfirm', { name: med.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('medication.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteMedication(med.id)
          await loadData()
        },
      },
    ])
  }

  const now = new Date()
  const monthDays = selectedMed
    ? getAdherenceForMonth(adherence, selectedMed.id, now.getFullYear(), now.getMonth())
    : []

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[typography.h2, styles.headerTitle]}>{t('medication.title')}</Text>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={styles.addButton}
            accessibilityLabel={t('medication.add')}
          >
            <Plus size={20} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>

        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <Pill size={40} color={colors.textLight} />
            <Text style={styles.emptyText}>{t('medication.empty')}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setAddModalVisible(true)}>
              <Plus size={18} color={colors.white} />
              <Text style={styles.primaryButtonText}>{t('medication.add')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>{t('medication.today')}</Text>
            {medications
              .filter((m) => m.active)
              .map((med) => {
                const status = getTodayAdherence(adherence, med.id)
                return (
                  <TouchableOpacity
                    key={med.id}
                    style={[styles.medCard, status === 'taken' && styles.medCardTaken]}
                    onPress={() => handleToggleTaken(med.id)}
                    onLongPress={() => setSelectedMed(selectedMed?.id === med.id ? null : med)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: status === 'taken' }}
                  >
                    <View style={[styles.checkbox, status === 'taken' && styles.checkboxChecked]}>
                      {status === 'taken' && <Check size={14} color={colors.white} />}
                    </View>
                    <View style={styles.medInfo}>
                      <Text style={[styles.medName, status === 'taken' && styles.medNameTaken]}>
                        {med.name}
                      </Text>
                      {med.dosage ? <Text style={styles.medDosage}>{med.dosage}</Text> : null}
                    </View>
                    <Text style={styles.medTime}>{formatHour(med.reminderHour)}</Text>
                    <TouchableOpacity
                      onPress={() => handleDelete(med)}
                      hitSlop={8}
                      accessibilityLabel={`Delete ${med.name}`}
                    >
                      <Trash2 size={16} color={colors.textLight} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )
              })}

            {selectedMed && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
                  {t('medication.history', { name: selectedMed.name })}
                </Text>
                <View style={styles.historyGrid}>
                  {monthDays.map(({ date, status }) => (
                    <View
                      key={date}
                      style={[
                        styles.historyDay,
                        status === 'taken' && styles.historyTaken,
                        status === 'skipped' && styles.historySkipped,
                      ]}
                    >
                      <Text style={styles.historyDayText}>{parseInt(date.slice(-2), 10)}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.historyLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.historyTaken]} />
                    <Text style={styles.legendText}>{t('medication.taken')}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.historySkipped]} />
                    <Text style={styles.legendText}>{t('medication.skipped')}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.mutedBackground }]} />
                    <Text style={styles.legendText}>{t('medication.noData')}</Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.h2}>{t('medication.addTitle')}</Text>
            <Text style={styles.inputLabel}>{t('medication.nameLabel')}</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={t('medication.namePlaceholder')}
              placeholderTextColor={colors.textLight}
              style={styles.input}
            />
            <Text style={styles.inputLabel}>{t('medication.dosageLabel')}</Text>
            <TextInput
              value={newDosage}
              onChangeText={setNewDosage}
              placeholder={t('medication.dosagePlaceholder')}
              placeholderTextColor={colors.textLight}
              style={styles.input}
            />
            <Text style={styles.inputLabel}>{t('medication.reminderTime')}</Text>
            <View style={styles.chipRow}>
              {HOUR_OPTIONS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, newHour === h && styles.chipActive]}
                  onPress={() => setNewHour(h)}
                >
                  <Text style={[styles.chipText, newHour === h && styles.chipTextActive]}>
                    {formatHour(h)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAdd}
              disabled={!newName.trim()}
            >
              <Text style={styles.primaryButtonText}>{t('medication.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setAddModalVisible(false)}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.bodyMedium, color: colors.textMedium, textAlign: 'center' },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primaryDark,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
    },
    primaryButtonText: { ...typography.buttonText, color: colors.white },
    sectionLabel: {
      ...typography.caption,
      color: colors.textMedium,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    medCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.md,
      ...shadows.light,
    },
    medCardTaken: { opacity: 0.7 },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
    medInfo: { flex: 1 },
    medName: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '600' },
    medNameTaken: { textDecorationLine: 'line-through', color: colors.textLight },
    medDosage: { ...typography.caption, color: colors.textMedium, marginTop: 2 },
    medTime: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
    historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    historyDay: {
      width: 32,
      height: 32,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.mutedBackground,
    },
    historyTaken: { backgroundColor: colors.successDark || '#2E7D32' },
    historySkipped: { backgroundColor: colors.errorDark || '#C62828' },
    historyDayText: { ...typography.caption, color: colors.white, fontWeight: '700', fontSize: 10 },
    historyLegend: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { ...typography.caption, color: colors.textMedium },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.cardBackground,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    inputLabel: {
      ...typography.bodySmall,
      color: colors.textDark,
      fontWeight: '700',
      marginBottom: 6,
      marginTop: spacing.md,
    },
    input: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      color: colors.textDark,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.mutedBackground,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
    chipText: { ...typography.caption, color: colors.textMedium, fontWeight: '600' },
    chipTextActive: { color: colors.white },
    cancelButton: { alignItems: 'center', padding: spacing.md, marginTop: spacing.sm },
    cancelText: { ...typography.bodyMedium, color: colors.textMedium, fontWeight: '700' },
  })
