import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import NewServicePage from './page';

// Mock dependencies
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
    }),
    useSearchParams: () => ({
      get: vi.fn(),
    }),
  };
});

vi.mock('../../lib/tokenRefresh', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [{ id: 'proj-1', name: 'My Project', environments: [{ id: 'env-1', name: 'Pro' }] }],
    isLoading: false,
  }),
  useCreateProject: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

// Mock GitHubRepoPicker
vi.mock('@/components/GitHubRepoPicker', () => ({
  default: () => <div data-testid="github-repo-picker">GitHub Repo Picker</div>,
}));

import en from '../../locales/en.json';

// Mock translations
vi.mock('../../lib/LanguageContext', () => ({
  useLanguage: () => ({
    t: en,
  }),
}));

vi.mock('@/lib/OrganizationContext', () => ({
  useOrganizationContext: vi.fn(),
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { OrganizationContextType, useOrganizationContext } from '@/lib/OrganizationContext';
import { fetchWithAuth } from 'shared-ui';

describe('NewServicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOrganizationContext).mockReturnValue({
      currentOrganization: {
        id: 'org-1',
        name: 'My Org',
        slug: '',
        createdAt: '',
        updatedAt: '',
      },
      organizations: [
        {
          id: 'org-1',
          name: 'My Org',
          slug: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
      setCurrentOrganization: vi.fn(),
      isLoading: false,
    } as OrganizationContextType);
  });

  test('should send correct payload for Static Site Service', async () => {
    // Setup fetchWithAuth mocks
    // 1. Create service response
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-service-id' }),
    } as Response);
    // 2. Deploy service response
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-deployment-id' }),
    } as Response);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <NewServicePage />
      </QueryClientProvider>,
    );

    // Step 1: Select Project and Environment
    // Select Project
    const projectBtn = screen.getByText('My Project');
    fireEvent.click(projectBtn);

    const nextBtnStep1 = screen.getByText('Next');
    fireEvent.click(nextBtnStep1);

    // Step 2: Select Manual Git Import
    const manualImportBtn = screen.getByText('Manual Git Import');
    fireEvent.click(manualImportBtn);

    // Enter Repo URL
    const repoInput = screen.getByPlaceholderText('https://github.com/...');
    fireEvent.change(repoInput, { target: { value: 'https://github.com/test/repo' } });

    // Click Next (Step 2 -> Step 3)
    // Note: The "Next" button might have the same text, but in Step 2 it's rendered freshly.
    // Since we are moving forward, we can grab the button again.
    // However, getting by text "Next" might act on the previous button if it were arguably still there (transition),
    // but in React conditional rendering it should be replaced or the same one updated.
    // To be safe, we can use getByText inside the step container if needed, but getByText('Next') usually works if only one is valid.
    /*
       Wait! In Step 2 manual import, the button says "Next".
    */
    const nextBtnStep2 = screen.getByText('Next');
    fireEvent.click(nextBtnStep2);

    // Step 3: Configure Project
    // Project Name is already filled and potentially read-only or editable, but we set it in Step 1.
    // We don't need to fill it again unless we want to change it.

    // Select Static Site
    const staticSiteBtn = screen.getByText('Static Site').closest('button');
    expect(staticSiteBtn).toBeInTheDocument();
    fireEvent.click(staticSiteBtn!);

    // Fill Branch (already 'main', let's change it)
    const branchInput = screen.getByPlaceholderText('main');
    fireEvent.change(branchInput, { target: { value: 'prod' } });

    // Verify "Output Directory" input is present (placeholder "dist")
    const outputDirInput = screen.getByPlaceholderText('dist');
    expect(outputDirInput).toBeInTheDocument();

    // Verify "Start Command" is NOT present (placeholder "npm start")
    const startCmdInput = screen.queryByPlaceholderText('npm start');
    expect(startCmdInput).not.toBeInTheDocument();

    // Set Output Directory
    fireEvent.change(outputDirInput, { target: { value: 'dist/sigil/browser' } });

    // Set Build Command
    const buildCmdInput = screen.getByPlaceholderText('npm run build');
    fireEvent.change(buildCmdInput, { target: { value: 'npm run build:prod' } });

    // Set Service Name in Step 3 (it's auto-filled from repo name as 'repo')
    const serviceNameInput = screen.getByPlaceholderText('my-awesome-service');
    fireEvent.change(serviceNameInput, { target: { value: 'my-static-site' } });

    // Submit
    const deployBtn = screen.getByText('Deploy Project');
    fireEvent.click(deployBtn);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledTimes(2);
    });

    // Check payload of the first call (Create Service)
    const createCall = vi.mocked(fetchWithAuth).mock.calls[0];
    const url = createCall[0];
    const options = createCall[1]!;
    const body = JSON.parse(options.body as string);

    expect(url).toContain('/services');
    expect(options.method).toBe('POST');

    // Key assertions for the bug fix
    expect(body).toEqual(
      expect.objectContaining({
        name: 'my-static-site',
        repoUrl: 'https://github.com/test/repo',
        branch: 'prod',
        type: 'STATIC',
        buildCommand: 'npm run build:prod',
        staticOutputDir: 'dist/sigil/browser', // This should match input
        // startCommand should be undefined (JSON.stringify removes undefined keys)
      }),
    );

    expect(body).not.toHaveProperty('startCommand');
    expect(body).not.toHaveProperty('outputDirectory'); // Should be mapped to staticOutputDir
  });

  test('should handle Docker Compose service type correctly', async () => {
    // Setup fetchWithAuth mocks
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'compose-service-id' }),
    } as Response);
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-deployment-id' }),
    } as Response);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <NewServicePage />
      </QueryClientProvider>,
    );

    // Step 1: Select Project and Environment
    // Select Project
    const projectBtn = screen.getByText('My Project');
    fireEvent.click(projectBtn);

    const nextBtnStep1 = screen.getByText('Next');
    fireEvent.click(nextBtnStep1);

    // Step 2: Select Manual Git Import (Compose is not in this list, it's a service type inside Config if not picked here?
    // Wait, the mock says "Docker Compose" is importCompose in translated strings.
    // In ImportSourceStep.tsx:
    // { id: 'github', label: t.dashboard.newService.importGithub... }
    // { id: 'github-image', ... }
    // { id: 'database', ... }
    // { id: 'manual', ... }
    // Docker Compose is a SERVICE TYPE, not an IMPORT TYPE in the new code (except maybe subtly?).
    // Actually, looking at ConfigurationStep.tsx, we have a button for 'docker', 'static', 'compose'.
    // So distinct 'Compose' IMPORTER is likely gone or merged into Manual/GitHub.

    // In the previous code, there was no separate 'Compose' Importer?
    // Let's check ImportSourceStep in previous turn.
    // It maps: github, github-image, database, manual.
    // So we must select Manual or GitHub first.
    // The test used to verify: "Verify 'Docker Compose' is NOT an option in Step 1" (Old Step 1 was Import Type).
    // Now Step 2 is Import Type.

    // So in Step 2, "Docker Compose" should NOT be visible as an import type.
    const step2ComposeBtn = screen.queryByText('Docker Compose');
    expect(step2ComposeBtn).not.toBeInTheDocument();

    // Select Manual Git Import
    const manualImportBtn = screen.getByText('Manual Git Import');
    fireEvent.click(manualImportBtn);

    // Enter Repo URL
    const repoInput = screen.getByPlaceholderText('https://github.com/...');
    fireEvent.change(repoInput, { target: { value: 'https://github.com/test/compose-repo' } });

    // Click Next
    const nextBtnStep2 = screen.getByText('Next');
    fireEvent.click(nextBtnStep2);

    // Step 3: Configuration
    // Verify 'Docker Compose' option exists (Service Type)
    // Note: The button label is importCompose: 'Docker Compose' in mocks.
    const composeServiceBtn = screen.getByText('Docker Compose');
    expect(composeServiceBtn).toBeInTheDocument();
    fireEvent.click(composeServiceBtn);

    // Verify Compose fields appear
    const composeFileInput = screen.getByPlaceholderText('docker-compose.yml');
    const mainServiceInput = screen.getByPlaceholderText('app');
    expect(composeFileInput).toBeInTheDocument();
    expect(mainServiceInput).toBeInTheDocument();

    // Verify "Build Command" is NOT present
    const buildCmdInput = screen.queryByPlaceholderText('npm run build');
    expect(buildCmdInput).not.toBeInTheDocument();

    // Fill form (Service Name auto-filled from repo as 'compose-repo', change it)
    const serviceNameInput = screen.getByPlaceholderText('my-awesome-service');
    fireEvent.change(serviceNameInput, { target: { value: 'my-compose-app' } });

    fireEvent.change(composeFileInput, { target: { value: 'compose.prod.yml' } });
    fireEvent.change(mainServiceInput, { target: { value: 'web' } });

    // Submit
    const deployBtn = screen.getByText('Deploy Project');
    fireEvent.click(deployBtn);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledTimes(2);
    });

    const createCall = vi.mocked(fetchWithAuth).mock.calls[0];
    const options = createCall[1]!;
    const body = JSON.parse(options.body as string);

    expect(body).toEqual(
      expect.objectContaining({
        name: 'my-compose-app',
        repoUrl: 'https://github.com/test/compose-repo',
        type: 'COMPOSE',
        composeFile: 'compose.prod.yml',
        mainService: 'web',
      }),
    );

    expect(body).not.toHaveProperty('buildCommand');
    expect(body).not.toHaveProperty('startCommand');
  });
});
