import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LawEntry from '../LawEntry';
import type { LawResponse } from '@/lib/types';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

describe('LawEntry', () => {
  it('renders section number in purple and law text', () => {
    const law: LawResponse = {
      id: 1,
      section: '1.1',
      topic: 'Peace',
      section_title: null,
      text: 'All conflicts shall be resolved through the Crown.',
      jurisdiction: 'Kingdom-wide',
      legislation_id: 1,
    };
    renderWith(<LawEntry law={law} />);

    expect(screen.getByText('1.1')).toBeInTheDocument();
    expect(
      screen.getByText('All conflicts shall be resolved through the Crown.')
    ).toBeInTheDocument();
  });

  it('renders without errors for deeply nested sections', () => {
    const deep: LawResponse = {
      id: 2,
      section: '10.1.1.4',
      topic: 'Watch',
      section_title: null,
      text: 'Deep law about the Watch.',
      jurisdiction: 'Kingdom-wide',
      legislation_id: 1,
    };
    renderWith(<LawEntry law={deep} />);

    expect(screen.getByText('10.1.1.4')).toBeInTheDocument();
    expect(screen.getByText('Deep law about the Watch.')).toBeInTheDocument();
  });
});
