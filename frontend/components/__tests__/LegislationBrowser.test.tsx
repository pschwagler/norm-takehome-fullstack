import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LegislationBrowser from '../LegislationBrowser';
import type { LawGroup } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  fetchLaws: vi.fn(),
}));

import { fetchLaws } from '@/lib/api';

const mockFetchLaws = fetchLaws as ReturnType<typeof vi.fn>;

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

const mockGroups: LawGroup[] = [
  {
    topic: 'Commerce',
    laws: [
      {
        id: 1,
        section: '1.1',
        topic: 'Commerce',
        section_title: 'Trade Rules',
        text: 'All merchants must pay the crown tax.',
        jurisdiction: 'Kingdom-wide',
        legislation_id: 42,
      },
      {
        id: 2,
        section: '1.2',
        topic: 'Commerce',
        section_title: null,
        text: 'No house shall monopolize grain.',
        jurisdiction: 'Kingdom-wide',
        legislation_id: 42,
      },
    ],
  },
  {
    topic: 'Justice',
    laws: [
      {
        id: 3,
        section: '2.1',
        topic: 'Justice',
        section_title: 'Trial by Combat',
        text: 'Champions may be appointed.',
        jurisdiction: 'Kingdom-wide',
        legislation_id: 42,
      },
    ],
  },
];

describe('LegislationBrowser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns null when legislationId is null', () => {
    renderWith(
      <LegislationBrowser
        legislationId={null}
        legislationName="Royal Edicts"
        jurisdiction="Kingdom-wide"
      />
    );
    // The component returns null, so no meaningful content is rendered.
    expect(screen.queryByText('Loading laws...')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByText('No laws found.')).not.toBeInTheDocument();
  });

  it('shows a loading spinner while fetching', async () => {
    // Never resolve so loading state persists
    mockFetchLaws.mockReturnValue(new Promise(() => {}));

    renderWith(
      <LegislationBrowser
        legislationId={42}
        legislationName="Royal Edicts"
        jurisdiction="Kingdom-wide"
      />
    );

    expect(screen.getByText('Loading laws...')).toBeInTheDocument();
  });

  it('renders law groups after a successful fetch', async () => {
    mockFetchLaws.mockResolvedValue(mockGroups);

    renderWith(
      <LegislationBrowser
        legislationId={42}
        legislationName="Royal Edicts"
        jurisdiction="Kingdom-wide"
      />
    );

    // "1. Commerce" appears in both the TOC and the accordion; assert at least one exists.
    await waitFor(() => {
      expect(screen.getAllByText('1. Commerce').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('2. Justice').length).toBeGreaterThan(0);
    expect(mockFetchLaws).toHaveBeenCalledWith(42);
  });

  it('shows an error message when the fetch fails', async () => {
    mockFetchLaws.mockRejectedValue(new Error('Network error'));

    renderWith(
      <LegislationBrowser
        legislationId={42}
        legislationName="Royal Edicts"
        jurisdiction="Kingdom-wide"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('displays the legislation name as a heading', async () => {
    mockFetchLaws.mockResolvedValue(mockGroups);

    renderWith(
      <LegislationBrowser
        legislationId={42}
        legislationName="Royal Edicts"
        jurisdiction="Kingdom-wide"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Royal Edicts' })
      ).toBeInTheDocument();
    });
  });

  it('displays the jurisdiction badge alongside the heading', async () => {
    mockFetchLaws.mockResolvedValue(mockGroups);

    renderWith(
      <LegislationBrowser
        legislationId={42}
        legislationName="Royal Edicts"
        jurisdiction="Kingdom-wide"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Kingdom-wide')).toBeInTheDocument();
    });
  });

  it('hides the jurisdiction badge when jurisdiction is null', async () => {
    mockFetchLaws.mockResolvedValue(mockGroups);

    renderWith(
      <LegislationBrowser
        legislationId={42}
        legislationName="Royal Edicts"
        jurisdiction={null}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Royal Edicts' })
      ).toBeInTheDocument();
    });

    // "Kingdom-wide" should not appear anywhere since jurisdiction is null
    expect(screen.queryByText('Kingdom-wide')).not.toBeInTheDocument();
  });
});
