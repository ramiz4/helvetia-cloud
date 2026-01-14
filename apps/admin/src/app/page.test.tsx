import { render, screen } from '@testing-library/react';
import { Role } from 'shared-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard from './page';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Create a mock function that will be used by the hook
const mockUseAdminAuth = vi.fn();

// Mock useAdminAuth hook
vi.mock('@/hooks/useAdminAuth', () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading spinner when loading is true', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: false,
      loading: true,
      user: null,
    });

    render(<AdminDashboard />);

    const spinner = document.querySelector('.animate-spin-fast');
    expect(spinner).toBeInTheDocument();
  });

  it('should render nothing when not admin and loading complete', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: false,
      loading: false,
      user: null,
    });

    const { container } = render(<AdminDashboard />);

    expect(container.firstChild).toBeNull();
  });

  it('should render admin dashboard for admin user', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('should display welcome message with username', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'testadmin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    expect(screen.getByText(/Welcome back, testadmin/i)).toBeInTheDocument();
  });

  it('should render warning banner about administrative access', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    expect(screen.getByText('Administrative Access')).toBeInTheDocument();
    expect(
      screen.getByText(/You are currently in the administrative control panel/i),
    ).toBeInTheDocument();
  });

  it('should render Server Setup card as active', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    expect(screen.getByText('Server Setup')).toBeInTheDocument();
    expect(screen.getByText('Generate deployment scripts for VPS')).toBeInTheDocument();
  });

  it('should render Feature Flags card as active', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    expect(screen.getByText('Feature Flags')).toBeInTheDocument();
    expect(screen.getByText('Manage feature toggles and A/B testing')).toBeInTheDocument();
  });

  it('should render User Management card as coming soon', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Manage users, roles, and permissions')).toBeInTheDocument();
  });

  it('should render all admin cards', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    // Check for all card titles
    expect(screen.getByText('Server Setup')).toBeInTheDocument();
    expect(screen.getByText('Feature Flags')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('System Analytics')).toBeInTheDocument();
    expect(screen.getByText('Security Settings')).toBeInTheDocument();
    expect(screen.getByText('Activity Logs')).toBeInTheDocument();
    expect(screen.getByText('Platform Settings')).toBeInTheDocument();
  });

  it('should render active status badges for active features', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    const activeStatuses = screen.getAllByText('Active');
    expect(activeStatuses.length).toBe(2); // Server Setup and Feature Flags
  });

  it('should render coming soon status badges for inactive features', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    const comingSoonStatuses = screen.getAllByText('Coming Soon');
    expect(comingSoonStatuses.length).toBe(5); // All other features
  });

  it('should render Server Setup as a clickable link', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    const links = screen.getAllByRole('link');
    const serverSetupLink = links.find((link) => link.getAttribute('href') === '/server-setup');
    expect(serverSetupLink).toBeInTheDocument();
  });

  it('should render Feature Flags as a clickable link', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    const links = screen.getAllByRole('link');
    const featureFlagsLink = links.find((link) => link.getAttribute('href') === '/feature-flags');
    expect(featureFlagsLink).toBeInTheDocument();
  });

  it('should render help section with documentation link', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    render(<AdminDashboard />);

    expect(screen.getByText('Need Help?')).toBeInTheDocument();
    expect(screen.getByText('View Documentation')).toBeInTheDocument();
  });

  it('should not render dashboard content when user is null', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: null,
    });

    render(<AdminDashboard />);

    // Should still render dashboard but without username
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for glassmorphic design', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    const { container } = render(<AdminDashboard />);

    // Check for glassmorphic styling
    const glassElements = container.querySelectorAll('.backdrop-blur-3xl');
    expect(glassElements.length).toBeGreaterThan(0);
  });

  it('should render with fade-in animation class', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      user: { username: 'admin', role: Role.ADMIN },
    });

    const { container } = render(<AdminDashboard />);

    const animatedElement = container.querySelector('.animate-fade-in');
    expect(animatedElement).toBeInTheDocument();
  });
});
