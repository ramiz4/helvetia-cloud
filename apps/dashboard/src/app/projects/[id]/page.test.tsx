import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ProjectPage from './page';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  mutateCreateEnv: vi.fn(),
  mutateUpdateService: vi.fn(),
  mutateDeleteService: vi.fn(),
  mutateDeployService: vi.fn(),
  mutateRestartService: vi.fn(),
  mutateStopService: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

// Mock dependencies
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({
      push: mocks.push,
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

const mockServices = [
  {
    id: 's1',
    name: 'Service 1',
    status: 'RUNNING',
    environmentId: 'env-1',
    createdAt: '2023-01-01',
    deployments: [],
  },
  {
    id: 's2',
    name: 'Service 2',
    status: 'FAILED',
    environmentId: 'env-1',
    createdAt: '2023-01-02',
    deployments: [],
  },
];

vi.mock('@/hooks/useProjects', () => ({
  useProject: () => ({
    data: { id: 'proj-1', name: 'My Project', environments: [{ id: 'env-1', name: 'Production' }] },
    isLoading: false,
  }),
  useCreateEnvironment: () => ({
    mutateAsync: mocks.mutateCreateEnv,
  }),
}));

vi.mock('@/hooks/useServices', () => ({
  useServices: () => ({
    data: mockServices,
    isLoading: false,
  }),
  useDeployService: () => ({ mutateAsync: mocks.mutateDeployService }),
  useDeleteService: () => ({ mutateAsync: mocks.mutateDeleteService }),
  useRestartService: () => ({ mutateAsync: mocks.mutateRestartService }),
  useStopService: () => ({ mutateAsync: mocks.mutateStopService }),
  useUpdateService: () => ({ mutateAsync: mocks.mutateUpdateService }),
  createUpdateServiceMetrics: () => vi.fn(),
}));

vi.mock('@/components/ServiceCard/ServiceCard', () => ({
  ServiceCard: ({
    service,
    onEdit,
    onDelete,
    onDeploy,
    onRestart,
    onStop,
    onViewLogs,
  }: {
    service: { id: string; name: string };
    onEdit: (s: { id: string; name: string }) => void;
    onDelete: (id: string) => void;
    onDeploy: (id: string) => void;
    onRestart: (id: string) => void;
    onStop: (id: string) => void;
    onViewLogs: (id: string) => void;
  }) => (
    <div data-testid={`service-${service.id}`}>
      {service.name}
      <button onClick={() => onEdit(service)}>Edit</button>
      <button onClick={() => onDelete(service.id)}>Delete</button>
      <button onClick={() => onDeploy(service.id)}>Deploy</button>
      <button onClick={() => onRestart(service.id)}>Restart</button>
      <button onClick={() => onStop(service.id)}>Stop</button>
      <button onClick={() => onViewLogs(service.id + '-dep')}>Logs</button>
    </div>
  ),
}));

vi.mock('@/components/EditServiceModal', () => ({
  EditServiceModal: ({
    onSave,
    onClose,
    service,
  }: {
    onSave: (service: unknown, envVars: unknown) => void;
    onClose: () => void;
    service: unknown;
  }) => (
    <div data-testid="edit-modal">
      Edit Modal
      <button onClick={() => onSave(service, [{ key: 'NEW_VAR', value: '123' }])}>Save</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('@/components/LogsModal', () => ({
  LogsModal: ({ onClose, logs }: { onClose: () => void; logs: string }) => (
    <div data-testid="logs-modal">
      Logs: {logs}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import en from '../../../locales/en.json';

vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    t: en,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

// Mock EventSource
global.EventSource = class MockEventSource implements EventSource {
  onmessage = vi.fn();
  onopen = vi.fn();
  onerror = vi.fn();
  close = vi.fn();
  url = '';
  withCredentials = false;
  readonly readyState = 0;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
    this.url = url.toString();
    this.withCredentials = eventSourceInitDict?.withCredentials ?? false;
  }

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
};

describe('ProjectPage', () => {
  beforeEach(() => {
    localStorage.setItem('user', 'true');
    vi.clearAllMocks();
    global.confirm = vi.fn(() => true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );

  test('renders project details and services', async () => {
    render(<ProjectPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('My Project')).toBeInTheDocument();
      expect(screen.getByText('Production')).toBeInTheDocument();
      expect(screen.getByText('Service 1')).toBeInTheDocument();
      expect(screen.getByText('Service 2')).toBeInTheDocument();
    });
  });

  test('redirects to login if no user', async () => {
    localStorage.removeItem('user');
    render(<ProjectPage />, { wrapper });

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith('/login');
    });
  });

  test('handles environment creation', async () => {
    render(<ProjectPage />, { wrapper });

    await waitFor(() => expect(screen.getByText('New Environment')).toBeInTheDocument());

    fireEvent.click(screen.getByText('New Environment'));
    expect(screen.getByRole('heading', { name: 'Create Environment' })).toBeInTheDocument();

    const input = screen.getByPlaceholderText('staging, production, testing');
    fireEvent.change(input, { target: { value: 'Staging' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Environment' }));

    await waitFor(() => {
      expect(mocks.mutateCreateEnv).toHaveBeenCalledWith({ projectId: 'proj-1', name: 'Staging' });
      expect(mocks.toastSuccess).toHaveBeenCalled();
    });
  });

  test('handles service delete', async () => {
    render(<ProjectPage />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('service-s1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Delete', { selector: '[data-testid="service-s1"] button' }));

    await waitFor(() => {
      expect(mocks.mutateDeleteService).toHaveBeenCalledWith('s1');
      expect(mocks.toastSuccess).toHaveBeenCalled();
    });
  });

  test('handles service restart', async () => {
    render(<ProjectPage />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('service-s1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Restart', { selector: '[data-testid="service-s1"] button' }));

    await waitFor(() => {
      expect(mocks.mutateRestartService).toHaveBeenCalledWith('s1');
      expect(mocks.toastSuccess).toHaveBeenCalled();
    });
  });

  test('handles service stop', async () => {
    render(<ProjectPage />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('service-s1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Stop', { selector: '[data-testid="service-s1"] button' }));

    await waitFor(() => {
      expect(mocks.mutateStopService).toHaveBeenCalledWith('s1');
      expect(mocks.toastSuccess).toHaveBeenCalled();
    });
  });

  test('handles service deploy', async () => {
    mocks.mutateDeployService.mockResolvedValue({ id: 'dep-1' });
    // Mock the logs fetch which happens after deploy
    const { fetchWithAuth } = await import('@/lib/tokenRefresh');
    vi.mocked(fetchWithAuth).mockResolvedValue({
      json: async () => ({ logs: 'Build started...' }),
    } as unknown as Response);

    render(<ProjectPage />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('service-s1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Deploy', { selector: '[data-testid="service-s1"] button' }));

    await waitFor(() => {
      expect(mocks.mutateDeployService).toHaveBeenCalledWith('s1');
      // Check if logs are shown
      expect(screen.getByTestId('logs-modal')).toBeInTheDocument();
      expect(screen.getByText('Logs: Build started...')).toBeInTheDocument();
    });
  });

  test('handles service update', async () => {
    render(<ProjectPage />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('service-s1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Edit', { selector: '[data-testid="service-s1"] button' }));
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mocks.mutateUpdateService).toHaveBeenCalledWith({
        id: 's1',
        data: expect.objectContaining({
          envVars: { NEW_VAR: '123' },
        }),
      });
      expect(mocks.toastSuccess).toHaveBeenCalled();
    });
  });

  test('handles view logs', async () => {
    const { fetchWithAuth } = await import('@/lib/tokenRefresh');
    vi.mocked(fetchWithAuth).mockResolvedValue({
      json: async () => ({ logs: 'Existing logs...' }),
    } as unknown as Response);

    render(<ProjectPage />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('service-s1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Logs', { selector: '[data-testid="service-s1"] button' }));

    await waitFor(() => {
      expect(screen.getByTestId('logs-modal')).toBeInTheDocument();
      expect(screen.getByText('Logs: Existing logs...')).toBeInTheDocument();
    });
  });

  test('closes logs modal', async () => {
    // First open logs
    const { fetchWithAuth } = await import('@/lib/tokenRefresh');
    vi.mocked(fetchWithAuth).mockResolvedValue({
      json: async () => ({ logs: 'Log content' }),
    } as unknown as Response);

    render(<ProjectPage />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('service-s1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Logs', { selector: '[data-testid="service-s1"] button' }));

    await waitFor(() => expect(screen.getByTestId('logs-modal')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('logs-modal')).not.toBeInTheDocument();
  });
});
