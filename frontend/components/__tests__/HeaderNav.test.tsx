import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import HeaderNav from '../HeaderNav';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

function renderWith(ui: React.ReactNode) {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
}

describe('HeaderNav', () => {
  it('renders brand name "Westeros Capital Group"', () => {
    renderWith(<HeaderNav signOut={() => {}} />);
    expect(screen.getByText('Westeros Capital Group')).toBeInTheDocument();
  });

  it('renders nav links for Home and Legislation', () => {
    const { container } = renderWith(<HeaderNav signOut={() => {}} />);
    // NavButton wraps icon-only SVGs in unstyled buttons; the Tooltip label
    // does not produce an aria-label in happy-dom. Assert via href instead.
    const homeLink = container.querySelector('a[href="/"]');
    const legislationLink = container.querySelector('a[href="/legislation"]');
    expect(homeLink).toBeInTheDocument();
    expect(legislationLink).toBeInTheDocument();
  });

  it('renders user avatar with name "Tyrion Lannister"', () => {
    renderWith(<HeaderNav signOut={() => {}} />);
    expect(screen.getByText('Tyrion Lannister')).toBeInTheDocument();
  });

  it('calls signOut when "Sign out" menu item is clicked', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn();
    renderWith(<HeaderNav signOut={signOut} />);

    // Open the menu by clicking the avatar/chevron menu button
    const menuButton = screen.getByText('Tyrion Lannister').closest('button');
    await user.click(menuButton!);

    const signOutItem = await screen.findByText('Sign out');
    await user.click(signOutItem);

    expect(signOut).toHaveBeenCalledOnce();
  });
});
