import yaml from 'js-yaml';
import { getNetworkName } from '../containerHelpers';

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
    username?: string;
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
      username,
    } = params;

    const networkName = getNetworkName({ username, projectName, environmentName });
    const sanitizedUsername = username
      ? username.toLowerCase().replace(/[^a-z0-9]/g, '-')
      : 'global';
    let traefikIdentifier = `${sanitizedUsername}-${serviceName}`;

    if (projectName && environmentName) {
      traefikIdentifier = `${sanitizedUsername}-${projectName}-${environmentName}-${serviceName}`;
    } else if (projectName) {
      traefikIdentifier = `${sanitizedUsername}-${projectName}-${serviceName}`;
    }

    const overrideConfig = {
      services: {
        [mainService]: {
          labels: [
            `helvetia.serviceId=${serviceId}`,
            'traefik.enable=true',
            'traefik.docker.network=helvetia-net',
            `traefik.http.routers.${traefikIdentifier}.rule=${traefikRule}`,
            `traefik.http.routers.${traefikIdentifier}.entrypoints=web`,
            `traefik.http.services.${traefikIdentifier}.loadbalancer.server.port=${port || 8080}`,
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
