import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import UploadModal from '../UploadModal';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

const file = new File(['%PDF-1.4'], 'laws.pdf', {
  type: 'application/pdf',
});

describe('UploadModal', () => {
  it('renders file name and form fields when open', () => {
    renderWith(
      <UploadModal
        isOpen={true}
        onClose={() => {}}
        file={file}
        onUpload={() => {}}
        isUploading={false}
      />
    );
    expect(screen.getByText('File: laws.pdf')).toBeInTheDocument();
    expect(screen.getByText('Document Name')).toBeInTheDocument();
    expect(
      screen.getByText('Jurisdiction (optional)')
    ).toBeInTheDocument();
  });

  it('calls onUpload with name and default jurisdiction', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    renderWith(
      <UploadModal
        isOpen={true}
        onClose={() => {}}
        file={file}
        onUpload={onUpload}
        isUploading={false}
      />
    );

    await user.type(
      screen.getByPlaceholderText('e.g. Northern Edicts'),
      'Royal Decrees'
    );
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(onUpload).toHaveBeenCalledWith('Royal Decrees', 'Kingdom-wide');
  });

  it('disables upload button when name is empty', () => {
    renderWith(
      <UploadModal
        isOpen={true}
        onClose={() => {}}
        file={file}
        onUpload={() => {}}
        isUploading={false}
      />
    );
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });
});
