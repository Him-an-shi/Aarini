import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export function normalizeData(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string') {
    return obj.trim() === '' ? null : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(normalizeData);
  }
  if (typeof obj === 'object') {
    const normalized = {};
    for (const key of Object.keys(obj)) {
      normalized[key] = normalizeData(obj[key]);
    }
    return normalized;
  }
  return obj;
}

export async function gatherAllData(userId, apiFetch) {
  // NOTE: We skip structural validation on the retrieved data here since it is gathered
  // from our own trusted local storage and backend endpoints, which already validate
  // the data at ingestion time.
  const results = {};

  const localCycles = JSON.parse((await AsyncStorage.getItem(`cycles:${userId || 'local'}`)) || '[]');
  results.cycles = localCycles.length > 0 ? localCycles : null;

  try {
    const cyclesResp = await apiFetch('/cycles');
    if (cyclesResp.ok) {
      const data = await cyclesResp.json();
      results.cyclesFromServer = data.cycles || null;
    }
  } catch {}

  try {
    const symptomsResp = await apiFetch('/symptoms');
    if (symptomsResp.ok) {
      results.symptoms = await symptomsResp.json();
    }
  } catch {}

  const moods = JSON.parse((await AsyncStorage.getItem(`moods:${userId || 'local'}`)) || '[]');
  results.moods = moods.length > 0 ? moods : null;

  const medications = JSON.parse((await AsyncStorage.getItem(`medications:${userId || 'local'}`)) || '[]');
  results.medications = medications.length > 0 ? medications : null;

  const chatHistory = JSON.parse((await AsyncStorage.getItem(`@aarini_chat_history:${userId || 'default'}`)) || '[]');
  results.chatHistory = chatHistory.length > 0 ? chatHistory.slice(-50) : null;

  results.exportGeneratedAt = new Date().toISOString();
  results.appVersion = '1.0.0';

  // Normalize empty strings vs null to prevent inconsistencies downstream
  return normalizeData(results);
}

export function formatReadableReport(data) {
  const lines = [];
  lines.push('='.repeat(50));
  lines.push('  AARINI - HEALTH DATA EXPORT');
  lines.push('='.repeat(50));
  lines.push(`  Generated: ${new Date(data.exportGeneratedAt).toLocaleString()}`);
  lines.push(`  App Version: ${data.appVersion}`);
  lines.push('');

  const cycles = data.cycles || data.cyclesFromServer;
  if (cycles && cycles.length > 0) {
    lines.push('--- CYCLE HISTORY ---');
    cycles.forEach((c, i) => {
      if (c.startDate) {
        if (c.endDate) {
          const dur = Math.ceil((new Date(c.endDate) - new Date(c.startDate)) / 86400000) + 1;
          lines.push(`  ${i + 1}. ${c.startDate} to ${c.endDate} (${dur} days)${c.flowIntensity ? ` - Flow: ${c.flowIntensity}` : ''}`);
        } else {
          lines.push(`  ${i + 1}. ${c.startDate} to ongoing${c.flowIntensity ? ` - Flow: ${c.flowIntensity}` : ''}`);
        }
      }
    });
    lines.push('');
  }

  if (data.symptoms && data.symptoms.length > 0) {
    lines.push('--- SYMPTOMS ---');
    data.symptoms.forEach((s) => {
      lines.push(`  ${s.date}: ${s.type} (${s.severity})`);
    });
    lines.push('');
  }

  if (data.moods && data.moods.length > 0) {
    lines.push('--- MOOD HISTORY ---');
    data.moods.forEach((m) => {
      lines.push(`  ${m.date || m.timestamp}: ${m.mood || m.rating || 'N/A'}${m.note ? ` - ${m.note}` : ''}`);
    });
    lines.push('');
  }

  if (data.medications && data.medications.length > 0) {
    lines.push('--- MEDICATIONS ---');
    data.medications.forEach((m) => {
      lines.push(`  ${m.name}${m.dosage ? ` (${m.dosage})` : ''}`);
    });
    lines.push('');
  }

  lines.push('-'.repeat(50));
  lines.push('  Disclaimer: This export is for informational purposes only.');
  lines.push('  Share with your healthcare provider for informed discussions.');
  lines.push('-'.repeat(50));

  return lines.join('\n');
}

export async function exportAsJson(data) {
  const json = JSON.stringify(data, null, 2);
  const filename = `aarini_export_${new Date().toISOString().split('T')[0]}.json`;
  const path = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
  return { path, filename };
}

export async function exportAsText(data) {
  const text = formatReadableReport(data);
  const filename = `aarini_report_${new Date().toISOString().split('T')[0]}.txt`;
  const path = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, text, { encoding: FileSystem.EncodingType.UTF8 });
  return { path, filename };
}

export async function shareFile(path) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Share Aarini Health Data',
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}

export async function getExportStats(userId, apiFetch) {
  const data = await gatherAllData(userId, apiFetch);
  const count = {
    cycles: (data.cycles || data.cyclesFromServer || []).length,
    symptoms: (data.symptoms || []).length,
    moods: (data.moods || []).length,
    medications: (data.medications || []).length,
    messages: (data.chatHistory || []).length,
  };
  return { count, generatedAt: data.exportGeneratedAt };
}
