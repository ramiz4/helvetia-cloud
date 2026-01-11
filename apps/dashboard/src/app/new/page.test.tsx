import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import NewServicePage from './page';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('../../lib/tokenRefresh', () => ({
  fetchWithAuth: vi.fn(),
}));

// Mock GitHubRepoPicker
vi.mock('@/components/GitHubRepoPicker', () => ({
  default: () => <div data-testid="github-repo-picker">GitHub Repo Picker</div>,
}));

// Mock translations to return English strings for keys we check
vi.mock('../../lib/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      common: {
        back: 'Back',
        next: 'Next',
        error: 'Error',
        success: 'Success',
      },
      dashboard: {
        newService: {
          title: 'Deploy a new Project',
          subtitle: 'Subtitle',
          importGithub: 'GitHub Import',
          importManual: 'Manual Git Import',
          importLocal: 'Local Folder',
          importCompose: 'Docker Compose',
          importDatabase: 'Database',
          step1: 'Step 1',
          step2: 'Step 2',
          repoUrl: 'Git Repository URL',
          projectName: 'Service Name',
          serviceType: 'Service Type',
          dockerService: 'Docker Service',
          staticSite: 'Static Site',
          buildCommand: 'Build Command',
          startCommand: 'Start Command',
          outputDirectory: 'Output Directory',
          port: 'Port',
          deployButton: 'Deploy Project',
          deployingButton: 'Deploying...',
          addVariable: 'Add Variable',
          noEnvVars: 'No env vars',
        },
        labels: {
          envVars: 'Environment Variables',
        },
      },
      footer: {
        hostedInSwiss: 'Hosted in Switzerland',
      },
    },
  }),
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { fetchWithAuth } from '../../lib/tokenRefresh';

describe('NewServicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    render(<NewServicePage />);

    // Step 1: Select Manual Git Import
    const manualImportBtn = screen.getByText('Manual Git Import');
    fireEvent.click(manualImportBtn);

    // Enter Repo URL
    const repoInput = screen.getByPlaceholderText('https://github.com/...');
    fireEvent.change(repoInput, { target: { value: 'https://github.com/test/repo' } });

    // Click Next
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    // Step 2: Configure Project
    // Fill Project Name
    const nameInput = screen.getByPlaceholderText('my-awesome-service');
    fireEvent.change(nameInput, { target: { value: 'my-static-site' } });

    // Select Static Site
    // Instead of finding by text which might be inside a span, let's click the button that contains "Static Site"
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

    render(<NewServicePage />);

    // Step 1: Verify 'Docker Compose' is NOT an option in Step 1
    const step1ComposeBtn = screen.queryByText('Docker Compose');
    expect(step1ComposeBtn).not.toBeInTheDocument();

    // Select Manual Git Import
    const manualImportBtn = screen.getByText('Manual Git Import');
    fireEvent.click(manualImportBtn);

    // Enter Repo URL
    const repoInput = screen.getByPlaceholderText('https://github.com/...');
    fireEvent.change(repoInput, { target: { value: 'https://github.com/test/compose-repo' } });

    // Click Next
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    // Step 2: Verify 'Docker Compose' option exists
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

    // Fill form
    const nameInput = screen.getByPlaceholderText('my-awesome-service');
    fireEvent.change(nameInput, { target: { value: 'my-compose-app' } });

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
