import { PrismaClient } from '@prisma/client';
import { prisma } from 'database';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { DeploymentController } from '../controllers/DeploymentController';
import { GitHubController } from '../controllers/GitHubController';
import { ServiceController } from '../controllers/ServiceController';
import { WebhookController } from '../controllers/WebhookController';
import { DockerContainerOrchestrator } from '../orchestration';
import {
  PrismaDeploymentRepository,
  PrismaServiceRepository,
  PrismaUserRepository,
} from '../repositories';
import {
  AuthenticationService,
  DeploymentOrchestratorService,
  GitHubService,
  ServiceManagementService,
} from '../services';
import { TOKENS } from './tokens';

/**
 * DI Container configuration
 * This file sets up the dependency injection container
 */

/**
 * Initialize the DI container
 * This should be called at application startup
 */
export function initializeContainer(): void {
  // Register PrismaClient as a singleton
  container.registerInstance<PrismaClient>('PrismaClient', prisma);

  // Register container orchestrator implementation
  container.registerSingleton(TOKENS.ContainerOrchestrator, DockerContainerOrchestrator);

  // Register repository implementations
  container.registerSingleton(TOKENS.ServiceRepository, PrismaServiceRepository);
  container.registerSingleton(TOKENS.DeploymentRepository, PrismaDeploymentRepository);
  container.registerSingleton(TOKENS.UserRepository, PrismaUserRepository);

  // Register service implementations
  container.registerSingleton(TOKENS.ServiceManagementService, ServiceManagementService);
  container.registerSingleton(TOKENS.DeploymentOrchestratorService, DeploymentOrchestratorService);
  container.registerSingleton(TOKENS.AuthenticationService, AuthenticationService);
  container.registerSingleton(TOKENS.GitHubService, GitHubService);

  // Register controllers
  container.registerSingleton(TOKENS.ServiceController, ServiceController);
  container.registerSingleton(TOKENS.DeploymentController, DeploymentController);
  container.registerSingleton(TOKENS.GitHubController, GitHubController);
  container.registerSingleton(TOKENS.WebhookController, WebhookController);
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
