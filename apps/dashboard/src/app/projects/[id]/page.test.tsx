import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ProjectPage from './page';

// Mock dependencies
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
    }),
    useParams: () => ({
      id: 'proj-1',
    }),
  };
});

vi.mock('@/lib/tokenRefresh', () => ({
  fetchWithAuth: vi.fn(),
  checkAndRefreshToken: vi.fn().mockResolvedValue(true),
}));

// Mock hooks
const mutateAsyncMock = vi.fn();
vi.mock('@/hooks/useProjects', () => ({
  useProject: () => ({
    data: { id: 'proj-1', name: 'My Project', environments: [{ id: 'env-1', name: 'Production' }] },
    isLoading: false,
  }),
  useCreateEnvironment: () => ({
    mutateAsync: mutateAsyncMock,
  }),
}));

vi.mock('@/hooks/useServices', () => ({
  useServices: () => ({
    data: [],
    isLoading: false,
  }),
  useDeployService: () => ({ mutateAsync: vi.fn() }),
  useDeleteService: () => ({ mutateAsync: vi.fn() }),
  useRestartService: () => ({ mutateAsync: vi.fn() }),
  useStopService: () => ({ mutateAsync: vi.fn() }),
  useUpdateService: () => ({ mutateAsync: vi.fn() }),
  createUpdateServiceMetrics: () => vi.fn(),
}));

vi.mock('@/components/ServiceCard/ServiceCard', () => ({
  ServiceCard: () => <div>Service Card</div>,
}));

vi.mock('@/components/EditServiceModal', () => ({
  EditServiceModal: () => <div>Edit Service Modal</div>,
}));

vi.mock('@/components/LogsModal', () => ({
  LogsModal: () => <div>Logs Modal</div>,
}));

import en from '../../../locales/en.json';

vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    t: en,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock NewEnvironmentModal to check if it's passed the correct props/handler
// But better to integration test it by not mocking it?
// The problem is UI library dependencies (lucide, etc) which should be fine.
// Let's rely on the real NewEnvironmentModal implementation if possible, or mock it if we want to isolate.
// Since we wrote NewEnvironmentModal.tsx perfectly, let's use the real one?
// But it uses `lucide-react` which might be slow or problematic in some environments? No, it's fine.

// Mock EventSource
global.EventSource = class MockEventSource {
  onmessage = vi.fn();
  close = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('ProjectPage', () => {
  beforeEach(() => {
    localStorage.setItem('user', 'true');
    vi.clearAllMocks();
  });

  test('should open New Environment modal and submit creation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }, // prevent retries on failure
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ProjectPage />
      </QueryClientProvider>,
    );

    // Check project data is loaded
    await waitFor(() => {
      expect(screen.getByText('My Project')).toBeInTheDocument();
      expect(screen.getByText('Production')).toBeInTheDocument();
    });

    // Click "New Environment"
    const newEnvBtn = screen.getByText('New Environment');
    fireEvent.click(newEnvBtn);

    // Modal should be open
    expect(screen.getByRole('heading', { name: 'Create Environment' })).toBeInTheDocument();

    // Fill the input
    const input = screen.getByPlaceholderText('staging, production, testing');
    fireEvent.change(input, { target: { value: 'Staging' } });

    // Submit
    const createBtn = screen.getByRole('button', { name: 'Create Environment' });
    fireEvent.click(createBtn);

    // Verify mutation called
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        projectId: 'proj-1',
        name: 'Staging',
      });
    });
  });
});
