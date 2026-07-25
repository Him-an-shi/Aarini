/**
 * HealthAlertCard: dismissible in-app alert for detected health anomalies.
 * Non-alarming tone with educational context and medical disclaimer.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';

export function HealthAlertCard({ alert, onDismiss }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors } = theme;

  const getMessage = () => {
    switch (alert.type) {
      case 'latePeriod':
        return t('healthAlerts.latePeriod', { days: alert.daysLate });
      case 'moodStreak':
        return t('healthAlerts.moodStreak', { days: alert.consecutiveDays });
      case 'medicationGap':
        return t('healthAlerts.medicationGap', { name: alert.medicationName, days: alert.consecutiveMissed });
      case 'symptomSeverity':
        return t('healthAlerts.symptomSeverity', { symptom: alert.symptomName, days: alert.consecutiveDays });
      case 'cycleIrregularity':
        return t('healthAlerts.cycleIrregularity', { deviation: alert.deviation });
      default:
        return '';
    }
  };

  const getContext = () => {
    switch (alert.type) {
      case 'latePeriod':
        return t('healthAlerts.latePeriodContext');
      case 'moodStreak':
        return t('healthAlerts.moodStreakContext');
      case 'medicationGap':
        return t('healthAlerts.medicationGapContext');
      case 'symptomSeverity':
        return t('healthAlerts.symptomSeverityContext');
      case 'cycleIrregularity':
        return t('healthAlerts.cycleIrregularityContext');
      default:
        return '';
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: '#f59e0b33' }]}>
      <View style={styles.header}>
        <AlertTriangle size={18} color="#f59e0b" />
        <Text style={[styles.title, { color: colors.text }]}>{getMessage()}</Text>
        <TouchableOpacity onPress={() => onDismiss(alert.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={16} color={colors.textLight} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.context, { color: colors.textMedium }]}>{getContext()}</Text>
      <Text style={[styles.disclaimer, { color: colors.textLight }]}>
        {t('healthAlerts.disclaimer')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  context: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  disclaimer: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
