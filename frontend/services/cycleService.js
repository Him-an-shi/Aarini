const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export function buildHeaders(token, userId) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-User-Id': userId || 'mock_user_123',
  };
}

export async function fetchCycles(token, userId) {
  const headers = buildHeaders(token, userId);
  try {
    const res = await fetch(`${BACKEND_URL}/cycles`, { headers });
    if (!res.ok) throw new Error('Failed to fetch cycles');
    return await res.json();
  } catch {
    throw new Error('Unable to load cycles from server');
  }
}

export async function addCycle(token, userId, cycleData) {
  const headers = buildHeaders(token, userId);
  const res = await fetch(`${BACKEND_URL}/add-cycle`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...cycleData, uid: userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save cycle');
  return data;
}

export async function updateCycle(token, userId, cycleId, updates) {
  const headers = buildHeaders(token, userId);
  const res = await fetch(`${BACKEND_URL}/cycles/${cycleId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update cycle');
  return data;
}

export async function deleteCycle(token, userId, cycleId) {
  const headers = buildHeaders(token, userId);
  const res = await fetch(`${BACKEND_URL}/cycles/${cycleId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete cycle');
  }
  return true;
}
