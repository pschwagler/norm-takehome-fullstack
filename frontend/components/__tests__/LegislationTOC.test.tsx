import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LegislationTOC from '../LegislationTOC';
import type { LawGroup } from '@/lib/types';
import React from 'react';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

const groups: LawGroup[] = [
  {
    topic: 'Peace',
    laws: [
      {
        id: 1,
        section: '1.1',
        topic: 'Peace',
        section_title: null,
        text: 'All conflicts shall be resolved.',
        jurisdiction: 'Kingdom-wide',
        legislation_id: 1,
      },
    ],
  },
  {
    topic: 'Trade',
    laws: [
      {
        id: 2,
        section: '2.1',
        topic: 'Trade',
        section_title: null,
        text: 'Trade must be fair.',
        jurisdiction: 'Kingdom-wide',
        legislation_id: 1,
      },
    ],
  },
];

describe('LegislationTOC', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a "Contents" header', () => {
    const ref = React.createRef<HTMLDivElement>();
    renderWith(<LegislationTOC groups={groups} scrollContainerRef={ref} />);
    expect(screen.getByText('Contents')).toBeInTheDocument();
  });

  it('renders topic names from groups', () => {
    const ref = React.createRef<HTMLDivElement>();
    renderWith(<LegislationTOC groups={groups} scrollContainerRef={ref} />);
    expect(screen.getByText('1. Peace')).toBeInTheDocument();
    expect(screen.getByText('2. Trade')).toBeInTheDocument();
  });

  it('calls scrollIntoView on correct element when clicked', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<HTMLDivElement>();

    const mockElement = document.createElement('div');
    mockElement.id = 'topic-1';
    mockElement.scrollIntoView = vi.fn();
    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'topic-1') return mockElement;
      return null;
    });

    renderWith(<LegislationTOC groups={groups} scrollContainerRef={ref} />);
    await user.click(screen.getByText('1. Peace'));

    expect(document.getElementById).toHaveBeenCalledWith('topic-1');
    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });
});
