import 'reflect-metadata';
import { DockerContainerOrchestrator } from 'shared';
import { container } from 'tsyringe';
import { TOKENS } from './tokens';

/**
 * DI Container configuration for worker
 * This file sets up the dependency injection container
 *
 * Note: Actual implementations will be registered here by other issues:
 * - #95: Repository implementations
 * - #97: Container orchestrator implementation ✅
 */

/**
 * Initialize the DI container
 * This should be called at application startup
 */
export function initializeContainer(): void {
  // Register container orchestrator implementation
  container.registerInstance(TOKENS.ContainerOrchestrator, new DockerContainerOrchestrator());

  // Implementations will be registered by respective issues
  // Example registration (to be replaced by actual implementations):
  // container.register(TOKENS.ServiceRepository, { useClass: PrismaServiceRepository });
  // container.register(TOKENS.DeploymentRepository, { useClass: PrismaDeploymentRepository });
  // etc.
}

/**
 * Get the DI container instance
 */
export function getContainer() {
  return container;
}

/**
 * Register a singleton instance
 */
export function registerSingleton<T>(
  token: symbol,
  implementation: { new (...args: unknown[]): T },
): void {
  container.registerSingleton(token, implementation);
}

/**
 * Register an instance value
 */
export function registerInstance<T>(token: symbol, instance: T): void {
  container.registerInstance(token, instance);
}

/**
 * Resolve a dependency from the container
 */
export function resolve<T>(token: symbol): T {
  return container.resolve<T>(token);
}

/**
 * Clear all registrations (for testing)
 */
export function clearContainer(): void {
  container.clearInstances();
}

export { container, TOKENS };
