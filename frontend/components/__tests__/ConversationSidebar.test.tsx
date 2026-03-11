import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationSidebar from '../ConversationSidebar';
import { formatDate } from '@/lib/dates';
import type { ThreadSummary } from '@/lib/types';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

const threads: ThreadSummary[] = [
  {
    id: 1,
    title: 'What laws govern the North?',
    jurisdiction: 'The North',
    message_count: 2,
    created_at: '2026-03-10T10:00:00Z',
  },
  {
    id: 2,
    title: 'Tell me about trial by combat',
    jurisdiction: null,
    message_count: 4,
    created_at: '2026-03-09T08:00:00Z',
  },
];

describe('formatDate', () => {
  const NOW = new Date('2026-03-10T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for less than 60 seconds ago', () => {
    expect(formatDate('2026-03-10T11:59:30Z')).toBe('just now');
  });

  it('returns minutes ago', () => {
    expect(formatDate('2026-03-10T11:55:00Z')).toBe('5m ago');
  });

  it('returns hours ago', () => {
    expect(formatDate('2026-03-10T09:00:00Z')).toBe('3h ago');
  });

  it('returns days ago', () => {
    expect(formatDate('2026-03-07T12:00:00Z')).toBe('3d ago');
  });

  it('returns months ago', () => {
    expect(formatDate('2025-12-10T12:00:00Z')).toBe('3mo ago');
  });

  it('returns years ago', () => {
    expect(formatDate('2024-01-10T12:00:00Z')).toBe('2y ago');
  });
});

describe('ConversationSidebar', () => {
  it('renders toggle and new conversation buttons', () => {
    renderWith(
      <ConversationSidebar
        threads={threads}
        activeId={null}
        onSelect={() => {}}
        onDelete={() => {}}
        onNewConversation={() => {}}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Toggle sidebar' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New Conversation' })
    ).toBeInTheDocument();
  });

  it('shows threads when expanded', async () => {
    const user = userEvent.setup();
    renderWith(
      <ConversationSidebar
        threads={threads}
        activeId={null}
        onSelect={() => {}}
        onDelete={() => {}}
        onNewConversation={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));

    expect(screen.getByText('What laws govern the North?')).toBeInTheDocument();
    expect(
      screen.getByText('Tell me about trial by combat')
    ).toBeInTheDocument();
  });

  it('calls onSelect when thread is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWith(
      <ConversationSidebar
        threads={threads}
        activeId={null}
        onSelect={onSelect}
        onDelete={() => {}}
        onNewConversation={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    await user.click(screen.getByText('What laws govern the North?'));

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderWith(
      <ConversationSidebar
        threads={threads}
        activeId={null}
        onSelect={() => {}}
        onDelete={onDelete}
        onNewConversation={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));

    const threadText = screen.getByText('What laws govern the North?');
    const threadItem = threadText.closest('div[class]')!;
    fireEvent.mouseEnter(threadItem);

    const deleteBtn = screen.getAllByRole('button', {
      name: 'Delete thread',
    })[0];
    fireEvent.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
