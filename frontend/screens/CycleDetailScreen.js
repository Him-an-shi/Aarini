import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Trash2, Save, Calendar, Droplets, Activity } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateCycle, deleteCycle } from '../services/cycleService';

export const CycleDetailScreen = ({ route, navigation }) => {
  const { cycle } = route.params;
  const { user, userToken } = useAuth();
  const { theme } = useTheme();
  const { colors, typography, spacing, borderRadius } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [startDate, setStartDate] = useState(cycle.startDate || '');
  const [endDate, setEndDate] = useState(cycle.endDate || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = useCallback(async () => {
    if (!startDate || !endDate) {
      Alert.alert('Validation', 'Both start and end dates are required.');
      return;
    }
    setSaving(true);
    try {
      await updateCycle(userToken, user?.uid, cycle.id, { startDate, endDate });
      Alert.alert('Success', 'Cycle updated.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }, [startDate, endDate, userToken, user, cycle.id, navigation]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Cycle',
      'Permanently remove this cycle entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteCycle(userToken, user?.uid, cycle.id);
              Alert.alert('Deleted', 'Cycle entry removed.');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [userToken, user, cycle.id, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[typography.h2, styles.headerTitle]}>Edit Cycle</Text>
        <TouchableOpacity onPress={handleDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator size="small" color={colors.errorDark} />
          ) : (
            <Trash2 size={20} color={colors.errorDark} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>START DATE</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textLight}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>END DATE</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textLight}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.savingButton]}
          onPress={handleSave}
          disabled={saving}
        >
          <Save size={18} color={colors.white} />
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, typography, spacing, borderRadius }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  backButton: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardBackground },
  headerTitle: { flex: 1, textAlign: 'center' },
  content: { padding: spacing.lg },
  card: { backgroundColor: colors.cardBackground, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textMedium, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.textDark, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  saveButton: { minHeight: 50, borderRadius: borderRadius.md, backgroundColor: colors.primaryDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  savingButton: { opacity: 0.7 },
  saveText: { ...typography.buttonText, color: colors.white },
});
