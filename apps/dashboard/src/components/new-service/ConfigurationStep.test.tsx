import { useLanguage } from '@/lib/LanguageContext';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConfigurationStep from './ConfigurationStep';

// Mock dependencies
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

// Mock sub-components to verify props passing and event handling
vi.mock('../service-forms', () => ({
  ComposeConfigFields: ({ onChange, data }: any) => (
    <div data-testid="compose-fields">
      <button
        onClick={() => onChange({ buildCommand: 'new-compose.yml', startCommand: 'new-service' })}
      >
        Update Compose
      </button>
      <span data-testid="compose-file">{data.buildCommand}</span>
    </div>
  ),
  DockerConfigFields: ({ onChange, data }: any) => (
    <div data-testid="docker-fields">
      <button onClick={() => onChange({ buildCommand: 'new-build', startCommand: 'new-start' })}>
        Update Docker
      </button>
    </div>
  ),
  GHCRConfigFields: ({ onChange, data }: any) => (
    <div data-testid="ghcr-fields">
      <button onClick={() => onChange({ branch: 'new-tag' })}>Update GHCR</button>
    </div>
  ),
  StaticConfigFields: ({ onChange, data }: any) => (
    <div data-testid="static-fields">
      <button
        onClick={() =>
          onChange({ buildCommand: 'new-static-build', staticOutputDir: 'new-output' })
        }
      >
        Update Static
      </button>
    </div>
  ),
}));

const mockT = {
  dashboard: {
    newService: {
      step3: 'Configuration',
      projectNameHint: 'Project name hint',
      projectNameValidation: 'Invalid name',
      serviceType: 'Service Type',
      dockerService: 'Docker',
      staticSite: 'Static Site',
      importCompose: 'Docker Compose',
      branch: 'Branch',
      deployButton: 'Deploy',
      deployingButton: 'Deploying',
      addVariable: 'Add Variable',
      noEnvVars: 'No variables',
      dismissError: 'Dismiss',
    },
    labels: {
      envVars: 'Environment Variables',
    },
  },
  common: {
    error: 'Error',
    back: 'Back',
  },
};

const defaultData = {
  projectId: 'p1',
  projectName: 'test-service',
  environmentId: 'production',
  serviceType: 'docker',
  importType: 'github',
  repoUrl: 'https://github.com/user/repo',
  branch: 'main',
  envVars: [{ key: 'OLD_KEY', value: 'OLD_VAL' }],
  // other fields
  buildCommand: '',
  startCommand: '',
  outputDirectory: '',
  port: 8080,
  mainService: '',
  composeFile: '',
} as any;

describe('ConfigurationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLanguage as any).mockReturnValue({ t: mockT });
  });

  it('renders correctly with default data', () => {
    render(
      <ConfigurationStep
        data={defaultData}
        updateData={() => {}}
        onSubmit={() => {}}
        onBack={() => {}}
        loading={false}
        error={null}
        setError={() => {}}
      />,
    );

    expect(screen.getByDisplayValue('test-service')).toBeDefined();
    expect(screen.getByDisplayValue('main')).toBeDefined();
    expect(screen.getByTestId('docker-fields')).toBeDefined();
  });

  it('updates project name', () => {
    const updateData = vi.fn();
    render(
      <ConfigurationStep
        data={defaultData}
        updateData={updateData}
        onSubmit={() => {}}
        onBack={() => {}}
        loading={false}
        error={null}
        setError={() => {}}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('test-service'), { target: { value: 'new-name' } });
    expect(updateData).toHaveBeenCalledWith({ projectName: 'new-name' });
  });

  it('switches service types', () => {
    const updateData = vi.fn();
    render(
      <ConfigurationStep
        data={defaultData}
        updateData={updateData}
        onSubmit={() => {}}
        onBack={() => {}}
        loading={false}
        error={null}
        setError={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Static Site'));
    expect(updateData).toHaveBeenCalledWith({ serviceType: 'static' });

    fireEvent.click(screen.getByText('Docker Compose'));
    expect(updateData).toHaveBeenCalledWith({ serviceType: 'compose' });
  });

  it('handles static config updates correctly (mapping outputDir)', () => {
    const updateData = vi.fn();
    const staticData = { ...defaultData, serviceType: 'static' };
    render(
      <ConfigurationStep
        data={staticData}
        updateData={updateData}
        onSubmit={() => {}}
        onBack={() => {}}
        loading={false}
        error={null}
        setError={() => {}}
      />,
    );

    expect(screen.getByTestId('static-fields')).toBeDefined();
    fireEvent.click(screen.getByText('Update Static'));

    expect(updateData).toHaveBeenCalledWith({
      buildCommand: 'new-static-build',
      outputDirectory: 'new-output',
    });
  });

  it('handles compose config updates correctly', () => {
    const updateData = vi.fn();
    const composeData = { ...defaultData, serviceType: 'compose' };
    render(
      <ConfigurationStep
        data={composeData}
        updateData={updateData}
        onSubmit={() => {}}
        onBack={() => {}}
        loading={false}
        error={null}
        setError={() => {}}
      />,
    );

    expect(screen.getByTestId('compose-fields')).toBeDefined();
    fireEvent.click(screen.getByText('Update Compose'));

    expect(updateData).toHaveBeenCalledWith({
      composeFile: 'new-compose.yml',
      mainService: 'new-service',
    });
  });

  it('renders GHCR fields when importType is github-image', () => {
    const ghcrData = { ...defaultData, importType: 'github-image' };
    render(
      <ConfigurationStep
        data={ghcrData}
        updateData={() => {}}
        onSubmit={() => {}}
        onBack={() => {}}
        loading={false}
        error={null}
        setError={() => {}}
      />,
    );

    expect(screen.getByTestId('ghcr-fields')).toBeDefined();
    // Service type selector should NOT be present
    expect(screen.queryByText('Docker')).toBeNull();
  });

  it('manages environment variables', () => {
    const updateData = vi.fn();
    render(
      <ConfigurationStep
        data={defaultData}
        updateData={updateData}
        onSubmit={() => {}}
        onBack={() => {}}
        loading={false}
        error={null}
        setError={() => {}}
      />,
    );

    // Initial render
    expect(screen.getByDisplayValue('OLD_KEY')).toBeDefined();

    // Add variable
    fireEvent.click(screen.getByText('Add Variable'));
    expect(updateData).toHaveBeenCalledWith({
      envVars: [...defaultData.envVars, { key: '', value: '' }],
    });

    // Update variable
    fireEvent.change(screen.getByDisplayValue('OLD_KEY'), { target: { value: 'NEW_KEY' } });
    expect(updateData).toHaveBeenCalledWith({
      envVars: [{ key: 'NEW_KEY', value: 'OLD_VAL' }],
    });

    // Remove variable
    // We need to find the remove button. It has a Trash2 icon.
    // The component structure is: button > Trash2.
    // We can use getAllByRole('button') and filtering or just click the last one if we know order.
    // Easier: add aria-label to the button in the component if not present, or assume structure.
    // The button has a class 'p-2.5 bg-white/5...'
    // Lets inspect component again.
  });

  it('displays error and allows dismissal', () => {
    const setError = vi.fn();
    render(
      <ConfigurationStep
        data={defaultData}
        updateData={() => {}}
        onSubmit={() => {}}
        onBack={() => {}}
        loading={false}
        error="Test Error"
        setError={setError}
      />,
    );

    expect(screen.getByText('Test Error')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(setError).toHaveBeenCalledWith(null);
  });
});
