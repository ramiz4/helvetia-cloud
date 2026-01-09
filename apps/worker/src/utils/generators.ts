import yaml from 'js-yaml';

export function generateComposeOverride(params: {
  serviceName: string;
  serviceId: string;
  mainService: string;
  traefikRule: string;
  port?: number;
  envVars?: Record<string, string>;
}) {
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

export function generateDockerfileLines(envVars?: Record<string, string>) {
  if (!envVars || Object.keys(envVars).length === 0) return { args: [], envs: [] };

  const args = Object.keys(envVars).map(
    (key) => `echo ${JSON.stringify(`ARG ${key}`)} >> Dockerfile`,
  );
  const envs = Object.entries(envVars).map(
    ([k, v]) => `echo ${JSON.stringify(`ENV ${k}=${v}`)} >> Dockerfile`,
  );

  return { args, envs };
}
