import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { generateComposeOverride, generateDockerfileLines } from './generators';

interface ComposeConfig {
  services: Record<string, any>;
  networks: Record<string, any>;
}

describe('Generators', () => {
  describe('generateComposeOverride', () => {
    it('should generate valid YAML with labels and environment variables', () => {
      const params = {
        serviceName: 'test-app',
        serviceId: '123',
        mainService: 'web',
        traefikRule: 'Host(`test.local`)',
        port: 3000,
        envVars: {
          KEY: 'VALUE',
          SECRET: 'QUOTED " VALUE',
        },
      };

      const result = generateComposeOverride(params);
      const parsed = yaml.load(result) as unknown as ComposeConfig;

      expect(parsed.services.web.labels).toContain('helvetia.serviceId=123');
      expect(parsed.services.web.labels).toContain(
        'traefik.http.routers.test-app.rule=Host(`test.local`)',
      );
      expect(parsed.services.web.environment).toEqual({
        KEY: 'VALUE',
        SECRET: 'QUOTED " VALUE',
      });
      expect(parsed.networks.default.name).toBe('helvetia-net');
    });

    it('should handle missing envVars', () => {
      const result = generateComposeOverride({
        serviceName: 'test',
        serviceId: '1',
        mainService: 'app',
        traefikRule: 'Host(`t.c`)',
      });
      const parsed = yaml.load(result) as unknown as ComposeConfig;
      expect(parsed.services.app.environment).toBeUndefined();
    });

    it('should protect against YAML injection in values', () => {
      const result = generateComposeOverride({
        serviceName: 'test',
        serviceId: '1',
        mainService: 'app',
        traefikRule: 'Host(`t.c`)',
        envVars: {
          EVIL: 'value\n  other_service:\n    image: busybox',
        },
      });
      const parsed = yaml.load(result) as unknown as ComposeConfig;
      // It should NOT have a second service
      expect(Object.keys(parsed.services)).toHaveLength(1);
      expect(parsed.services.app.environment.EVIL).toBe(
        'value\n  other_service:\n    image: busybox',
      );
    });
  });

  describe('generateDockerfileLines', () => {
    it('should generate properly escaped shell commands', () => {
      const envVars = {
        SIMPLE: 'value',
        SPACES: 'value with spaces',
        QUOTES: 'value " with quotes',
        INJECTION: 'value"; rm -rf /; echo "',
      };

      const { args, envs } = generateDockerfileLines(envVars);

      expect(args).toContain('echo "ARG SIMPLE" >> Dockerfile');
      expect(envs).toContain('echo "ENV SIMPLE=value" >> Dockerfile');
      expect(envs).toContain('echo "ENV SPACES=value with spaces" >> Dockerfile');
      expect(envs).toContain('echo "ENV QUOTES=value \\" with quotes" >> Dockerfile');

      const injectionLine = envs.find((l) => l.includes('INJECTION'))!;
      expect(injectionLine).toBe('echo "ENV INJECTION=value\\"; rm -rf /; echo \\"" >> Dockerfile');
    });

    it('should return empty arrays for no envVars', () => {
      const { args, envs } = generateDockerfileLines({});
      expect(args).toHaveLength(0);
      expect(envs).toHaveLength(0);
    });
  });
});
