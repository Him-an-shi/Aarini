import React, { useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CalendarDays, ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react-native'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Button } from '../components/Button'
import { markOnboardingComplete, saveOnboardingData } from '../utils/onboardingStorage'

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000'

const CYCLE_LENGTHS = Array.from({ length: 15 }, (_, i) => i + 21)
const PERIOD_DURATIONS = [3, 4, 5, 6, 7]
const COMMON_SYMPTOMS = [
  'Cramps',
  'Headaches',
  'Bloating',
  'Fatigue',
  'Mood swings',
  'Back pain',
  'Breast tenderness',
  'Acne',
]

const StepIndicator = ({ current, total, colors }) => (
  <View
    style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 24 }}
    accessibilityRole="progressbar"
    accessibilityValue={{ min: 1, max: total, now: current }}
  >
    {Array.from({ length: total }, (_, i) => (
      <View
        key={i}
        style={{
          width: i + 1 === current ? 24 : 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: i + 1 <= current ? colors.primaryDark : colors.border,
          marginHorizontal: 4,
        }}
      />
    ))}
  </View>
)

export const OnboardingScreen = ({ navigation }) => {
  const { user, userToken, completeOnboarding } = useAuth()
  const { theme } = useTheme()
  const { colors, typography, spacing, borderRadius } = theme
  const styles = useMemo(() => createStyles(theme), [theme])

  const [step, setStep] = useState(1)
  const [cycleLength, setCycleLength] = useState(28)
  const [periodDuration, setPeriodDuration] = useState(5)
  const [lastPeriodDate, setLastPeriodDate] = useState(null)
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const today = useMemo(() => new Date(), [])

  const dateOptions = useMemo(() => {
    const options = []
    for (let i = 0; i < 45; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      options.push(d)
    }
    return options
  }, [today])

  const toggleSymptom = useCallback((symptom) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom],
    )
  }, [])

  const canAdvance = useCallback(() => {
    if (step === 2 && !lastPeriodDate) return false
    return true
  }, [step, lastPeriodDate])

  const handleComplete = useCallback(async () => {
    setSubmitting(true)
    try {
      if (!lastPeriodDate) {
        await saveOnboardingData({
          cycleLength,
          periodDuration,
          commonSymptoms: selectedSymptoms,
          completedAt: new Date().toISOString(),
        })
        await markOnboardingComplete()
        completeOnboarding()
        navigation.replace('Tabs')
        return
      }

      const endDate = new Date(lastPeriodDate)
      endDate.setDate(endDate.getDate() + periodDuration - 1)

      const formatDate = (d) => d.toISOString().split('T')[0]

      const cyclePayload = {
        startDate: formatDate(lastPeriodDate),
        endDate: formatDate(endDate),
        flowIntensity: 'Medium',
        symptoms: selectedSymptoms,
        mood: 'Neutral',
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
        'X-User-Id': user?.uid || 'mock_user_123',
      }

      const response = await fetch(`${BACKEND_URL}/add-cycle`, {
        method: 'POST',
        headers,
        body: JSON.stringify(cyclePayload),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to save cycle data')
      }

      const onboardingData = {
        cycleLength,
        periodDuration,
        lastPeriodStart: formatDate(lastPeriodDate),
        commonSymptoms: selectedSymptoms,
        completedAt: new Date().toISOString(),
      }

      await saveOnboardingData(onboardingData)
      await markOnboardingComplete()
      completeOnboarding()
      navigation.replace('Tabs')
    } catch (err) {
      await saveOnboardingData({
        cycleLength,
        periodDuration,
        lastPeriodStart: lastPeriodDate ? lastPeriodDate.toISOString().split('T')[0] : null,
        commonSymptoms: selectedSymptoms,
        completedAt: new Date().toISOString(),
      })
      await markOnboardingComplete()
      completeOnboarding()
      navigation.replace('Tabs')
    } finally {
      setSubmitting(false)
    }
  }, [
    cycleLength,
    periodDuration,
    lastPeriodDate,
    selectedSymptoms,
    userToken,
    user,
    navigation,
    completeOnboarding,
  ])

  const renderStep1 = () => (
    <View accessibilityLabel="Step 1: Cycle basics">
      <Text style={styles.stepTitle}>Your Cycle Basics</Text>
      <Text style={styles.stepDescription}>
        Help us understand your typical cycle so predictions can start immediately.
      </Text>

      <Text style={styles.fieldLabel}>Average cycle length (days)</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickerRow}
        accessibilityRole="adjustable"
        accessibilityLabel={`Cycle length: ${cycleLength} days`}
      >
        {CYCLE_LENGTHS.map((len) => (
          <TouchableOpacity
            key={len}
            onPress={() => setCycleLength(len)}
            style={[styles.pickerChip, len === cycleLength && styles.pickerChipActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: len === cycleLength }}
            accessibilityLabel={`${len} days`}
          >
            <Text
              style={[styles.pickerChipText, len === cycleLength && styles.pickerChipTextActive]}
            >
              {len}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.fieldLabel, { marginTop: 24 }]}>Typical period duration (days)</Text>
      <View
        style={styles.durationRow}
        accessibilityRole="radiogroup"
        accessibilityLabel="Period duration"
      >
        {PERIOD_DURATIONS.map((dur) => (
          <TouchableOpacity
            key={dur}
            onPress={() => setPeriodDuration(dur)}
            style={[styles.durationChip, dur === periodDuration && styles.durationChipActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: dur === periodDuration }}
            accessibilityLabel={`${dur} days`}
          >
            <Text
              style={[
                styles.durationChipText,
                dur === periodDuration && styles.durationChipTextActive,
              ]}
            >
              {dur}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )

  const renderStep2 = () => (
    <View accessibilityLabel="Step 2: Last period date">
      <Text style={styles.stepTitle}>When Did Your Last Period Start?</Text>
      <Text style={styles.stepDescription}>
        This creates your first cycle entry and enables immediate predictions.
      </Text>

      <ScrollView style={styles.dateList} nestedScrollEnabled>
        {dateOptions.map((date) => {
          const isSelected = lastPeriodDate && date.toDateString() === lastPeriodDate.toDateString()
          const label = formatDateLabel(date, today)
          return (
            <TouchableOpacity
              key={date.toISOString()}
              onPress={() => setLastPeriodDate(date)}
              style={[styles.dateOption, isSelected && styles.dateOptionActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={label}
            >
              <CalendarDays
                size={18}
                color={isSelected ? colors.textOnPrimary : colors.textMedium}
              />
              <Text style={[styles.dateOptionText, isSelected && styles.dateOptionTextActive]}>
                {label}
              </Text>
              {isSelected && <Check size={18} color={colors.textOnPrimary} />}
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )

  const renderStep3 = () => (
    <View accessibilityLabel="Step 3: Common symptoms">
      <Text style={styles.stepTitle}>Common Symptoms</Text>
      <Text style={styles.stepDescription}>
        Select symptoms you typically experience. We'll prompt you to track these during your cycle.
      </Text>

      <View style={styles.symptomGrid}>
        {COMMON_SYMPTOMS.map((symptom) => {
          const isSelected = selectedSymptoms.includes(symptom)
          return (
            <TouchableOpacity
              key={symptom}
              onPress={() => toggleSymptom(symptom)}
              style={[styles.symptomChip, isSelected && styles.symptomChipActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={symptom}
            >
              <Text style={[styles.symptomChipText, isSelected && styles.symptomChipTextActive]}>
                {symptom}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <Text style={[styles.hintText, { marginTop: 16 }]}>
        You can skip this step if you're not sure yet.
      </Text>
    </View>
  )

  const renderStep4 = () => (
    <View accessibilityLabel="Step 4: Summary" style={styles.summaryContainer}>
      <Sparkles
        size={48}
        color={colors.primaryDark}
        style={{ alignSelf: 'center', marginBottom: 16 }}
      />
      <Text style={styles.stepTitle}>You're All Set!</Text>
      <Text style={styles.stepDescription}>
        Here's what we'll use to start your personalized predictions:
      </Text>

      <View style={styles.summaryCard}>
        <SummaryRow label="Cycle length" value={`${cycleLength} days`} colors={colors} />
        <SummaryRow label="Period duration" value={`${periodDuration} days`} colors={colors} />
        <SummaryRow
          label="Last period started"
          value={lastPeriodDate ? formatDateLabel(lastPeriodDate, today) : 'Not provided'}
          colors={colors}
        />
        <SummaryRow
          label="Tracked symptoms"
          value={selectedSymptoms.length > 0 ? selectedSymptoms.join(', ') : 'None selected'}
          colors={colors}
        />
      </View>

      <Text style={[styles.hintText, { marginTop: 16, textAlign: 'center' }]}>
        Predictions improve with each cycle you log. The more data, the more accurate your insights
        become.
      </Text>
    </View>
  )

  return (
    <LinearGradient colors={theme.gradient} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <StepIndicator current={step} total={4} colors={colors} />

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity
              onPress={() => setStep((s) => s - 1)}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={20} color={colors.primaryDark} />
              <Text style={[typography.bodyMedium, { color: colors.primaryDark, marginLeft: 4 }]}>
                Back
              </Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {step < 4 ? (
            <Button
              title="Continue"
              onPress={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              style={styles.nextButton}
              icon={
                <ChevronRight
                  size={18}
                  color={canAdvance() ? colors.textOnPrimary : colors.textLight}
                />
              }
            />
          ) : (
            <Button
              title="Start Tracking"
              onPress={handleComplete}
              loading={submitting}
              style={styles.nextButton}
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}

const SummaryRow = ({ label, value, colors }) => (
  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}
  >
    <Text style={{ fontSize: 14, color: colors.textLight }}>{label}</Text>
    <Text
      style={{
        fontSize: 14,
        color: colors.textDark,
        fontWeight: '500',
        maxWidth: '55%',
        textAlign: 'right',
      }}
    >
      {value}
    </Text>
  </View>
)

function formatDateLabel(date, today) {
  const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24))
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (diffDays === 0) return `Today (${dateStr})`
  if (diffDays === 1) return `Yesterday (${dateStr})`
  if (diffDays < 7) return `${diffDays} days ago (${dateStr})`
  if (diffDays < 14) return `Last week (${dateStr})`
  return dateStr
}

const createStyles = ({ colors, spacing, borderRadius, typography, shadows }) =>
  StyleSheet.create({
    container: { flex: 1 },
    safe: {
      flex: 1,
      paddingTop: Platform.OS === 'android' ? 40 : 16,
      paddingHorizontal: spacing.lg,
    },
    content: { flex: 1 },
    contentContainer: { paddingBottom: 24 },
    stepTitle: { ...typography.h2, marginBottom: 8 },
    stepDescription: {
      ...typography.bodyLarge,
      color: colors.textMedium,
      marginBottom: 24,
      lineHeight: 22,
    },
    fieldLabel: {
      ...typography.bodyMedium,
      fontWeight: '600',
      color: colors.textDark,
      marginBottom: 12,
    },
    pickerRow: { paddingVertical: 4 },
    pickerChip: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.cardBackground,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      ...shadows.light,
    },
    pickerChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
    pickerChipText: { ...typography.bodyMedium, fontWeight: '600', color: colors.textMedium },
    pickerChipTextActive: { color: colors.textOnPrimary },
    durationRow: { flexDirection: 'row', gap: 10 },
    durationChip: {
      flex: 1,
      height: 48,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.cardBackground,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.light,
    },
    durationChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
    durationChipText: { ...typography.bodyMedium, fontWeight: '600', color: colors.textMedium },
    durationChipTextActive: { color: colors.textOnPrimary },
    dateList: {
      maxHeight: 320,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.cardBackground,
      padding: 8,
    },
    dateOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: borderRadius.md,
      marginBottom: 4,
    },
    dateOptionActive: { backgroundColor: colors.primaryDark },
    dateOptionText: { ...typography.bodyMedium, marginLeft: 12, flex: 1, color: colors.textDark },
    dateOptionTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
    symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    symptomChip: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.cardBackground,
      borderWidth: 1.5,
      borderColor: colors.border,
      ...shadows.light,
    },
    symptomChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    symptomChipText: { ...typography.bodyMedium, color: colors.textMedium },
    symptomChipTextActive: { color: colors.primaryDark, fontWeight: '600' },
    hintText: { ...typography.bodySmall, color: colors.textLight },
    summaryContainer: { paddingTop: 16 },
    summaryCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.light,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 8 },
    nextButton: { width: 160 },
  })
