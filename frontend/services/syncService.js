import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = '@aarini_pending_sync';
const SYNC_QUEUE_KEY = '@aarini_sync_queue';
const MAX_RETRY_COUNT = 3;

export function mergeCycles(local, remote) {
  const remoteMap = new Map();
  for (const cycle of remote) {
    remoteMap.set(cycle.startDate, cycle);
  }

  const localOnly = [];
  for (const cycle of local) {
    if (!remoteMap.has(cycle.startDate)) {
      localOnly.push(cycle);
    }
  }

  const merged = [...remote, ...localOnly];
  merged.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return { merged, localOnly };
}

export async function pushPendingToBackend(entries, backendUrl, headers) {
  const failed = [];

  for (const entry of entries) {
    try {
      const res = await fetch(`${backendUrl}/add-cycle`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          startDate: entry.startDate,
          endDate: entry.endDate,
          flowIntensity: entry.flowIntensity || null,
          symptoms: entry.symptoms || [],
          mood: entry.mood || null,
        }),
      });
      if (!res.ok) failed.push(entry);
    } catch {
      failed.push(entry);
    }
  }

  return failed;
}

export async function savePendingEntries(entries) {
  if (entries.length === 0) {
    await AsyncStorage.removeItem(PENDING_KEY);
    return;
  }
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(entries));
}

export async function loadPendingEntries() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addToSyncQueue(entry) {
  const queue = await getSyncQueue();
  queue.push({ ...entry, queuedAt: Date.now(), retryCount: 0 });
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export async function getSyncQueue() {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearSyncQueue() {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

export async function processSyncQueue(backendUrl, headers) {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  const stillPending = [];
  let processed = 0;

  for (const item of queue) {
    if (item.retryCount >= MAX_RETRY_COUNT) continue;
    try {
      const res = await fetch(`${backendUrl}/add-cycle`, {
        method: 'POST',
        headers,
        body: JSON.stringify(item.payload || item),
      });
      if (res.ok) {
        processed++;
      } else {
        stillPending.push({ ...item, retryCount: item.retryCount + 1 });
      }
    } catch {
      stillPending.push({ ...item, retryCount: item.retryCount + 1 });
    }
  }

  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(stillPending));
  return { processed, failed: stillPending.length };
}

export async function getPendingSyncCount() {
  const queue = await getSyncQueue();
  const pending = await loadPendingEntries();
  return queue.length + pending.length;
}

export async function syncCycles({ storageKey, backendUrl, headers }) {
  const localRaw = await AsyncStorage.getItem(storageKey);
  const local = localRaw ? JSON.parse(localRaw) : [];
  const pending = await loadPendingEntries();
  const allLocal = [...local, ...pending.filter((p) => !local.some((l) => l.startDate === p.startDate))];

  let remote = [];
  let prediction = null;
  let online = true;

  try {
    const res = await fetch(`${backendUrl}/cycles`, { headers });
    if (res.ok) {
      const data = await res.json();
      remote = data.cycles || [];
      prediction = data.prediction || null;
    } else {
      online = false;
    }
  } catch {
    online = false;
  }

  const { merged, localOnly } = mergeCycles(allLocal, remote);

  let syncStatus = 'synced';
  if (!online) {
    syncStatus = 'offline';
  } else if (localOnly.length > 0) {
    syncStatus = 'syncing';
    const failed = await pushPendingToBackend(localOnly, backendUrl, headers);
    await savePendingEntries(failed);
    syncStatus = failed.length > 0 ? 'pending' : 'synced';
  } else {
    await savePendingEntries([]);
  }

  await AsyncStorage.setItem(storageKey, JSON.stringify(merged));

  return { cycles: merged, prediction, syncStatus };
}
