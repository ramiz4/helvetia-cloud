import { LanguageContextType, useLanguage } from '@/lib/LanguageContext';
import { fetchWithAuth } from 'shared-ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GitHubImagePicker from './GitHubImagePicker';

// Mock dependencies
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

vi.mock('@/lib/tokenRefresh', () => ({
  fetchWithAuth: vi.fn(),
}));

// Setup default mocks
const mockT = {
  githubPicker: {
    loadingOrgs: 'Loading organizations...',
    allRepos: 'Personal / All',
    noOrgsFound: 'No organizations found',
    sessionExpired: 'Session expired',
  },
};

const mockPackages = [
  {
    id: 1,
    name: 'backend-service',
    package_type: 'container',
    owner: { login: 'octocat', id: 583231, avatar_url: '...' },
    version_count: 5,
    visibility: 'public',
    url: '...',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    html_url: 'https://github.com/octocat/backend-service',
  },
  {
    id: 2,
    name: 'frontend-app',
    package_type: 'container',
    owner: { login: 'octocat', id: 583231, avatar_url: '...' },
    version_count: 10,
    visibility: 'private',
    url: '...',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-03T00:00:00Z',
    html_url: 'https://github.com/octocat/frontend-app',
  },
];

const mockOrgs = [{ login: 'acme-corp', avatar_url: '...' }];

describe('GitHubImagePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLanguage).mockReturnValue({ t: mockT } as LanguageContextType);
    // Default fetch mocks
    vi.mocked(fetchWithAuth).mockImplementation((url: string) => {
      if (url.includes('/github/orgs')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockOrgs,
        } as unknown as Response);
      }
      if (url.includes('/github/packages')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPackages,
        } as unknown as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('renders and fetches orgs and packages on mount', async () => {
    render(<GitHubImagePicker onSelect={() => {}} />);

    // Should start loading
    expect(screen.getByPlaceholderText('Search packages...')).toBeDefined();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('backend-service')).toBeDefined();
      expect(screen.getByText('frontend-app')).toBeDefined();
      expect(screen.getByText('acme-corp')).toBeDefined(); // Inside select option
    });
  });

  it('filters packages via search input', async () => {
    render(<GitHubImagePicker onSelect={() => {}} />);

    await waitFor(() => expect(screen.getByText('backend-service')).toBeDefined());

    const searchInput = screen.getByPlaceholderText('Search packages...');
    fireEvent.change(searchInput, { target: { value: 'front' } });

    expect(screen.getByText('frontend-app')).toBeDefined();
    expect(screen.queryByText('backend-service')).toBeNull();
  });

  it('fetches packages for selected organization', async () => {
    render(<GitHubImagePicker onSelect={() => {}} />);

    await waitFor(() => expect(screen.getByText('acme-corp')).toBeDefined());

    const select = screen.getByRole('combobox');

    // Clear previous calls
    vi.mocked(fetchWithAuth).mockClear();

    // Select org
    fireEvent.change(select, { target: { value: 'acme-corp' } });

    expect(fetchWithAuth).toHaveBeenCalledWith(expect.stringContaining('?org=acme-corp'));
  });

  it('handles package selection', async () => {
    const onSelect = vi.fn();
    render(<GitHubImagePicker onSelect={onSelect} />);

    await waitFor(() => expect(screen.getByText('backend-service')).toBeDefined());

    fireEvent.click(screen.getByText('backend-service'));

    // Should switch to config view
    expect(screen.getByText('View on GitHub')).toBeDefined();
    expect(onSelect).toHaveBeenCalledWith('ghcr.io/octocat/backend-service', 'backend-service');
  });

  it('allows resetting selection', async () => {
    render(<GitHubImagePicker onSelect={() => {}} />);

    await waitFor(() => expect(screen.getByText('backend-service')).toBeDefined());
    fireEvent.click(screen.getByText('backend-service'));

    const changeBtn = screen.getByText('Change Package');
    fireEvent.click(changeBtn);

    // Should be back to list view
    expect(screen.getByPlaceholderText('Search packages...')).toBeDefined();
  });

  it('displays error message on fetch failure', async () => {
    vi.mocked(fetchWithAuth).mockImplementation((url: string) => {
      if (url.includes('/github/packages')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: 'Failed' }),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as unknown as Response);
    });

    render(<GitHubImagePicker onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch packages')).toBeDefined();
    });
  });

  it('handles 401 error by clearing user and showing message', async () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    vi.mocked(fetchWithAuth).mockImplementation((url: string) => {
      if (url.includes('/github/packages')) {
        return Promise.resolve({
          ok: false,
          status: 401,
        } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as unknown as Response);
    });

    render(<GitHubImagePicker onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Session expired')).toBeDefined();
    });
    expect(removeItemSpy).toHaveBeenCalledWith('user');
  });
});
