import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UploadDropZone from '../UploadDropZone';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

describe('UploadDropZone', () => {
  it('renders drop zone instructions', () => {
    renderWith(<UploadDropZone onFileSelect={() => {}} />);
    expect(
      screen.getByText('Drag and drop a PDF here, or click to browse')
    ).toBeInTheDocument();
  });

  it('accepts PDF file on drop', () => {
    const onFileSelect = vi.fn();
    renderWith(<UploadDropZone onFileSelect={onFileSelect} />);

    const dropZone = screen
      .getByText('Drag and drop a PDF here, or click to browse')
      .closest('div[class]')!;

    const pdfFile = new File(['%PDF-1.4'], 'laws.pdf', {
      type: 'application/pdf',
    });

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [pdfFile] },
    });

    expect(onFileSelect).toHaveBeenCalledWith(pdfFile);
  });

  it('rejects non-PDF file on drop', () => {
    const onFileSelect = vi.fn();
    renderWith(<UploadDropZone onFileSelect={onFileSelect} />);

    const dropZone = screen
      .getByText('Drag and drop a PDF here, or click to browse')
      .closest('div[class]')!;

    const txtFile = new File(['hello'], 'readme.txt', {
      type: 'text/plain',
    });

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [txtFile] },
    });

    expect(onFileSelect).not.toHaveBeenCalled();
    expect(screen.getByText('Only PDF files are accepted')).toBeInTheDocument();
  });
});
