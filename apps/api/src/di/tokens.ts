/**
 * Dependency injection tokens
 * These tokens are used to register and resolve dependencies in the DI container
 */

// Repository tokens
export const TOKENS = {
  // Repositories
  ServiceRepository: Symbol.for('IServiceRepository'),
  DeploymentRepository: Symbol.for('IDeploymentRepository'),
  UserRepository: Symbol.for('IUserRepository'),
  RefreshTokenRepository: Symbol.for('IRefreshTokenRepository'),

  // Infrastructure
  ContainerOrchestrator: Symbol.for('IContainerOrchestrator'),
  DeploymentQueue: Symbol.for('IDeploymentQueue'),
  Logger: Symbol.for('ILogger'),
  Cache: Symbol.for('ICache'),

  // Services
  ServiceManagementService: Symbol.for('ServiceManagementService'),
  DeploymentOrchestratorService: Symbol.for('DeploymentOrchestratorService'),
  AuthenticationService: Symbol.for('AuthenticationService'),

  // External dependencies
  PrismaClient: Symbol.for('PrismaClient'),
  Redis: Symbol.for('Redis'),
  Docker: Symbol.for('Docker'),
} as const;

export type TokenType = (typeof TOKENS)[keyof typeof TOKENS];
