# Dependency Injection & Core Interfaces

This directory contains the dependency injection (DI) framework setup and core interface contracts for the Helvetia Cloud application.

## Overview

We use [TSyringe](https://github.com/microsoft/tsyringe) for dependency injection to:

- Decouple components and enable testability
- Allow easy mocking of dependencies in tests
- Facilitate swapping implementations (e.g., different database providers)
- Improve code maintainability and reduce coupling

## Architecture

### Error Hierarchy

Located in `src/errors/`, we define a base error hierarchy:

- **AppError**: Base class for all application errors
  - `statusCode`: HTTP status code
  - `isOperational`: Whether the error is operational (expected) or programming error
- **ValidationError** (400): Input validation failures
- **UnauthorizedError** (401): Authentication failures
- **ForbiddenError** (403): Authorization failures
- **NotFoundError** (404): Resource not found
- **ConflictError** (409): Resource conflicts (e.g., duplicates)

**Usage:**

```typescript
import { NotFoundError, ValidationError } from './errors';

throw new NotFoundError('Service not found');
throw new ValidationError('Invalid input', validationErrors);
```

### Core Interfaces

Located in `src/interfaces/`, these define contracts for:

#### Repository Interfaces

- **IServiceRepository**: Service CRUD operations
- **IDeploymentRepository**: Deployment CRUD operations
- **IUserRepository**: User CRUD operations
- **IRefreshTokenRepository**: Refresh token operations

#### Infrastructure Interfaces

- **IContainerOrchestrator**: Docker container operations
- **IDeploymentQueue**: Job queue operations (BullMQ)
- **ILogger**: Logging operations (Fastify/Pino)
- **ICache**: Caching operations (Redis)

### DI Container

Located in `src/di/`, the container manages dependency registration and resolution.

#### Tokens

Unique symbols identify each dependency:

```typescript
export const TOKENS = {
  ServiceRepository: Symbol.for('IServiceRepository'),
  DeploymentRepository: Symbol.for('IDeploymentRepository'),
  ContainerOrchestrator: Symbol.for('IContainerOrchestrator'),
  Logger: Symbol.for('ILogger'),
  // ... etc
};
```

#### Container API

```typescript
import { initializeContainer, registerSingleton, registerInstance, resolve, TOKENS } from './di';

// Initialize container at app startup
initializeContainer();

// Register implementations
registerSingleton(TOKENS.ServiceRepository, PrismaServiceRepository);
registerInstance(TOKENS.Logger, logger);

// Resolve dependencies
const serviceRepo = resolve<IServiceRepository>(TOKENS.ServiceRepository);
```

## Usage Guide

### 1. Defining a New Interface

Create a new interface file in `src/interfaces/`:

```typescript
// src/interfaces/IMyService.ts
export interface IMyService {
  doSomething(id: string): Promise<void>;
}
```

Add to `src/di/tokens.ts`:

```typescript
export const TOKENS = {
  // ... existing tokens
  MyService: Symbol.for('IMyService'),
};
```

### 2. Implementing an Interface

```typescript
// src/services/MyService.ts
import { injectable, inject } from 'tsyringe';
import { IMyService } from '../interfaces';
import { TOKENS } from '../di';

@injectable()
export class MyService implements IMyService {
  constructor(@inject(TOKENS.Logger) private logger: ILogger) {}

  async doSomething(id: string): Promise<void> {
    this.logger.info({ id }, 'Doing something');
    // Implementation
  }
}
```

### 3. Registering Implementations

In your app startup (e.g., `src/index.ts`):

```typescript
import 'reflect-metadata';
import { container, TOKENS } from './di';
import { MyService } from './services/MyService';

// Register implementation
container.register(TOKENS.MyService, { useClass: MyService });

// For singletons
container.registerSingleton(TOKENS.MyService, MyService);

// For instances
const myService = new MyService(logger);
container.registerInstance(TOKENS.MyService, myService);
```

### 4. Using Dependencies

```typescript
import { resolve, TOKENS } from './di';

// In route handlers or services
const myService = resolve<IMyService>(TOKENS.MyService);
await myService.doSomething('123');
```

### 5. Testing with Mocks

```typescript
import { describe, it, beforeEach, afterEach } from 'vitest';
import { container, TOKENS } from '../di';

describe('MyService', () => {
  let mockLogger: ILogger;

  beforeEach(() => {
    // Register mocks
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      // ... other methods
    };

    container.registerInstance(TOKENS.Logger, mockLogger);
  });

  afterEach(() => {
    container.clearInstances();
  });

  it('should do something', async () => {
    const service = container.resolve<IMyService>(TOKENS.MyService);
    await service.doSomething('123');

    expect(mockLogger.info).toHaveBeenCalled();
  });
});
```

## Best Practices

1. **Always use interfaces**: Define interface contracts before implementations
2. **Use tokens for resolution**: Never resolve by class name, always use TOKENS
3. **Inject dependencies**: Use constructor injection with `@inject` decorator
4. **Test with mocks**: Use DI to inject mock dependencies in tests
5. **Keep interfaces small**: Follow Interface Segregation Principle
6. **Document expectations**: Add JSDoc comments to interface methods

## Future Work

This implementation defines the **interface contracts only**. Actual implementations will be added in:

- Issue #95: Repository implementations using Prisma
- Issue #97: Container orchestrator implementation using Dockerode
- Other issues: Logger, Cache, Queue implementations

## References

- [TSyringe Documentation](https://github.com/microsoft/tsyringe)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Dependency Injection Pattern](https://en.wikipedia.org/wiki/Dependency_injection)
