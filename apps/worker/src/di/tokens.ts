/**
 * Dependency injection tokens for worker
 * These tokens are used to register and resolve dependencies in the DI container
 */

// Worker tokens (subset of API tokens)
export const TOKENS = {
  // Repositories
  ServiceRepository: Symbol.for('IServiceRepository'),
  DeploymentRepository: Symbol.for('IDeploymentRepository'),

  // Infrastructure
  ContainerOrchestrator: Symbol.for('IContainerOrchestrator'),
  Logger: Symbol.for('ILogger'),
  Cache: Symbol.for('ICache'),

  // External dependencies
  PrismaClient: Symbol.for('PrismaClient'),
  Redis: Symbol.for('Redis'),
  Docker: Symbol.for('Docker'),
} as const;

export type TokenType = (typeof TOKENS)[keyof typeof TOKENS];
