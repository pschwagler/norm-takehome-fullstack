import { ChakraProvider } from '@chakra-ui/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { StreamCallbacks } from '@/lib/api';
import Page from '../page';

vi.mock('@/lib/api', () => ({
  fetchConversations: vi.fn(),
  fetchConversation: vi.fn(),
  deleteConversation: vi.fn(),
  streamQuery: vi.fn(),
}));

import { fetchConversations, fetchConversation, streamQuery } from '@/lib/api';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

describe('Query Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchConversations as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('renders welcome state with heading and input', async () => {
    renderWith(<Page />);
    expect(screen.getByText('Westeros Legal Compliance')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Enter your question...')
    ).toBeInTheDocument();
  });

  it('loads conversations on mount', async () => {
    const mockConversations = [
      {
        id: 1,
        query: 'What about peace?',
        jurisdiction: null,
        created_at: '2025-01-01T00:00:00',
      },
    ];
    (fetchConversations as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockConversations
    );

    renderWith(<Page />);

    await waitFor(() => {
      expect(fetchConversations).toHaveBeenCalledOnce();
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
      })
    );
  });

  it('displays error from streamQuery', async () => {
    const user = userEvent.setup();
    let capturedCallbacks: StreamCallbacks | null = null;
    (streamQuery as ReturnType<typeof vi.fn>).mockImplementation(
      (_query: string, callbacks: StreamCallbacks) => {
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
      // Text appears in both QueryResponse error and toast
      const matches = screen.getAllByText('Something went wrong');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('fetches conversation detail when selecting from sidebar', async () => {
    const mockConversations = [
      {
        id: 1,
        query: 'What about peace?',
        jurisdiction: null,
        created_at: '2025-01-01T00:00:00',
      },
    ];
    (fetchConversations as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockConversations
    );
    (fetchConversation as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      query: 'What about peace?',
      response: 'According to the law...',
      citations: [],
      jurisdiction: null,
      created_at: '2025-01-01T00:00:00',
    });

    renderWith(<Page />);

    // Expand sidebar first
    await waitFor(() => {
      expect(fetchConversations).toHaveBeenCalled();
    });

    const toggleBtn = screen.getByRole('button', { name: 'Toggle sidebar' });
    await userEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('What about peace?')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('What about peace?'));

    await waitFor(() => {
      expect(fetchConversation).toHaveBeenCalledWith(1);
    });
  });
});
