import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLanguage } from '../../config/LanguageContext';
import UserMenu from '../UserMenu';

// Mock language
vi.mock('../../config/LanguageContext', async () => {
  const actual = await vi.importActual('../../config/LanguageContext');
  return {
    ...actual,
    useLanguage: vi.fn(),
  };
});

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ fill, ...props }: any) => <img {...props} data-fill={fill?.toString()} />,
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
};

const mockUser = {
  username: 'testuser',
  avatarUrl: 'https://example.com/avatar.png',
};

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLanguage).mockReturnValue({ t: mockT } as any);
  });

  it('renders user information correctly', () => {
    render(<UserMenu user={mockUser} onLogout={() => { }} />);

    expect(screen.getByText('testuser')).toBeDefined();
    expect(screen.getByText('Free Plan')).toBeDefined();
    const avatar = screen.getByRole('img', { name: 'testuser' });
    expect(avatar).toHaveProperty('src', 'https://example.com/avatar.png');
  });

  it('renders custom plan label', () => {
    render(<UserMenu user={mockUser} onLogout={() => { }} planLabel="Administrator" />);
    expect(screen.getByText('Administrator')).toBeDefined();
    expect(screen.queryByText('Free Plan')).toBeNull();
  });

  it('renders fallback icon when no avatar url', () => {
    render(<UserMenu user={{ username: 'noavatar' }} onLogout={() => { }} />);

    expect(screen.getByText('noavatar')).toBeDefined();
    const images = screen.queryAllByRole('img');
    expect(images.length).toBe(0);
  });

  it('toggles menu visibility', () => {
    render(<UserMenu user={mockUser} onLogout={() => { }} />);

    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));
    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders children', () => {
    render(
      <UserMenu user={mockUser} onLogout={() => { }}>
        <div data-testid="child">Custom Child</div>
      </UserMenu>
    );

    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('closes when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <UserMenu user={mockUser} onLogout={() => { }} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));
    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes when pressing Escape', () => {
    render(<UserMenu user={mockUser} onLogout={() => { }} />);

    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));
    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onLogout when clicking logout', () => {
    const onLogout = vi.fn();
    render(<UserMenu user={mockUser} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole('button', { name: 'testuser user menu' }));

    fireEvent.click(screen.getByText('Log Out'));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
