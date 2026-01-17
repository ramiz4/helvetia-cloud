/**
 * Dependency injection tokens
 * These tokens are used to register and resolve dependencies in the DI container
 */

// Repository tokens
export const TOKENS = {
  // Repositories
  ServiceRepository: Symbol.for('IServiceRepository'),
  ProjectRepository: Symbol.for('IProjectRepository'),
  DeploymentRepository: Symbol.for('IDeploymentRepository'),
  UserRepository: Symbol.for('IUserRepository'),
  RefreshTokenRepository: Symbol.for('IRefreshTokenRepository'),
  FeatureFlagRepository: Symbol.for('IFeatureFlagRepository'),
  OrganizationRepository: Symbol.for('IOrganizationRepository'),

  // Infrastructure
  ContainerOrchestrator: Symbol.for('IContainerOrchestrator'),
  DeploymentQueue: Symbol.for('IDeploymentQueue'),
  Logger: Symbol.for('ILogger'),
  Cache: Symbol.for('ICache'),

  // Services
  ServiceManagementService: Symbol.for('ServiceManagementService'),
  ProjectManagementService: Symbol.for('ProjectManagementService'),
  DeploymentOrchestratorService: Symbol.for('DeploymentOrchestratorService'),
  AuthenticationService: Symbol.for('AuthenticationService'),
  GitHubService: Symbol.for('IGitHubService'),
  FeatureFlagService: Symbol.for('FeatureFlagService'),
  OrganizationService: Symbol.for('OrganizationService'),
  InitializationService: Symbol.for('InitializationService'),
  BillingService: Symbol.for('BillingService'),
  SubscriptionService: Symbol.for('SubscriptionService'),
  UsageTrackingService: Symbol.for('UsageTrackingService'),

  // Controllers
  AuthController: Symbol.for('AuthController'),
  FeatureFlagController: Symbol.for('FeatureFlagController'),
  OrganizationController: Symbol.for('OrganizationController'),
  BillingController: Symbol.for('BillingController'),
  DeploymentController: Symbol.for('DeploymentController'),
  GitHubController: Symbol.for('GitHubController'),
  ProjectController: Symbol.for('ProjectController'),
  ServiceController: Symbol.for('ServiceController'),
  WebhookController: Symbol.for('WebhookController'),

  // External dependencies
  PrismaClient: Symbol.for('PrismaClient'),
  Redis: Symbol.for('Redis'),
  Docker: Symbol.for('Docker'),
} as const;

export type TokenType = (typeof TOKENS)[keyof typeof TOKENS];
