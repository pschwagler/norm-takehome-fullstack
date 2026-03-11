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

import {
  fetchLegislation,
  uploadLegislation,
  deleteLegislation,
} from '@/lib/api';

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

  it('opens upload modal when a file is selected via the drop zone', async () => {
    renderWith(<LegislationPage />);

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'edicts.pdf', {
      type: 'application/pdf',
    });

    // Fire the change event directly to avoid the recursive click() triggered
    // by userEvent.upload on the hidden file input.
    const { fireEvent } = await import('@testing-library/react');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Upload Legislation')).toBeInTheDocument();
    });
    expect(screen.getByText('File: edicts.pdf')).toBeInTheDocument();
  });

  it('calls deleteLegislation and removes item from list', async () => {
    const mockLegislation = [
      {
        id: 10,
        name: 'Iron Islands Code',
        file_name: 'iron.pdf',
        jurisdiction: 'Iron Islands',
        laws_count: 5,
        uploaded_at: '2025-06-01T00:00:00',
        uploaded_by: null,
      },
    ];
    (fetchLegislation as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockLegislation
    );
    (deleteLegislation as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );

    renderWith(<LegislationPage />);

    await waitFor(() => {
      expect(screen.getByText('Iron Islands Code')).toBeInTheDocument();
    });

    // Hover over the card to reveal the delete button
    const card = screen.getByText('Iron Islands Code').closest('div[class]')!;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.mouseEnter(card);

    const deleteBtn = await screen.findByRole('button', {
      name: 'Delete legislation',
    });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteLegislation).toHaveBeenCalledWith(10);
    });
    await waitFor(() => {
      expect(screen.queryByText('Iron Islands Code')).not.toBeInTheDocument();
    });
  });

  it('shows error toast when delete fails', async () => {
    const mockLegislation = [
      {
        id: 11,
        name: 'Dorne Compact',
        file_name: 'dorne.pdf',
        jurisdiction: 'Dorne',
        laws_count: 3,
        uploaded_at: '2025-07-01T00:00:00',
        uploaded_by: null,
      },
    ];
    (fetchLegislation as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockLegislation
    );
    (deleteLegislation as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Server error')
    );

    renderWith(<LegislationPage />);

    await waitFor(() => {
      expect(screen.getByText('Dorne Compact')).toBeInTheDocument();
    });

    const card = screen.getByText('Dorne Compact').closest('div[class]')!;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.mouseEnter(card);

    const deleteBtn = await screen.findByRole('button', {
      name: 'Delete legislation',
    });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument();
    });
  });

  it('handleUpload success: calls uploadLegislation and shows toast', async () => {
    (uploadLegislation as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );

    renderWith(<LegislationPage />);

    // Select a file to open the modal
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'north.pdf', {
      type: 'application/pdf',
    });

    const { fireEvent } = await import('@testing-library/react');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Upload Legislation')).toBeInTheDocument();
    });

    // Fill in the legislation name
    const nameInput = screen.getByPlaceholderText('e.g. Northern Edicts');
    await userEvent.type(nameInput, 'Northern Edicts');

    // Submit the upload form
    const uploadBtn = screen.getByRole('button', { name: 'Upload' });
    await userEvent.click(uploadBtn);

    await waitFor(() => {
      expect(uploadLegislation).toHaveBeenCalledWith(
        file,
        'Northern Edicts',
        expect.any(String)
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Legislation uploaded')).toBeInTheDocument();
    });
  });

  it('handleModalClose clears pending file and closes modal', async () => {
    renderWith(<LegislationPage />);

    // Select a file to open the modal
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'cancel.pdf', {
      type: 'application/pdf',
    });

    const { fireEvent } = await import('@testing-library/react');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Upload Legislation')).toBeInTheDocument();
    });
    expect(screen.getByText('File: cancel.pdf')).toBeInTheDocument();

    // Click Cancel to close the modal
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await userEvent.click(cancelBtn);

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText('Upload Legislation')).not.toBeInTheDocument();
    });
  });
});
