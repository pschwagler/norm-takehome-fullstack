import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LegislationCard from '../LegislationCard';
import type { LegislationResponse } from '@/lib/types';

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

const legislation: LegislationResponse = {
  id: 1,
  name: 'Northern Edicts',
  file_name: 'northern-edicts.pdf',
  jurisdiction: 'The North',
  laws_count: 12,
  uploaded_at: '2026-03-10T12:00:00Z',
  uploaded_by: null,
};

describe('LegislationCard', () => {
  it('renders legislation name, law count, and date', () => {
    renderWith(
      <LegislationCard
        legislation={legislation}
        isSelected={false}
        onSelect={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText('Northern Edicts')).toBeInTheDocument();
    expect(screen.getByText('12 laws')).toBeInTheDocument();
    expect(
      screen.getByText((text) => text.startsWith('uploaded '))
    ).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWith(
      <LegislationCard
        legislation={legislation}
        isSelected={false}
        onSelect={onSelect}
        onDelete={() => {}}
      />
    );

    await user.click(screen.getByText('Northern Edicts'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('shows delete button on hover and calls onDelete', async () => {
    const onDelete = vi.fn();
    renderWith(
      <LegislationCard
        legislation={legislation}
        isSelected={false}
        onSelect={() => {}}
        onDelete={onDelete}
      />
    );

    const card = screen.getByText('Northern Edicts').closest('div[class]')!;
    fireEvent.mouseEnter(card);

    const deleteBtn = screen.getByRole('button', {
      name: 'Delete legislation',
    });
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
