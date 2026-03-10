import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import TopicAccordion from '../TopicAccordion';
import type { LawGroup } from '@/lib/types';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

const groups: LawGroup[] = [
  {
    topic: 'Peace',
    section_title: null,
    laws: [
      {
        id: 1,
        section: '1.1',
        topic: 'Peace',
        section_title: null,
        text: 'All conflicts shall be resolved.',
        jurisdiction: 'Kingdom-wide',
        document_id: 1,
      },
      {
        id: 2,
        section: '1.2',
        topic: 'Peace',
        section_title: null,
        text: 'No house shall wage private war.',
        jurisdiction: 'Kingdom-wide',
        document_id: 1,
      },
    ],
  },
];

describe('TopicAccordion', () => {
  it('shows empty state when no groups', () => {
    renderWith(<TopicAccordion groups={[]} />);
    expect(screen.getByText('No laws found.')).toBeInTheDocument();
  });

  it('renders topic headers', () => {
    renderWith(<TopicAccordion groups={groups} />);
    expect(screen.getByText('1. Peace')).toBeInTheDocument();
  });

  it('expands to show child laws on click', async () => {
    const user = userEvent.setup();
    renderWith(<TopicAccordion groups={groups} />);

    await user.click(screen.getByText('1. Peace'));

    expect(
      screen.getByText('All conflicts shall be resolved.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('No house shall wage private war.')
    ).toBeInTheDocument();
  });
});
