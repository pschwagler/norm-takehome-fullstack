import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CitationList from '../CitationList';
import type { Citation } from '@/lib/types';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

describe('CitationList', () => {
  it('renders nothing when citations is empty', () => {
    const { container } = renderWith(<CitationList citations={[]} />);
    expect(container.textContent).toBe('');
  });

  it('renders correct count of citation cards', () => {
    const citations: Citation[] = [
      { source: '1.1', text: 'Law one' },
      { source: '2.1', text: 'Law two' },
      { source: '3.1', text: 'Law three' },
    ];
    renderWith(<CitationList citations={citations} />);

    expect(screen.getByText('Citations')).toBeInTheDocument();
    expect(screen.getByText(/\[1\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[2\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[3\]/)).toBeInTheDocument();
  });
});
