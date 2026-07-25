import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Search, Trash2, MessageCircle, Clock } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getChatHistory, clearChatHistory, searchChatHistory, deleteChatMessage } from '../services/chatHistoryService';

export const ChatHistoryScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, typography, spacing, borderRadius, shadows } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const userId = user?.uid || 'default';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [clearing, setClearing] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = searchQuery
        ? await searchChatHistory(userId, searchQuery)
        : await getChatHistory(userId);
      setMessages(data.reverse());
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = useCallback(async (messageId) => {
    const updated = await deleteChatMessage(userId, messageId);
    setMessages(updated.reverse());
  }, [userId]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Chat History',
      'This will permanently delete all your chat conversations. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            await clearChatHistory(userId);
            setMessages([]);
            setClearing(false);
          },
        },
      ]
    );
  }, [userId]);

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }) => (
    <View style={styles.messageCard}>
      <View style={styles.messageHeader}>
        <View style={styles.messageRole}>
          <MessageCircle size={14} color={item.role === 'user' ? colors.primaryDark : colors.secondaryDark} />
          <Text style={[styles.roleText, { color: item.role === 'user' ? colors.primaryDark : colors.secondaryDark }]}>
            {item.role === 'user' ? 'You' : 'Aarini'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={styles.deleteButton}
          accessibilityLabel="Delete message"
        >
          <Trash2 size={14} color={colors.textLight} />
        </TouchableOpacity>
      </View>
      <Text style={styles.messageContent} numberOfLines={3}>
        {item.content || item.message || item.response || ''}
      </Text>
      <View style={styles.messageFooter}>
        <Clock size={12} color={colors.textLight} />
        <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {navigation?.canGoBack?.() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
            <ArrowLeft size={22} color={colors.textDark} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={[typography.h2, styles.headerTitle]}>Chat History</Text>
        <TouchableOpacity onPress={handleClearAll} disabled={clearing || messages.length === 0} accessibilityLabel="Clear all history">
          {clearing ? (
            <ActivityIndicator size="small" color={colors.errorDark} />
          ) : (
            <Trash2 size={20} color={messages.length > 0 ? colors.errorDark : colors.textLight} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textLight} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textLight}
          accessibilityLabel="Search chat history"
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MessageCircle size={48} color={colors.border} />
          <Text style={styles.emptyTitle}>No chat history</Text>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No results match your search.' : 'Start a conversation with Aarini to see your history here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || item.timestamp}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = ({ colors, typography, spacing, borderRadius, shadows }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  backButton: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardBackground },
  headerTitle: { flex: 1, textAlign: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: borderRadius.md, marginHorizontal: spacing.lg, marginBottom: spacing.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, marginLeft: spacing.sm, color: colors.textDark, fontSize: 15 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textDark, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText: { ...typography.bodyMedium, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
  listContent: { padding: spacing.lg, paddingTop: 0 },
  messageCard: { backgroundColor: colors.cardBackground, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.light },
  messageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  messageRole: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleText: { ...typography.caption, fontWeight: '700' },
  deleteButton: { padding: spacing.xs },
  messageContent: { ...typography.bodyMedium, color: colors.textDark, lineHeight: 20 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  timestamp: { ...typography.caption, color: colors.textLight },
});
