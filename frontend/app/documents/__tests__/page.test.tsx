import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import DocumentsPage from '../page';

vi.mock('@/lib/api', () => ({
  fetchDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  uploadDocument: vi.fn(),
  fetchLaws: vi.fn(),
}));

import { fetchDocuments, uploadDocument } from '@/lib/api';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

describe('Documents Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchDocuments as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('renders upload drop zone and empty document list', async () => {
    renderWith(<DocumentsPage />);
    expect(screen.getByText('Documents')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No documents uploaded yet.')).toBeInTheDocument();
    });
  });

  it('loads documents on mount', async () => {
    const mockDocs = [
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
    (fetchDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(mockDocs);

    renderWith(<DocumentsPage />);

    await waitFor(() => {
      expect(fetchDocuments).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(
        screen.getByText('Laws of the Seven Kingdoms')
      ).toBeInTheDocument();
    });
  });

  it('renders upload drop zone', () => {
    renderWith(<DocumentsPage />);
    expect(
      screen.getByText(/drag.*pdf|drop.*pdf|click.*upload/i)
    ).toBeInTheDocument();
  });
});
