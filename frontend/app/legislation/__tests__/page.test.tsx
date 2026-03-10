import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LegislationPage from '../page';

vi.mock('@/lib/api', () => ({
  fetchLegislation: vi.fn(),
  deleteLegislation: vi.fn(),
  uploadLegislation: vi.fn(),
  fetchLaws: vi.fn(),
}));

import { fetchLegislation, uploadLegislation } from '@/lib/api';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

describe('Legislation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchLegislation as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('renders upload drop zone and empty legislation list', async () => {
    renderWith(<LegislationPage />);
    expect(screen.getByText('Legislation')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText('No legislation uploaded yet.')
      ).toBeInTheDocument();
    });
  });

  it('loads legislation on mount', async () => {
    const mockLegislation = [
      {
        id: 1,
        name: 'Laws of the Seven Kingdoms',
        file_name: 'laws.pdf',
        jurisdiction: 'Kingdom-wide',
        laws_count: 42,
        uploaded_at: '2025-01-01T00:00:00',
        uploaded_by: null,
      },
    ];
    (fetchLegislation as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockLegislation
    );

    renderWith(<LegislationPage />);

    await waitFor(() => {
      expect(fetchLegislation).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(
        screen.getByText('Laws of the Seven Kingdoms')
      ).toBeInTheDocument();
    });
  });

  it('renders upload drop zone', () => {
    renderWith(<LegislationPage />);
    expect(
      screen.getByText(/drag.*pdf|drop.*pdf|click.*upload/i)
    ).toBeInTheDocument();
  });
});
