import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConversationSidebar from '../ConversationSidebar';
import type { ConversationSummary } from '@/lib/types';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

const conversations: ConversationSummary[] = [
  {
    id: 1,
    query: 'What laws govern the North?',
    jurisdiction: 'The North',
    created_at: '2026-03-10T10:00:00Z',
  },
  {
    id: 2,
    query: 'Tell me about trial by combat',
    jurisdiction: null,
    created_at: '2026-03-09T08:00:00Z',
  },
];

describe('ConversationSidebar', () => {
  it('renders toggle and new conversation buttons', () => {
    renderWith(
      <ConversationSidebar
        conversations={conversations}
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

  it('shows conversations when expanded', async () => {
    const user = userEvent.setup();
    renderWith(
      <ConversationSidebar
        conversations={conversations}
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

  it('calls onSelect when conversation is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWith(
      <ConversationSidebar
        conversations={conversations}
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
        conversations={conversations}
        activeId={null}
        onSelect={() => {}}
        onDelete={onDelete}
        onNewConversation={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));

    const convText = screen.getByText('What laws govern the North?');
    const convItem = convText.closest('div[class]')!;
    fireEvent.mouseEnter(convItem);

    const deleteBtn = screen.getAllByRole('button', {
      name: 'Delete conversation',
    })[0];
    fireEvent.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
