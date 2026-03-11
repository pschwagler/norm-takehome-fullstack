import { fetchEventSource } from '@microsoft/fetch-event-source';
import type {
  Citation,
  LegislationResponse,
  LegislationUploadResponse,
  LawGroup,
  LawResponse,
  ThreadDetail,
  ThreadSummary,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Typed fetch wrapper that prepends the API base URL and handles errors. */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
  onDone: (threadId: number, response?: string) => void;
  onError: (error: string) => void;
}

/** Open an SSE connection to /query and dispatch tokens, citations, and completion via callbacks. */
export function streamQuery(
  query: string,
  callbacks: StreamCallbacks,
  jurisdiction?: string,
  threadId?: number
): AbortController {
  const ctrl = new AbortController();

  fetchEventSource(`${API_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      jurisdiction,
      thread_id: threadId ?? null,
    }),
    signal: ctrl.signal,

    onmessage(ev) {
      if (ev.event === 'token') {
        const parsed = JSON.parse(ev.data);
        callbacks.onToken(parsed.data);
      } else if (ev.event === 'citations') {
        const parsed = JSON.parse(ev.data);
        callbacks.onCitations(parsed.data);
      } else if (ev.event === 'done') {
        const parsed = JSON.parse(ev.data);
        callbacks.onDone(parsed.thread_id, parsed.response);
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

// --- Threads ---

export function fetchThreads(): Promise<ThreadSummary[]> {
  return apiFetch('/threads');
}

export function fetchThread(id: number): Promise<ThreadDetail> {
  return apiFetch(`/threads/${id}`);
}

export function deleteThread(id: number): Promise<void> {
  return apiFetch(`/threads/${id}`, { method: 'DELETE' });
}

// --- Laws ---

export function fetchLaws(legislationId?: number): Promise<LawGroup[]> {
  const params = legislationId ? `?legislation_id=${legislationId}` : '';
  return apiFetch(`/laws${params}`);
}

export function fetchLaw(id: number): Promise<LawResponse> {
  return apiFetch(`/laws/${id}`);
}

// --- Legislation ---

export function fetchLegislation(): Promise<LegislationResponse[]> {
  return apiFetch('/legislation');
}

export function fetchLegislationById(id: number): Promise<LegislationResponse> {
  return apiFetch(`/legislation/${id}`);
}

/** Upload a legislation PDF via multipart form data. */
export async function uploadLegislation(
  file: File,
  name: string,
  jurisdiction: string
): Promise<LegislationUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);
  form.append('jurisdiction', jurisdiction);

  const res = await fetch(`${API_URL}/legislation`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function deleteLegislation(id: number): Promise<void> {
  return apiFetch(`/legislation/${id}`, { method: 'DELETE' });
}
