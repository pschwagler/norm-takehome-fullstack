import { fetchEventSource } from '@microsoft/fetch-event-source';
import type {
  Citation,
  ConversationDetail,
  ConversationSummary,
  DocumentResponse,
  DocumentUploadResponse,
  LawGroup,
  LawResponse,
} from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:80';

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Query (SSE) ---

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export function streamQuery(
  query: string,
  callbacks: StreamCallbacks,
  jurisdiction?: string
): AbortController {
  const ctrl = new AbortController();

  fetchEventSource(`${API_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, jurisdiction }),
    signal: ctrl.signal,

    onmessage(ev) {
      if (ev.event === 'token') {
        const parsed = JSON.parse(ev.data);
        callbacks.onToken(parsed.data);
      } else if (ev.event === 'citations') {
        const parsed = JSON.parse(ev.data);
        callbacks.onCitations(parsed.data);
      } else if (ev.event === 'done') {
        callbacks.onDone();
      } else if (ev.event === 'error') {
        const parsed = JSON.parse(ev.data);
        callbacks.onError(parsed.detail ?? 'Query failed');
      }
    },

    onerror(err) {
      callbacks.onError(
        err instanceof Error ? err.message : 'Connection failed'
      );
      throw err;
    },

    openWhenHidden: true,
  });

  return ctrl;
}

// --- Conversations ---

export function fetchConversations(): Promise<ConversationSummary[]> {
  return apiFetch('/conversations');
}

export function fetchConversation(
  id: number
): Promise<ConversationDetail> {
  return apiFetch(`/conversations/${id}`);
}

export function deleteConversation(id: number): Promise<void> {
  return apiFetch(`/conversations/${id}`, { method: 'DELETE' });
}

// --- Laws ---

export function fetchLaws(
  documentId?: number
): Promise<LawGroup[]> {
  const params = documentId ? `?document_id=${documentId}` : '';
  return apiFetch(`/laws${params}`);
}

export function fetchLaw(id: number): Promise<LawResponse> {
  return apiFetch(`/laws/${id}`);
}

// --- Documents ---

export function fetchDocuments(): Promise<DocumentResponse[]> {
  return apiFetch('/documents');
}

export function fetchDocument(
  id: number
): Promise<DocumentResponse> {
  return apiFetch(`/documents/${id}`);
}

export async function uploadDocument(
  file: File,
  name: string,
  jurisdiction: string
): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);
  form.append('jurisdiction', jurisdiction);

  const res = await fetch(`${API_URL}/documents`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function deleteDocument(id: number): Promise<void> {
  return apiFetch(`/documents/${id}`, { method: 'DELETE' });
}
