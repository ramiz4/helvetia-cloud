import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageContextType, useLanguage } from '../../config/LanguageContext';
import Navigation, { NavLink } from '../Navigation';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// Mock language
vi.mock('../../config/LanguageContext', async () => {
  const actual = await vi.importActual('../../config/LanguageContext');
  return {
    ...actual,
    useLanguage: vi.fn(),
  };
});

const mockT = {
  nav: {
    homeAria: 'Home',
    logoAlt: 'Logo',
    brand: 'HELVETIA',
    login: 'Login',
    selectLanguage: 'Language',
    openMenu: 'Open',
    closeMenu: 'Close',
    mobileMenu: 'Mobile',
    logout: 'Logout',
  },
  common: {
    freePlan: 'Free',
    personalAccount: 'Personal',
  },
};

const mockLinks: NavLink[] = [
  { label: 'Dashboard', href: '/', icon: () => <div data-testid="icon-dashboard" /> },
  { label: 'Deployments', href: '/deployments', icon: () => <div data-testid="icon-deploy" /> },
];

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLanguage).mockReturnValue({ t: mockT } as LanguageContextType);
  });

  const defaultProps = {
    user: null,
    isLoggedIn: false,
    onLogout: vi.fn(),
    links: mockLinks,
  };

  it('renders logo and brand', () => {
    render(<Navigation {...defaultProps} />);
    expect(screen.getByText('HELVETIA')).toBeDefined();
    expect(screen.getByAltText('Logo')).toBeDefined();
  });

  it('renders login button when logged out', () => {
    render(<Navigation {...defaultProps} />);
    // In our component, login link text comes from t.nav.login
    expect(screen.getByText('Login')).toBeDefined();
  });

  it('renders links and user menu when logged in', () => {
    const user = { id: '1', username: 'testuser' };
    render(<Navigation {...defaultProps} isLoggedIn={true} user={user} />);

    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Deployments')).toBeDefined();
    expect(screen.getByText('testuser')).toBeDefined();
  });

  it('filters hidden links', () => {
    const linksWithHidden = [
      ...mockLinks,
      { label: 'Hidden', href: '/hidden', icon: () => <div />, show: false },
    ];
    render(<Navigation {...defaultProps} links={linksWithHidden} isLoggedIn={true} />);

    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('toggles mobile menu', () => {
    render(<Navigation {...defaultProps} />);

    const openButton = screen.getByLabelText('Open');
    fireEvent.click(openButton);

    expect(screen.getByRole('navigation', { name: 'Mobile' })).toBeDefined();
    expect(screen.getByLabelText('Close')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull();
  });
});
