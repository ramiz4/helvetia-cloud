import { ServiceFormData } from '@/components/new-service/types';
import { useCreateProject, useProjects } from '@/hooks/useProjects';
import { LanguageContextType, useLanguage } from 'shared-ui';
import { useOrganizationContext } from '@/lib/OrganizationContext';
import { Project } from '@/types/project';
import { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectNameStep from './ProjectNameStep';

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

// Mock hooks
vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(),
  useCreateProject: vi.fn(),
  useProject: vi.fn(),
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockT = {
  dashboard: {
    newService: {
      step1: 'Select Project',
    },
  },
  common: {
    next: 'Next',
  },
};

const mockProjects = [
  {
    id: 'p1',
    name: 'project-1',
    environments: [
      { id: 'e1', name: 'production' },
      { id: 'e2', name: 'staging' },
    ],
  },
  {
    id: 'p2',
    name: 'project-2',
    environments: [{ id: 'e3', name: 'dev' }],
  },
];

const mockCreateMutateAsync = vi.fn();

describe('ProjectNameStep', () => {
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
    });
    vi.mocked(useProjects).mockReturnValue({
      data: mockProjects,
      isLoading: false,
    } as UseQueryResult<Project[], Error>);
    vi.mocked(useCreateProject).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    } as unknown as UseMutationResult<
      Project,
      Error,
      { name: string; organizationId?: string },
      unknown
    >);
  });

  it('renders projects and loading state', () => {
    vi.mocked(useProjects).mockReturnValue({ data: undefined, isLoading: true } as UseQueryResult<
      Project[],
      Error
    >);
    render(
      <ProjectNameStep
        data={{} as unknown as ServiceFormData}
        updateData={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByText('Loading Projects...')).toBeDefined();

    vi.mocked(useProjects).mockReturnValue({
      data: mockProjects,
      isLoading: false,
    } as unknown as UseQueryResult<Project[], Error>);
    render(
      <ProjectNameStep
        data={{} as unknown as ServiceFormData}
        updateData={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getAllByText('Select Project')).toHaveLength(2);
    expect(screen.getByText('project-1')).toBeDefined();
    expect(screen.getByText('project-2')).toBeDefined();
  });

  it('selects a project and updates data', () => {
    const updateData = vi.fn();
    render(
      <ProjectNameStep
        data={{} as unknown as ServiceFormData}
        updateData={updateData}
        onNext={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('project-1'));

    expect(updateData).toHaveBeenCalledWith({
      projectId: 'p1',
      environmentId: 'e1',
    });
  });

  it('renders environments when project is selected', () => {
    render(
      <ProjectNameStep
        data={{ projectId: 'p1', environmentId: 'e1' } as unknown as ServiceFormData}
        updateData={() => {}}
        onNext={() => {}}
      />,
    );

    expect(screen.getByText('production')).toBeDefined();
    expect(screen.getByText('staging')).toBeDefined();

    // Environment button highlights
    // We can check classes or other attributes if needed, or trust "visual" rendering of framework
  });

  it('selects an environment and updates data', () => {
    const updateData = vi.fn();
    render(
      <ProjectNameStep
        data={{ projectId: 'p1', environmentId: 'e1' } as unknown as ServiceFormData}
        updateData={updateData}
        onNext={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('staging'));
    expect(updateData).toHaveBeenCalledWith({ environmentId: 'e2' });
  });

  it('toggles new project creation mode', () => {
    render(
      <ProjectNameStep
        data={{} as unknown as ServiceFormData}
        updateData={() => {}}
        onNext={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('New Project'));
    expect(screen.getByPlaceholderText('project-name')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('project-name')).toBeNull();
  });

  it('creates a new project', async () => {
    const updateData = vi.fn();
    mockCreateMutateAsync.mockResolvedValue({
      id: 'p3',
      name: 'new-project',
      environments: [{ id: 'e4', name: 'production' }],
    });

    render(
      <ProjectNameStep
        data={{} as unknown as ServiceFormData}
        updateData={updateData}
        onNext={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('New Project'));
    fireEvent.change(screen.getByPlaceholderText('project-name'), {
      target: { value: 'new-project' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        name: 'new-project',
        organizationId: 'org1',
      });
      expect(updateData).toHaveBeenCalledWith({
        projectId: 'p3',
        environmentId: 'e4',
      });
    });
  });

  it('calls onNext when next button clicked', () => {
    const onNext = vi.fn();
    render(
      <ProjectNameStep
        data={{ projectId: 'p1', environmentId: 'e1' } as unknown as ServiceFormData}
        updateData={() => {}}
        onNext={onNext}
      />,
    );

    fireEvent.click(screen.getByText('Next'));
    expect(onNext).toHaveBeenCalled();
  });

  it('disables next button if invalid', () => {
    const onNext = vi.fn();
    render(
      <ProjectNameStep
        data={{ projectId: '', environmentId: '' } as unknown as ServiceFormData}
        updateData={() => {}}
        onNext={onNext}
      />,
    );

    // Check disabled attribute
    const button = screen.getByText('Next').closest('button');
    expect(button).toHaveProperty('disabled', true);
  });
});
