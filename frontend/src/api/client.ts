export interface ShareLinkMetadata {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  status: 'Active' | 'Used' | 'Expired';
}

export interface HealthInfo {
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  database: 'connected' | 'disconnected';
  tracing: 'enabled' | 'disabled';
}

const API_BASE = '/api';

export async function createLink(content: string, expiresInMinutes?: number): Promise<ShareLinkMetadata> {
  const res = await fetch(`${API_BASE}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      expiresInMinutes: expiresInMinutes && expiresInMinutes > 0 ? expiresInMinutes : undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to create link');
  }
  return data.data;
}

export async function fetchLinks(): Promise<ShareLinkMetadata[]> {
  const res = await fetch(`${API_BASE}/links`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch links');
  }
  return data.data;
}

export async function deleteLink(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/links/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete link');
  }
}

export async function consumeLink(token: string): Promise<{ success: boolean; content?: string; error?: string; message?: string }> {
  const res = await fetch(`${API_BASE}/links/${token}/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await res.json();
  if (!res.ok) {
    return {
      success: false,
      error: data.error,
      message: data.message || 'Error accessing link',
    };
  }

  return {
    success: true,
    content: data.data.content,
  };
}

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
