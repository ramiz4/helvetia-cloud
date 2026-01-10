import yaml from 'js-yaml';

/**
 * Builder for generating Docker Compose override files
 * Encapsulates compose file generation logic
 */
export class ComposeFileBuilder {
  /**
   * Generate a Docker Compose override file with Traefik labels
   * @param params - Configuration for the compose override
   * @returns YAML string for docker-compose.override.yml
   */
  static generateOverride(params: {
    serviceName: string;
    serviceId: string;
    mainService: string;
    traefikRule: string;
    port?: number;
    envVars?: Record<string, string>;
  }): string {
    const { serviceName, serviceId, mainService, traefikRule, port, envVars } = params;

    const overrideConfig = {
      services: {
        [mainService]: {
          labels: [
            `helvetia.serviceId=${serviceId}`,
            'traefik.enable=true',
            `traefik.http.routers.${serviceName}.rule=${traefikRule}`,
            `traefik.http.routers.${serviceName}.entrypoints=web`,
            `traefik.http.services.${serviceName}.loadbalancer.server.port=${port || 8080}`,
          ],
          networks: ['default'],
          ...(envVars && Object.keys(envVars).length > 0 ? { environment: envVars } : {}),
        },
      },
      networks: {
        default: {
          external: true,
          name: 'helvetia-net',
        },
      },
    };

    return yaml.dump(overrideConfig);
  }
}
