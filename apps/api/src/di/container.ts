import { PrismaClient } from '@prisma/client';
import { prisma } from 'database';
import Docker from 'dockerode';
import 'reflect-metadata';
import { DockerContainerOrchestrator, logger } from 'shared';
import { container } from 'tsyringe';
import { AuthController } from '../controllers/AuthController';
import { BillingController } from '../controllers/BillingController';
import { DeploymentController } from '../controllers/DeploymentController';
import { FeatureFlagController } from '../controllers/FeatureFlagController';
import { GitHubController } from '../controllers/GitHubController';
import { OrganizationController } from '../controllers/OrganizationController';
import { PrivacyPolicyController } from '../controllers/PrivacyPolicyController';
import { ProjectController } from '../controllers/ProjectController';
import { ServiceController } from '../controllers/ServiceController';
import { StripeWebhookController } from '../controllers/StripeWebhookController';
import { TermsController } from '../controllers/TermsController';
import { WebhookController } from '../controllers/WebhookController';
import {
  PrismaDeploymentRepository,
  PrismaFeatureFlagRepository,
  PrismaOrganizationRepository,
  PrismaPrivacyPolicyRepository,
  PrismaProjectRepository,
  PrismaServiceRepository,
  PrismaTermsRepository,
  PrismaUserRepository,
} from '../repositories';
import {
  AuthenticationService,
  BillingService,
  DeploymentOrchestratorService,
  FeatureFlagService,
  GitHubService,
  InitializationService,
  OrganizationService,
  PrivacyPolicyService,
  ProjectManagementService,
  ServiceManagementService,
  SubscriptionService,
  TermsService,
  UsageTrackingService,
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
  const dockerInstance = new Docker();
  container.registerInstance(TOKENS.Docker, dockerInstance);

  // Register logger instance
  container.registerInstance(TOKENS.Logger, logger);

  // Register container orchestrator implementation with Docker instance
  container.registerInstance(
    TOKENS.ContainerOrchestrator,
    new DockerContainerOrchestrator(dockerInstance),
  );

  // Register repository implementations
  container.registerSingleton(TOKENS.ServiceRepository, PrismaServiceRepository);
  container.registerSingleton(TOKENS.ProjectRepository, PrismaProjectRepository);
  container.registerSingleton(TOKENS.DeploymentRepository, PrismaDeploymentRepository);
  container.registerSingleton(TOKENS.UserRepository, PrismaUserRepository);
  container.registerSingleton(TOKENS.FeatureFlagRepository, PrismaFeatureFlagRepository);
  container.registerSingleton(TOKENS.OrganizationRepository, PrismaOrganizationRepository);
  container.registerSingleton(TOKENS.TermsRepository, PrismaTermsRepository);
  container.registerSingleton(TOKENS.PrivacyPolicyRepository, PrismaPrivacyPolicyRepository);

  // Register service implementations
  container.registerSingleton(TOKENS.ServiceManagementService, ServiceManagementService);
  container.registerSingleton(TOKENS.ProjectManagementService, ProjectManagementService);
  container.registerSingleton(TOKENS.DeploymentOrchestratorService, DeploymentOrchestratorService);
  container.registerSingleton(TOKENS.AuthenticationService, AuthenticationService);
  container.registerSingleton(TOKENS.GitHubService, GitHubService);
  container.registerSingleton(TOKENS.FeatureFlagService, FeatureFlagService);
  container.registerSingleton(TOKENS.OrganizationService, OrganizationService);
  container.registerSingleton(TOKENS.InitializationService, InitializationService);
  container.registerSingleton(TOKENS.BillingService, BillingService);
  container.registerSingleton(TOKENS.SubscriptionService, SubscriptionService);
  container.registerSingleton(TOKENS.UsageTrackingService, UsageTrackingService);
  container.registerSingleton(TOKENS.TermsService, TermsService);
  container.registerSingleton(TOKENS.PrivacyPolicyService, PrivacyPolicyService);

  // Register controllers
  container.registerSingleton(TOKENS.ServiceController, ServiceController);
  container.registerSingleton(TOKENS.ProjectController, ProjectController);
  container.registerSingleton(TOKENS.DeploymentController, DeploymentController);
  container.registerSingleton(TOKENS.GitHubController, GitHubController);
  container.registerSingleton(TOKENS.WebhookController, WebhookController);
  container.registerSingleton(TOKENS.AuthController, AuthController);
  container.registerSingleton(TOKENS.FeatureFlagController, FeatureFlagController);
  container.registerSingleton(TOKENS.OrganizationController, OrganizationController);
  container.registerSingleton(TOKENS.BillingController, BillingController);
  container.registerSingleton(TOKENS.StripeWebhookController, StripeWebhookController);
  container.registerSingleton(TOKENS.TermsController, TermsController);
  container.registerSingleton(TOKENS.PrivacyPolicyController, PrivacyPolicyController);
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
