import { ChakraProvider } from '@chakra-ui/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { StreamCallbacks } from '@/lib/api';
import Page from '../page';

vi.mock('@/lib/api', () => ({
  fetchThreads: vi.fn(),
  fetchThread: vi.fn(),
  deleteThread: vi.fn(),
  streamQuery: vi.fn(),
}));

import {
  fetchThreads,
  fetchThread,
  deleteThread,
  streamQuery,
} from '@/lib/api';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

describe('Query Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchThreads as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('renders welcome state with heading and input', async () => {
    renderWith(<Page />);
    expect(screen.getByText('Westeros Legal Compliance')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Enter your question...')
    ).toBeInTheDocument();
  });

  it('loads threads on mount', async () => {
    const mockThreads = [
      {
        id: 1,
        title: 'What about peace?',
        jurisdiction: null,
        message_count: 2,
        created_at: '2025-01-01T00:00:00',
      },
    ];
    (fetchThreads as ReturnType<typeof vi.fn>).mockResolvedValue(mockThreads);

    renderWith(<Page />);

    await waitFor(() => {
      expect(fetchThreads).toHaveBeenCalledOnce();
    });
  });

  it('calls streamQuery on submit', async () => {
    const user = userEvent.setup();
    const mockCtrl = new AbortController();
    (streamQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockCtrl);

    renderWith(<Page />);

    const input = screen.getByPlaceholderText('Enter your question...');
    await user.type(input, 'What are the trade laws?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(streamQuery).toHaveBeenCalledWith(
      'What are the trade laws?',
      expect.objectContaining({
        onToken: expect.any(Function),
        onCitations: expect.any(Function),
        onDone: expect.any(Function),
        onError: expect.any(Function),
      }),
      undefined,
      undefined
    );
  });

  it('displays error from streamQuery', async () => {
    const user = userEvent.setup();
    let capturedCallbacks: StreamCallbacks | null = null;
    (streamQuery as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _query: string,
        callbacks: StreamCallbacks,
        _jurisdiction?: string,
        _threadId?: number
      ) => {
        capturedCallbacks = callbacks;
        return new AbortController();
      }
    );

    renderWith(<Page />);

    const input = screen.getByPlaceholderText('Enter your question...');
    await user.type(input, 'Bad query');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(capturedCallbacks).not.toBeNull();
    act(() => {
      capturedCallbacks!.onError('Something went wrong');
    });

    await waitFor(() => {
      const matches = screen.getAllByText('Something went wrong');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('fetches thread detail when selecting from sidebar', async () => {
    const mockThreads = [
      {
        id: 1,
        title: 'What about peace?',
        jurisdiction: null,
        message_count: 2,
        created_at: '2025-01-01T00:00:00',
      },
    ];
    (fetchThreads as ReturnType<typeof vi.fn>).mockResolvedValue(mockThreads);
    (fetchThread as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      title: 'What about peace?',
      jurisdiction: null,
      messages: [
        {
          id: 1,
          role: 'user',
          content: 'What about peace?',
          citations: [],
          created_at: '2025-01-01T00:00:00',
        },
        {
          id: 2,
          role: 'assistant',
          content: 'According to the law...',
          citations: [],
          created_at: '2025-01-01T00:00:01',
        },
      ],
      created_at: '2025-01-01T00:00:00',
    });

    renderWith(<Page />);

    // Expand sidebar first
    await waitFor(() => {
      expect(fetchThreads).toHaveBeenCalled();
    });

    const toggleBtn = screen.getByRole('button', { name: 'Toggle sidebar' });
    await userEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('What about peace?')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('What about peace?'));

    await waitFor(() => {
      expect(fetchThread).toHaveBeenCalledWith(1);
    });
  });

  it('streaming tokens appear in the message', async () => {
    const user = userEvent.setup();
    let capturedCallbacks: StreamCallbacks | null = null;
    (streamQuery as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _query: string,
        callbacks: StreamCallbacks,
        _jurisdiction?: string,
        _threadId?: number
      ) => {
        capturedCallbacks = callbacks;
        return new AbortController();
      }
    );

    renderWith(<Page />);

    const input = screen.getByPlaceholderText('Enter your question...');
    await user.type(input, 'Tell me about trade');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(capturedCallbacks).not.toBeNull();

    await act(async () => {
      capturedCallbacks!.onToken('Hello');
    });
    await act(async () => {
      capturedCallbacks!.onToken(' world');
    });

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  it('onDone updates thread and reloads threads list', async () => {
    const user = userEvent.setup();
    let capturedCallbacks: StreamCallbacks | null = null;
    (streamQuery as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _query: string,
        callbacks: StreamCallbacks,
        _jurisdiction?: string,
        _threadId?: number
      ) => {
        capturedCallbacks = callbacks;
        return new AbortController();
      }
    );
    const reloadedThreads = [
      {
        id: 5,
        title: 'Trade query',
        jurisdiction: null,
        message_count: 2,
        created_at: '2025-01-02T00:00:00',
      },
    ];
    (fetchThreads as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(reloadedThreads);

    renderWith(<Page />);

    const input = screen.getByPlaceholderText('Enter your question...');
    await user.type(input, 'Trade query');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(capturedCallbacks).not.toBeNull();

    await act(async () => {
      capturedCallbacks!.onDone(5, 'Final response');
    });

    await waitFor(() => {
      expect(fetchThreads).toHaveBeenCalledTimes(2);
    });
  });

  it('handleDeleteThread removes thread from sidebar', async () => {
    const mockThreads = [
      {
        id: 3,
        title: 'Northern Laws',
        jurisdiction: null,
        message_count: 1,
        created_at: '2025-01-03T00:00:00',
      },
    ];
    (fetchThreads as ReturnType<typeof vi.fn>).mockResolvedValue(mockThreads);
    (deleteThread as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    renderWith(<Page />);

    await waitFor(() => {
      expect(fetchThreads).toHaveBeenCalled();
    });

    const toggleBtn = screen.getByRole('button', { name: 'Toggle sidebar' });
    await userEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('Northern Laws')).toBeInTheDocument();
    });

    const { fireEvent } = await import('@testing-library/react');
    const threadItem = screen.getByText('Northern Laws').closest('[class]')!;
    fireEvent.mouseEnter(threadItem);

    const deleteBtn = await screen.findByRole('button', {
      name: 'Delete thread',
    });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteThread).toHaveBeenCalledWith(3);
    });

    await waitFor(() => {
      expect(screen.queryByText('Northern Laws')).not.toBeInTheDocument();
    });
  });

  it('citations auto-open the drawer', async () => {
    const user = userEvent.setup();
    let capturedCallbacks: StreamCallbacks | null = null;
    (streamQuery as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _query: string,
        callbacks: StreamCallbacks,
        _jurisdiction?: string,
        _threadId?: number
      ) => {
        capturedCallbacks = callbacks;
        return new AbortController();
      }
    );

    renderWith(<Page />);

    const input = screen.getByPlaceholderText('Enter your question...');
    await user.type(input, 'What laws govern trade?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(capturedCallbacks).not.toBeNull();

    await act(async () => {
      capturedCallbacks!.onToken('Trade requires a license.');
    });

    await act(async () => {
      capturedCallbacks!.onCitations([
        {
          source: 'Laws of the Seven Kingdoms §1',
          text: 'No trade shall occur without a license.',
          legislation_id: 1,
          legislation_name: 'Laws of the Seven Kingdoms',
          jurisdiction: 'Kingdom-wide',
        },
      ]);
    });

    await act(async () => {
      capturedCallbacks!.onDone(7, undefined);
    });

    // The drawer tab always shows when citations > 0; "Citations (1)" appears
    // in the vertical tab label
    await waitFor(
      () => {
        expect(screen.getAllByText(/Citations \(1\)/).length).toBeGreaterThan(
          0
        );
      },
      { timeout: 3000 }
    );
  });
});
