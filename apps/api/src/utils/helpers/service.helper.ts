/**
 * Helper function to get the default port for service type
 */
export function getDefaultPortForServiceType(serviceType: string): number {
  const portMap: Record<string, number> = {
    STATIC: 80,
    POSTGRES: 5444,
    REDIS: 6379,
    MYSQL: 3306,
    DOCKER: 3000,
  };
  return portMap[serviceType] || 3000;
}
