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
    projectName?: string;
    environmentName?: string;
  }): string {
    const {
      serviceName,
      serviceId,
      mainService,
      traefikRule,
      port,
      envVars,
      projectName,
      environmentName,
    } = params;

    let networkName = 'helvetia-net';
    if (projectName && environmentName) {
      networkName = `helvetia-${projectName}-${environmentName}`;
    } else if (projectName) {
      networkName = `helvetia-${projectName}`;
    }

    const overrideConfig = {
      services: {
        [mainService]: {
          labels: [
            `helvetia.serviceId=${serviceId}`,
            'traefik.enable=true',
            'traefik.docker.network=helvetia-net',
            `traefik.http.routers.${serviceName}.rule=${traefikRule}`,
            `traefik.http.routers.${serviceName}.entrypoints=web`,
            `traefik.http.services.${serviceName}.loadbalancer.server.port=${port || 8080}`,
          ],
          networks: ['helvetia-net', 'project-net'],
          ...(envVars && Object.keys(envVars).length > 0 ? { environment: envVars } : {}),
        },
      },
      networks: {
        'helvetia-net': {
          external: true,
          name: 'helvetia-net',
        },
        'project-net': {
          external: true,
          name: networkName,
        },
      },
    };

    return yaml.dump(overrideConfig);
  }
}
