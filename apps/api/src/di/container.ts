import { PrismaClient } from '@prisma/client';
import { prisma } from 'database';
import Docker from 'dockerode';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { AuthController } from '../controllers/AuthController';
import { DeploymentController } from '../controllers/DeploymentController';
import { GitHubController } from '../controllers/GitHubController';
import { ProjectController } from '../controllers/ProjectController';
import { ServiceController } from '../controllers/ServiceController';
import { WebhookController } from '../controllers/WebhookController';
import { DockerContainerOrchestrator } from '../orchestration';
import {
  PrismaDeploymentRepository,
  PrismaFeatureFlagRepository,
  PrismaProjectRepository,
  PrismaServiceRepository,
  PrismaUserRepository,
} from '../repositories';
import {
  AuthenticationService,
  DeploymentOrchestratorService,
  FeatureFlagService,
  GitHubService,
  ProjectManagementService,
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
  container.registerInstance<PrismaClient>(TOKENS.PrismaClient, prisma);
  container.registerInstance<PrismaClient>('PrismaClient', prisma);

  // Register Docker instance
  container.registerInstance(TOKENS.Docker, new Docker());

  // Register container orchestrator implementation
  container.registerSingleton(TOKENS.ContainerOrchestrator, DockerContainerOrchestrator);

  // Register repository implementations
  container.registerSingleton(TOKENS.ServiceRepository, PrismaServiceRepository);
  container.registerSingleton(TOKENS.ProjectRepository, PrismaProjectRepository);
  container.registerSingleton(TOKENS.DeploymentRepository, PrismaDeploymentRepository);
  container.registerSingleton(TOKENS.UserRepository, PrismaUserRepository);
  container.registerSingleton(TOKENS.FeatureFlagRepository, PrismaFeatureFlagRepository);

  // Register service implementations
  container.registerSingleton(TOKENS.ServiceManagementService, ServiceManagementService);
  container.registerSingleton(TOKENS.ProjectManagementService, ProjectManagementService);
  container.registerSingleton(TOKENS.DeploymentOrchestratorService, DeploymentOrchestratorService);
  container.registerSingleton(TOKENS.AuthenticationService, AuthenticationService);
  container.registerSingleton(TOKENS.GitHubService, GitHubService);
  container.registerSingleton(TOKENS.FeatureFlagService, FeatureFlagService);

  // Register controllers
  container.registerSingleton(TOKENS.ServiceController, ServiceController);
  container.registerSingleton(TOKENS.ProjectController, ProjectController);
  container.registerSingleton(TOKENS.DeploymentController, DeploymentController);
  container.registerSingleton(TOKENS.GitHubController, GitHubController);
  container.registerSingleton(TOKENS.WebhookController, WebhookController);
  container.registerSingleton(TOKENS.AuthController, AuthController);
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
