import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_HISTORY_KEY = '@aarini_chat_history';
const MAX_HISTORY_LENGTH = 200;

export async function getChatHistory(userId) {
  try {
    const key = `${CHAT_HISTORY_KEY}:${userId || 'default'}`;
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveChatMessage(userId, message) {
  const key = `${CHAT_HISTORY_KEY}:${userId || 'default'}`;
  const history = await getChatHistory(userId);
  history.push({
    ...message,
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  });
  if (history.length > MAX_HISTORY_LENGTH) {
    history.splice(0, history.length - MAX_HISTORY_LENGTH);
  }
  await AsyncStorage.setItem(key, JSON.stringify(history));
  return history;
}

export async function clearChatHistory(userId) {
  const key = `${CHAT_HISTORY_KEY}:${userId || 'default'}`;
  await AsyncStorage.removeItem(key);
}

export async function deleteChatMessage(userId, messageId) {
  const history = await getChatHistory(userId);
  const filtered = history.filter((m) => m.id !== messageId);
  const key = `${CHAT_HISTORY_KEY}:${userId || 'default'}`;
  await AsyncStorage.setItem(key, JSON.stringify(filtered));
  return filtered;
}

export async function searchChatHistory(userId, query) {
  const history = await getChatHistory(userId);
  if (!query || !query.trim()) return history;
  const lowerQuery = query.toLowerCase();
  return history.filter(
    (m) =>
      (m.content || m.message || '').toLowerCase().includes(lowerQuery) ||
      (m.response || '').toLowerCase().includes(lowerQuery)
  );
}

export async function getChatHistoryStats(userId) {
  const history = await getChatHistory(userId);
  const totalMessages = history.length;
  const uniqueDates = new Set(history.map((m) => m.timestamp?.split('T')[0])).size;
  return { totalMessages, uniqueDates, lastMessage: history[history.length - 1] || null };
}
