// Repository interfaces
export {
  Deployment,
  DeploymentCreateInput,
  DeploymentUpdateInput,
  IDeploymentRepository,
} from './IDeploymentRepository.js';
export {
  IServiceRepository,
  Service,
  ServiceCreateInput,
  ServiceUpdateInput,
} from './IServiceRepository.js';

// Infrastructure interfaces
export { CacheOptions, ICache } from './ICache.js';
export {
  BuildImageOptions,
  ContainerStatus,
  CreateContainerOptions,
  IContainerOrchestrator,
} from './IContainerOrchestrator.js';
export { ILogger, LogContext, LogLevel } from './ILogger.js';

// Deployment strategy interfaces
export { DeploymentContext, DeploymentResult, IDeploymentStrategy } from './IDeploymentStrategy.js';
