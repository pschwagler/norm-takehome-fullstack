import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventSourceMessage } from '@microsoft/fetch-event-source';
import type { StreamCallbacks } from '@/lib/api';

// Mock @microsoft/fetch-event-source before importing the module under test
vi.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: vi.fn(),
}));

import { fetchEventSource } from '@microsoft/fetch-event-source';

import {
  streamQuery,
  fetchThreads,
  fetchThread,
  deleteThread,
  fetchLaws,
  fetchLaw,
  fetchLegislation,
  fetchLegislationById,
  uploadLegislation,
  deleteLegislation,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(
  status: number,
  body: unknown,
  ok = status >= 200 && status < 300
) {
  const jsonFn = vi.fn().mockResolvedValue(body);
  const res = { ok, status, json: jsonFn } as unknown as Response;
  vi.mocked(global.fetch).mockResolvedValue(res);
  return { res, jsonFn };
}

function mockFetchRejectingJson(status: number) {
  const jsonFn = vi.fn().mockRejectedValue(new SyntaxError('bad json'));
  const res = { ok: false, status, json: jsonFn } as unknown as Response;
  vi.mocked(global.fetch).mockResolvedValue(res);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// apiFetch (tested via public REST wrappers)
// ---------------------------------------------------------------------------

describe('fetchThreads', () => {
  it('returns parsed JSON on success', async () => {
    const data = [
      {
        id: 1,
        title: 'Thread 1',
        jurisdiction: null,
        message_count: 2,
        created_at: '2024-01-01',
      },
    ];
    mockFetch(200, data);

    const result = await fetchThreads();

    expect(result).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/threads'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('throws with detail message on non-ok response', async () => {
    mockFetch(422, { detail: 'Unprocessable' }, false);

    await expect(fetchThreads()).rejects.toThrow('Unprocessable');
  });

  it('throws generic message when error body has no detail', async () => {
    mockFetch(500, {}, false);

    await expect(fetchThreads()).rejects.toThrow('Request failed: 500');
  });

  it('throws generic message when error body JSON parse fails', async () => {
    mockFetchRejectingJson(503);

    await expect(fetchThreads()).rejects.toThrow('Request failed: 503');
  });
});

describe('fetchThread', () => {
  it('returns parsed JSON for a given id', async () => {
    const data = {
      id: 7,
      title: 'T',
      jurisdiction: 'Dorne',
      messages: [],
      created_at: '2024-01-01',
    };
    mockFetch(200, data);

    const result = await fetchThread(7);

    expect(result).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/threads/7'),
      expect.any(Object)
    );
  });

  it('throws on 404', async () => {
    mockFetch(404, { detail: 'Not found' }, false);

    await expect(fetchThread(99)).rejects.toThrow('Not found');
  });
});

describe('deleteThread', () => {
  it('returns undefined on 204', async () => {
    const res = { ok: true, status: 204, json: vi.fn() } as unknown as Response;
    vi.mocked(global.fetch).mockResolvedValue(res);

    const result = await deleteThread(3);

    expect(result).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/threads/3'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws on error status', async () => {
    mockFetch(403, { detail: 'Forbidden' }, false);

    await expect(deleteThread(3)).rejects.toThrow('Forbidden');
  });
});

// ---------------------------------------------------------------------------
// Laws
// ---------------------------------------------------------------------------

describe('fetchLaws', () => {
  it('calls /laws without query string when no legislationId', async () => {
    mockFetch(200, []);

    await fetchLaws();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/laws$/),
      expect.any(Object)
    );
  });

  it('appends legislation_id query param when provided', async () => {
    mockFetch(200, []);

    await fetchLaws(5);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/laws?legislation_id=5'),
      expect.any(Object)
    );
  });

  it('returns parsed law groups', async () => {
    const data = [{ topic: 'Commerce', section_title: null, laws: [] }];
    mockFetch(200, data);

    const result = await fetchLaws();

    expect(result).toEqual(data);
  });
});

describe('fetchLaw', () => {
  it('returns a single law by id', async () => {
    const data = {
      id: 2,
      section: '1.2',
      topic: 'Tax',
      section_title: null,
      text: 'No taxes.',
      jurisdiction: 'Dorne',
      legislation_id: 1,
    };
    mockFetch(200, data);

    const result = await fetchLaw(2);

    expect(result).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/laws/2'),
      expect.any(Object)
    );
  });
});

// ---------------------------------------------------------------------------
// Legislation
// ---------------------------------------------------------------------------

describe('fetchLegislation', () => {
  it('returns list of legislation', async () => {
    const data = [
      {
        id: 1,
        name: 'Edict I',
        file_name: 'edict.pdf',
        jurisdiction: 'Kingdom-wide',
        laws_count: 10,
        uploaded_at: '2024-01-01',
        uploaded_by: null,
      },
    ];
    mockFetch(200, data);

    const result = await fetchLegislation();

    expect(result).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/legislation'),
      expect.any(Object)
    );
  });
});

describe('fetchLegislationById', () => {
  it('fetches legislation by id', async () => {
    const data = {
      id: 4,
      name: 'Laws of Dorne',
      file_name: 'd.pdf',
      jurisdiction: 'Dorne',
      laws_count: 5,
      uploaded_at: '2024-01-01',
      uploaded_by: null,
    };
    mockFetch(200, data);

    const result = await fetchLegislationById(4);

    expect(result).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/legislation/4'),
      expect.any(Object)
    );
  });

  it('throws on error', async () => {
    mockFetch(404, { detail: 'Not found' }, false);

    await expect(fetchLegislationById(999)).rejects.toThrow('Not found');
  });
});

describe('uploadLegislation', () => {
  it('posts FormData with file, name, and jurisdiction', async () => {
    const responseData = {
      id: 10,
      name: 'Edict',
      file_name: 'e.pdf',
      laws_count: 3,
      uploaded_at: '2024-01-01',
    };
    mockFetch(200, responseData);

    const file = new File(['content'], 'edict.pdf', {
      type: 'application/pdf',
    });
    const result = await uploadLegislation(file, 'Edict', 'Kingdom-wide');

    expect(result).toEqual(responseData);

    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(url)).toContain('/legislation');
    expect((init as RequestInit).method).toBe('POST');

    const body = (init as RequestInit).body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('name')).toBe('Edict');
    expect(body.get('jurisdiction')).toBe('Kingdom-wide');
  });

  it('does not set Content-Type header (lets browser set multipart boundary)', async () => {
    mockFetch(200, {
      id: 1,
      name: 'N',
      file_name: 'f.pdf',
      laws_count: 0,
      uploaded_at: '2024-01-01',
    });

    const file = new File(['x'], 'x.pdf', { type: 'application/pdf' });
    await uploadLegislation(file, 'N', 'Dorne');

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect((init as RequestInit).headers).toBeUndefined();
  });

  it('throws with detail on upload error', async () => {
    mockFetch(400, { detail: 'Invalid file type' }, false);

    const file = new File(['x'], 'x.pdf', { type: 'application/pdf' });
    await expect(uploadLegislation(file, 'N', 'Dorne')).rejects.toThrow(
      'Invalid file type'
    );
  });

  it('throws generic message when error body lacks detail', async () => {
    mockFetch(500, {}, false);

    const file = new File(['x'], 'x.pdf', { type: 'application/pdf' });
    await expect(uploadLegislation(file, 'N', 'Dorne')).rejects.toThrow(
      'Upload failed: 500'
    );
  });

  it('throws generic message when upload error body JSON parse fails', async () => {
    const jsonFn = vi.fn().mockRejectedValue(new SyntaxError('bad json'));
    const res = { ok: false, status: 502, json: jsonFn } as unknown as Response;
    vi.mocked(global.fetch).mockResolvedValue(res);

    const file = new File(['x'], 'x.pdf', { type: 'application/pdf' });
    await expect(uploadLegislation(file, 'N', 'Dorne')).rejects.toThrow(
      'Upload failed: 502'
    );
  });
});

describe('deleteLegislation', () => {
  it('returns undefined on 204', async () => {
    const res = { ok: true, status: 204, json: vi.fn() } as unknown as Response;
    vi.mocked(global.fetch).mockResolvedValue(res);

    const result = await deleteLegislation(2);

    expect(result).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/legislation/2'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws on error status', async () => {
    mockFetch(404, { detail: 'Not found' }, false);

    await expect(deleteLegislation(2)).rejects.toThrow('Not found');
  });
});

// ---------------------------------------------------------------------------
// streamQuery
// ---------------------------------------------------------------------------

describe('streamQuery', () => {
  function makeCallbacks(): StreamCallbacks {
    return {
      onToken: vi.fn(),
      onCitations: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    };
  }

  function captureOnmessage(): (ev: EventSourceMessage) => void {
    const mockedFES = vi.mocked(fetchEventSource);
    const opts = mockedFES.mock.calls[0][1] as Record<string, unknown>;
    return opts['onmessage'] as (ev: EventSourceMessage) => void;
  }

  function captureOnerror(): (err: unknown) => void {
    const mockedFES = vi.mocked(fetchEventSource);
    const opts = mockedFES.mock.calls[0][1] as Record<string, unknown>;
    return opts['onerror'] as (err: unknown) => void;
  }

  it('returns an AbortController', () => {
    const ctrl = streamQuery('test query', makeCallbacks());
    expect(ctrl).toBeInstanceOf(AbortController);
  });

  it('calls fetchEventSource with POST and JSON body', () => {
    const callbacks = makeCallbacks();
    streamQuery('what is tax law?', callbacks, 'Dorne', 42);

    expect(fetchEventSource).toHaveBeenCalledWith(
      expect.stringContaining('/query'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'what is tax law?',
          jurisdiction: 'Dorne',
          thread_id: 42,
        }),
        openWhenHidden: true,
      })
    );
  });

  it('defaults thread_id to null when threadId is omitted', () => {
    streamQuery('query', makeCallbacks(), 'The North');

    const [, opts] = vi.mocked(fetchEventSource).mock.calls[0];
    const body = JSON.parse((opts as Record<string, string>)['body']);
    expect(body.thread_id).toBeNull();
  });

  it('passes AbortController signal to fetchEventSource', () => {
    const ctrl = streamQuery('q', makeCallbacks());

    const [, opts] = vi.mocked(fetchEventSource).mock.calls[0];
    expect((opts as Record<string, unknown>)['signal']).toBe(ctrl.signal);
  });

  it('calls onToken when a token event arrives', () => {
    const callbacks = makeCallbacks();
    streamQuery('q', callbacks);
    const onmessage = captureOnmessage();

    onmessage({
      event: 'token',
      data: JSON.stringify({ data: 'Hello' }),
      id: '',
      retry: undefined,
    });

    expect(callbacks.onToken).toHaveBeenCalledWith('Hello');
  });

  it('calls onCitations when a citations event arrives', () => {
    const callbacks = makeCallbacks();
    streamQuery('q', callbacks);
    const onmessage = captureOnmessage();

    const citations = [
      {
        source: 'law-1',
        text: 'No murder.',
        legislation_name: 'Edicts',
        jurisdiction: 'Kingdom-wide',
      },
    ];
    onmessage({
      event: 'citations',
      data: JSON.stringify({ data: citations }),
      id: '',
      retry: undefined,
    });

    expect(callbacks.onCitations).toHaveBeenCalledWith(citations);
  });

  it('calls onDone when a done event arrives', () => {
    const callbacks = makeCallbacks();
    streamQuery('q', callbacks);
    const onmessage = captureOnmessage();

    onmessage({
      event: 'done',
      data: JSON.stringify({ thread_id: 7, response: 'corrected text' }),
      id: '',
      retry: undefined,
    });

    expect(callbacks.onDone).toHaveBeenCalledWith(7, 'corrected text');
  });

  it('calls onError when an error event arrives with detail', () => {
    const callbacks = makeCallbacks();
    streamQuery('q', callbacks);
    const onmessage = captureOnmessage();

    onmessage({
      event: 'error',
      data: JSON.stringify({ detail: 'Something went wrong' }),
      id: '',
      retry: undefined,
    });

    expect(callbacks.onError).toHaveBeenCalledWith('Something went wrong');
  });

  it('calls onError with fallback message when error event has no detail', () => {
    const callbacks = makeCallbacks();
    streamQuery('q', callbacks);
    const onmessage = captureOnmessage();

    onmessage({
      event: 'error',
      data: JSON.stringify({}),
      id: '',
      retry: undefined,
    });

    expect(callbacks.onError).toHaveBeenCalledWith('Query failed');
  });

  it('ignores unrecognised event types without calling any callback', () => {
    const callbacks = makeCallbacks();
    streamQuery('q', callbacks);
    const onmessage = captureOnmessage();

    onmessage({ event: 'ping', data: '{}', id: '', retry: undefined });

    expect(callbacks.onToken).not.toHaveBeenCalled();
    expect(callbacks.onCitations).not.toHaveBeenCalled();
    expect(callbacks.onDone).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('calls onError with error message in onerror callback and rethrows', () => {
    const callbacks = makeCallbacks();
    streamQuery('q', callbacks);
    const onerror = captureOnerror();

    const err = new Error('Network error');
    expect(() => onerror(err)).toThrow('Network error');
    expect(callbacks.onError).toHaveBeenCalledWith('Network error');
  });

  it('calls onError with fallback when onerror receives a non-Error value', () => {
    const callbacks = makeCallbacks();
    streamQuery('q', callbacks);
    const onerror = captureOnerror();

    expect(() => onerror('string error')).toThrow('string error');
    expect(callbacks.onError).toHaveBeenCalledWith('Connection failed');
  });
});
