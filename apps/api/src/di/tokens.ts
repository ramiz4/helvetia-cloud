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

  // Controllers
  ServiceController: Symbol.for('ServiceController'),
  ProjectController: Symbol.for('ProjectController'),
  DeploymentController: Symbol.for('DeploymentController'),
  GitHubController: Symbol.for('GitHubController'),
  WebhookController: Symbol.for('WebhookController'),
  AuthController: Symbol.for('AuthController'),

  // External dependencies
  PrismaClient: Symbol.for('PrismaClient'),
  Redis: Symbol.for('Redis'),
  Docker: Symbol.for('Docker'),
} as const;

export type TokenType = (typeof TOKENS)[keyof typeof TOKENS];
