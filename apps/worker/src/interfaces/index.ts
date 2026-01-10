// Repository interfaces
export {
  Deployment,
  DeploymentCreateInput,
  DeploymentUpdateInput,
  IDeploymentRepository,
} from './IDeploymentRepository';
export {
  IServiceRepository,
  Service,
  ServiceCreateInput,
  ServiceUpdateInput,
} from './IServiceRepository';

// Infrastructure interfaces
export { CacheOptions, ICache } from './ICache';
export {
  BuildImageOptions,
  ContainerStatus,
  CreateContainerOptions,
  IContainerOrchestrator,
} from './IContainerOrchestrator';
export { ILogger, LogContext, LogLevel } from './ILogger';

// Deployment strategy interfaces
export {
  DeploymentContext,
  DeploymentResult,
  IDeploymentStrategy,
} from './IDeploymentStrategy';
