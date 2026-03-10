import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import QueryInput from '../QueryInput';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

describe('QueryInput', () => {
  it('renders input and submit button', () => {
    renderWith(<QueryInput onSubmit={() => {}} isLoading={false} />);
    expect(
      screen.getByPlaceholderText('Enter your question...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeInTheDocument();
  });

  it('disables submit when input is empty', () => {
    renderWith(<QueryInput onSubmit={() => {}} isLoading={false} />);
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  });

  it('calls onSubmit with query text and clears input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWith(<QueryInput onSubmit={onSubmit} isLoading={false} />);

    const input = screen.getByPlaceholderText('Enter your question...');
    await user.type(input, 'What are the laws of the North?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(onSubmit).toHaveBeenCalledWith('What are the laws of the North?');
    expect(input).toHaveValue('');
  });

  it('disables submit when loading', () => {
    renderWith(<QueryInput onSubmit={() => {}} isLoading={true} />);
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  });
});
