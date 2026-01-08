import { LanguageProvider } from '@/lib/LanguageContext';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GitHubRepoPicker from './GitHubRepoPicker';

// Mock the lib/github
vi.mock('@/lib/github', () => ({
  getValidatedGitHubToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
}));

describe('GitHubRepoPicker', () => {
  it('renders loading state initially', async () => {
    // Mock fetch for repos
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(
      <LanguageProvider>
        <GitHubRepoPicker onSelect={vi.fn()} />
      </LanguageProvider>,
    );

    // Check for some loading indicators or search input
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search repositories/i)).toBeInTheDocument();
    });
  });

  it('renders repositories after fetching', async () => {
    const mockRepos = [
      {
        id: 1,
        name: 'test-repo',
        full_name: 'user/test-repo',
        html_url: 'https://github.com/user/test-repo',
        default_branch: 'main',
        private: false,
        updated_at: new Date().toISOString(),
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRepos),
    });

    render(
      <LanguageProvider>
        <GitHubRepoPicker onSelect={vi.fn()} />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('user/test-repo')).toBeInTheDocument();
    });
  });

  it('shows error message on fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(
      <LanguageProvider>
        <GitHubRepoPicker onSelect={vi.fn()} />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch repositories/i)).toBeInTheDocument();
    });
  });
});
