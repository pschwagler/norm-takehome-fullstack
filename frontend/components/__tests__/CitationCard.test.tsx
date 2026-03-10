import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import CitationCard from '../CitationCard';
import type { Citation } from '@/lib/types';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

const citation: Citation = {
  source: '1.1',
  text: 'All conflicts between noble houses shall be resolved through the Crown.',
  jurisdiction: 'Kingdom-wide',
};

describe('CitationCard', () => {
  it('renders section number and index', () => {
    renderWith(<CitationCard citation={citation} index={0} />);
    expect(screen.getByText(/\[1\]/)).toBeInTheDocument();
    expect(screen.getByText(/Section 1\.1/)).toBeInTheDocument();
  });

  it('shows jurisdiction', () => {
    renderWith(<CitationCard citation={citation} index={0} />);
    expect(screen.getByText('Kingdom-wide')).toBeInTheDocument();
  });

  it('expands to show full text on click', async () => {
    const user = userEvent.setup();
    const longCitation: Citation = {
      source: '2.1',
      text: 'A very long law text that should be truncated initially but shown in full when the card is expanded by clicking on it.',
    };
    renderWith(<CitationCard citation={longCitation} index={1} />);

    const card =
      screen.getByText(/Section 2\.1/).closest('[role="button"]') ??
      screen.getByText(/Section 2\.1/).parentElement!.parentElement!;
    await user.click(card);

    expect(screen.getByText(longCitation.text)).toBeInTheDocument();
  });
});
