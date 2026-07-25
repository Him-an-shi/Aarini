import { Platform } from 'react-native';
import { saveChatMessage } from './chatHistoryService';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const MAX_HISTORY = 10;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export class AiChatService {
  constructor(userToken, uid) {
    this.userToken = userToken;
    this.uid = uid;
    this.history = [];
    this.lastActivityAt = Date.now();
    this._loaded = false;
  }

  async _ensureLoaded() {
    if (this._loaded) return;
    this.history = await loadChatHistory(this.uid);
    this._loaded = true;
  }

  async _persist() {
    await saveChatHistory(this.uid, this.history);
  }

  async _persistMessage(role, content, response) {
    try {
      await saveChatMessage(this.uid, { role, content, response });
    } catch {
      // Silently fail - persistence is best-effort
    }
  }

  _getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.userToken}`,
      'X-User-Id': this.uid || 'mock_user_123',
    };
  }

  _checkSessionTimeout() {
    if (Date.now() - this.lastActivityAt > SESSION_TIMEOUT_MS) {
      this.history = [];
    }
    this.lastActivityAt = Date.now();
  }

  _addToHistory(role, text) {
    this.history.push({ role, parts: [text] });
    if (this.history.length > MAX_HISTORY * 2) {
      this.history = this.history.slice(-MAX_HISTORY * 2);
    }
  }

  clearHistory() {
    this.history = [];
    clearChatHistory();
  }

  async sendMessage(message) {
    await this._ensureLoaded();
    this._checkSessionTimeout();
    this._addToHistory('user', message);
    await this._persistMessage('user', message);

    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({ message, history: this.history.slice(0, -1) }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Chat request failed');
      }

      const data = await response.json();
      this._addToHistory('model', data.response);
      await this._persistMessage('assistant', data.response, data);
      return data;
    } catch (err) {
      this.history.pop();
      throw err;
    }
  }

  async sendMessageStreaming(message, onChunk, onComplete, onError) {
    await this._ensureLoaded();
    this._checkSessionTimeout();
    this._addToHistory('user', message);
    await this._persistMessage('user', message);

    try {
      const response = await fetch(`${BACKEND_URL}/chat/stream`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({ message, history: this.history.slice(0, -1) }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Stream request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (!payload) continue;

          try {
            const event = JSON.parse(payload);
            if (event.error) {
              throw new Error(event.error);
            }
            if (event.chunk) {
              fullResponse += event.chunk;
              onChunk(event.chunk, fullResponse);
            }
            if (event.done) {
              this._addToHistory('model', event.full_response || fullResponse);
              await this._persistMessage('assistant', event.full_response || fullResponse, event);
              onComplete({
                response: event.full_response || fullResponse,
                disclaimer: event.disclaimer,
                phase: event.phase,
              });
              return;
            }
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }

      if (fullResponse) {
        this._addToHistory('model', fullResponse);
        await this._persistMessage('assistant', fullResponse);
        onComplete({ response: fullResponse, disclaimer: null, phase: null });
      }
    } catch (err) {
      this.history.pop();
      onError(err);
    }
  }

  getConversationLength() {
    return Math.floor(this.history.length / 2);
  }

  isStreamingSupported() {
    return Platform.OS === 'web' || typeof ReadableStream !== 'undefined';
  }
}
