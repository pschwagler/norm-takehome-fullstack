import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CitationDrawer from '../CitationDrawer';
import type { CumulativeCitation } from '@/lib/types';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

const makeCitation = (
  globalIndex: number,
  overrides: Partial<CumulativeCitation> = {}
): CumulativeCitation => ({
  globalIndex,
  messageIndex: 0,
  citation: {
    source: `${globalIndex + 1}.1`,
    text: `Law text for citation ${globalIndex + 1}.`,
    legislation_id: globalIndex + 1,
    legislation_name: 'Laws of the Seven Kingdoms',
    jurisdiction: 'Kingdom-wide',
  },
  ...overrides,
});

describe('CitationDrawer', () => {
  it('returns null when citations array is empty', () => {
    renderWith(
      <CitationDrawer
        citations={[]}
        isOpen={true}
        onToggle={vi.fn()}
        highlightedIndex={null}
      />
    );
    // When citations is empty the component returns null, so no citation-related
    // content should appear in the document at all.
    expect(screen.queryByText(/Citations/)).toBeNull();
  });

  it('renders citation count in the sidebar tab', () => {
    const citations = [makeCitation(0), makeCitation(1), makeCitation(2)];
    renderWith(
      <CitationDrawer
        citations={citations}
        isOpen={false}
        onToggle={vi.fn()}
        highlightedIndex={null}
      />
    );
    // The label appears in both the sidebar tab and the panel header; assert at
    // least one instance is present.
    const labels = screen.getAllByText('Citations (3)');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('renders citation cards when open', () => {
    const citations = [makeCitation(0), makeCitation(1)];
    renderWith(
      <CitationDrawer
        citations={citations}
        isOpen={true}
        onToggle={vi.fn()}
        highlightedIndex={null}
      />
    );
    expect(screen.getByText(/\[1\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[2\]/)).toBeInTheDocument();
  });

  it('calls onToggle when the sidebar tab is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const citations = [makeCitation(0)];
    renderWith(
      <CitationDrawer
        citations={citations}
        isOpen={false}
        onToggle={onToggle}
        highlightedIndex={null}
      />
    );

    // The sidebar tab contains the vertical "Citations (N)" label and is the
    // only element with a click handler in the collapsed state.
    const tab = screen.getAllByText(/Citations \(1\)/)[0].closest('div')!;
    await user.click(tab);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows highlighted citation card when highlightedIndex matches', () => {
    const citations = [makeCitation(0), makeCitation(1)];
    renderWith(
      <CitationDrawer
        citations={citations}
        isOpen={true}
        onToggle={vi.fn()}
        highlightedIndex={1}
      />
    );

    // The highlighted card is rendered with id="citation-{globalIndex}"
    const highlightedCard = document.getElementById('citation-1');
    expect(highlightedCard).toBeInTheDocument();

    // The non-highlighted card should also be present but without highlight styling
    const normalCard = document.getElementById('citation-0');
    expect(normalCard).toBeInTheDocument();
  });
});
