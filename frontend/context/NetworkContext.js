import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, NetInfo } from 'react-native';

const NetworkContext = createContext(null);

const PING_URLS = [
  'https://clients3.google.com/generate_204',
  'https://www.apple.com/library/test/success.html',
];

const PING_TIMEOUT_MS = 3000;
const RETRY_INTERVAL_MS = 10000;

async function checkConnectivity() {
  for (const url of PING_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok || response.status === 204) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [lastOnlineAt, setLastOnlineAt] = useState(Date.now());
  const retryRef = useRef(null);

  const checkNow = useCallback(async () => {
    const online = await checkConnectivity();
    setIsOnline(online);
    if (online) {
      setLastOnlineAt(Date.now());
      if (retryRef.current) {
        clearInterval(retryRef.current);
        retryRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    checkNow();
    const interval = setInterval(checkNow, 30000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkNow();
    });
    return () => {
      clearInterval(interval);
      subscription?.remove();
      if (retryRef.current) clearInterval(retryRef.current);
    };
  }, [checkNow]);

  const startRetry = useCallback(() => {
    if (!retryRef.current) {
      retryRef.current = setInterval(async () => {
        const online = await checkConnectivity();
        setIsOnline(online);
        if (online) {
          setLastOnlineAt(Date.now());
          clearInterval(retryRef.current);
          retryRef.current = null;
        }
      }, RETRY_INTERVAL_MS);
    }
  }, []);

  useEffect(() => {
    if (!isOnline) startRetry();
  }, [isOnline, startRetry]);

  return (
    <NetworkContext.Provider value={{ isOnline, lastOnlineAt, checkNow }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
