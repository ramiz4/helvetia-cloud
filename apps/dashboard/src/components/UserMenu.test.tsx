import { OrganizationContextType, useOrganizationContext } from '@/lib/OrganizationContext';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageContextType, useLanguage } from 'shared-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserMenu from './UserMenu';

// Mock language
vi.mock('shared-ui', async () => {
  const actual = await vi.importActual('shared-ui');
  return {
    ...actual,
    useLanguage: vi.fn(),
  };
});

vi.mock('@/lib/OrganizationContext', () => ({
  useOrganizationContext: vi.fn(),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const mockT = {
  common: {
    freePlan: 'Free Plan',
    personalAccount: 'Personal Account',
  },
  nav: {
    settings: 'Settings',
    logout: 'Log Out',
  },
  userMenu: {
    billing: 'Billing',
    pro: 'PRO',
    security: 'Security',
    support: 'Support',
  },
};

const mockUser = {
  username: 'testuser',
  avatarUrl: 'https://example.com/avatar.png',
};

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLanguage).mockReturnValue({ t: mockT } as LanguageContextType);
    vi.mocked(useOrganizationContext).mockReturnValue({
      currentOrganization: {
        id: 'org1',
        name: 'Org 1',
        slug: '',
        createdAt: '',
        updatedAt: '',
      },
      setCurrentOrganization: vi.fn(),
      organizations: [],
      isLoading: false,
    } as OrganizationContextType);
  });

  it('renders user information correctly', () => {
    render(<UserMenu user={mockUser} onLogout={() => {}} />);

    expect(screen.getByText('testuser')).toBeDefined();
    expect(screen.getByText('Free Plan')).toBeDefined();
    const avatar = screen.getByRole('img', { name: 'testuser' });
    expect(avatar).toHaveProperty('src', 'https://example.com/avatar.png');
  });

  it('renders fallback icon when no avatar url', () => {
    render(<UserMenu user={{ username: 'noavatar' }} onLogout={() => {}} />);

    // Check if the user icon container exists (can check by SVG presence or logic)
    // The fallback is a User icon from lucide-react.
    // We can just query by text 'noavatar' first.
    expect(screen.getByText('noavatar')).toBeDefined();
    // Verify no image tag
    const images = screen.queryAllByRole('img');
    expect(images.length).toBe(0);
  });

  it('toggles menu visibility', () => {
    render(<UserMenu user={mockUser} onLogout={() => {}} />);

    // Menu should be closed initially
    expect(screen.queryByRole('menu')).toBeNull();

    // Click to open
    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));
    expect(screen.getByRole('menu')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();

    // Click to close
    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <UserMenu user={mockUser} onLogout={() => {}} />
      </div>,
    );

    // Open menu
    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));
    expect(screen.getByRole('menu')).toBeDefined();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes when pressing Escape', () => {
    render(<UserMenu user={mockUser} onLogout={() => {}} />);

    // Open menu
    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));
    expect(screen.getByRole('menu')).toBeDefined();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onLogout when clicking logout', () => {
    const onLogout = vi.fn();
    render(<UserMenu user={mockUser} onLogout={onLogout} />);

    // Open menu
    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));

    // Click logout
    fireEvent.click(screen.getByText('Log Out'));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
