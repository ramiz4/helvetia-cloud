import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComposeConfigFields } from './ComposeConfigFields';
import { DatabaseConfigFields } from './DatabaseConfigFields';
import { DockerConfigFields } from './DockerConfigFields';
import { GHCRConfigFields } from './GHCRConfigFields';
import { StaticConfigFields } from './StaticConfigFields';

import en from '../../locales/en.json';

const mockTranslations = en.dashboard;

describe('Service Config Fields', () => {
  describe('DatabaseConfigFields', () => {
    it('renders database engine message', () => {
      render(
        <DatabaseConfigFields translations={mockTranslations} data={{}} onChange={() => {}} />,
      );
      expect(screen.getByText('Database Engine')).toBeDefined();
      expect(screen.getByText(/Managed databases are configured automatically/)).toBeDefined();
    });
  });

  describe('GHCRConfigFields', () => {
    it('renders and handles input changes', () => {
      const onChange = vi.fn();
      render(
        <GHCRConfigFields
          translations={mockTranslations}
          data={{ branch: 'v1', startCommand: 'npm start', port: 3000 }}
          onChange={onChange}
        />,
      );

      expect(screen.getByDisplayValue('v1')).toBeDefined();
      expect(screen.getByDisplayValue('npm start')).toBeDefined();
      expect(screen.getByDisplayValue('3000')).toBeDefined();

      fireEvent.change(screen.getByPlaceholderText('latest'), { target: { value: 'latest-v2' } });
      expect(onChange).toHaveBeenCalledWith({ branch: 'latest-v2' });

      fireEvent.change(screen.getByPlaceholderText('optional override'), {
        target: { value: 'node app.js' },
      });
      expect(onChange).toHaveBeenCalledWith({ startCommand: 'node app.js' });

      fireEvent.change(screen.getByPlaceholderText('8080'), { target: { value: '80' } });
      expect(onChange).toHaveBeenCalledWith({ port: 80 });
    });
  });

  describe('DockerConfigFields', () => {
    it('renders and handles input changes', () => {
      const onChange = vi.fn();
      render(
        <DockerConfigFields
          translations={mockTranslations}
          data={{ buildCommand: 'npm run test', startCommand: 'npm start' }}
          onChange={onChange}
        />,
      );

      expect(screen.getByDisplayValue('npm run test')).toBeDefined();
      expect(screen.getByDisplayValue('npm start')).toBeDefined();

      fireEvent.change(screen.getByPlaceholderText('npm run build'), {
        target: { value: 'yarn build' },
      });
      expect(onChange).toHaveBeenCalledWith({ buildCommand: 'yarn build' });

      fireEvent.change(screen.getByPlaceholderText('npm start'), {
        target: { value: 'yarn start' },
      });
      expect(onChange).toHaveBeenCalledWith({ startCommand: 'yarn start' });
    });
  });

  describe('StaticConfigFields', () => {
    it('renders and handles input changes', () => {
      const onChange = vi.fn();
      render(
        <StaticConfigFields
          translations={mockTranslations}
          data={{ buildCommand: 'npm run build', staticOutputDir: 'dist' }}
          onChange={onChange}
        />,
      );

      expect(screen.getByDisplayValue('npm run build')).toBeDefined();
      expect(screen.getByDisplayValue('dist')).toBeDefined();

      fireEvent.change(screen.getByPlaceholderText('npm run build'), {
        target: { value: 'yarn build' },
      });
      expect(onChange).toHaveBeenCalledWith({ buildCommand: 'yarn build' });

      fireEvent.change(screen.getByPlaceholderText('dist'), { target: { value: 'out' } });
      expect(onChange).toHaveBeenCalledWith({ staticOutputDir: 'out' });
    });
  });

  describe('ComposeConfigFields', () => {
    it('renders and handles input changes', () => {
      const onChange = vi.fn();
      render(
        <ComposeConfigFields
          translations={mockTranslations}
          data={{ buildCommand: 'docker-compose.yml', startCommand: 'api' }}
          onChange={onChange}
        />,
      );

      expect(screen.getByDisplayValue('docker-compose.yml')).toBeDefined();
      expect(screen.getByDisplayValue('api')).toBeDefined();

      fireEvent.change(screen.getByPlaceholderText('docker-compose.yml'), {
        target: { value: 'prod.yml' },
      });
      expect(onChange).toHaveBeenCalledWith({ buildCommand: 'prod.yml' });

      fireEvent.change(screen.getByPlaceholderText('app'), { target: { value: 'backend' } });
      expect(onChange).toHaveBeenCalledWith({ startCommand: 'backend' });
    });
  });
});
