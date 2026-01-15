# Migration Guide: Adopting Dependency Injection

This guide helps you migrate existing code to use the new dependency injection framework.

## Overview

This PR introduces:

1. TSyringe dependency injection framework
2. Core interface contracts
3. Error hierarchy
4. DI container configuration

**Note:** This PR does NOT change existing implementations. It only sets up the infrastructure. Future PRs will gradually migrate code to use DI.

## What Changed

### Added Files

#### API Package (`apps/api/src/`)

- `di/` - DI container configuration and tokens
- `errors/` - Error class hierarchy
- `interfaces/` - Core interface contracts

#### Worker Package (`apps/worker/src/`)

- `di/` - DI container configuration and tokens
- `errors/` - Error class hierarchy
- `interfaces/` - Core interface contracts

### Modified Files

- `apps/api/tsconfig.json` - Added decorator support
- `apps/worker/tsconfig.json` - Added decorator support
- `apps/api/package.json` - Added tsyringe, reflect-metadata
- `apps/worker/package.json` - Added tsyringe, reflect-metadata

## Impact on Existing Code

### No Breaking Changes

The existing code continues to work as-is. This PR:

- ✅ Does NOT modify existing route handlers
- ✅ Does NOT modify existing database calls
- ✅ Does NOT modify existing service logic
- ✅ Does NOT require immediate migration

### Optional Adoption

Teams can adopt DI gradually:

1. New features can use DI from the start
2. Existing code can be refactored incrementally
3. No big-bang migration required

## How to Use in New Code

### Example: Creating a New Feature with DI

**1. Define the interface:**

```typescript
// src/interfaces/INotificationService.ts
export interface INotificationService {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}
```

**2. Add token:**

```typescript
// src/di/tokens.ts
export const TOKENS = {
  // ... existing tokens
  NotificationService: Symbol.for('INotificationService'),
};
```

**3. Implement the interface:**

```typescript
// src/services/NotificationService.ts
import { injectable, inject } from 'tsyringe';
import { ILogger } from '../interfaces';
import { TOKENS } from '../di';

@injectable()
export class NotificationService implements INotificationService {
  constructor(@inject(TOKENS.Logger) private logger: ILogger) {}

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.logger.info({ to, subject }, 'Sending email');
    // Implementation
  }
}
```

**4. Register in container:**

```typescript
// src/index.ts or src/di/container.ts
import { container, TOKENS } from './di';
import { NotificationService } from './services/NotificationService';

container.registerSingleton(TOKENS.NotificationService, NotificationService);
```

**5. Use in route handler:**

```typescript
// src/server.ts
import { resolve, TOKENS } from './di';

fastify.post('/notify', async (request, reply) => {
  const notificationService = resolve<INotificationService>(TOKENS.NotificationService);
  await notificationService.sendEmail(/*...*/);
  return { success: true };
});
```

## Migration Strategy for Existing Code

### Phase 1: Interface Definitions (✅ Done)

- Core interfaces defined
- Error hierarchy created
- DI container setup

### Phase 2: Repository Implementations (Issue #126 - ✅ Done)

- Implement `IServiceRepository` using Prisma
- Implement `IDeploymentRepository` using Prisma
- Implement `IUserRepository` using Prisma
- Implement `IRefreshTokenRepository` using Prisma

### Phase 3: Infrastructure Implementations (Issue #128 - ✅ Done)

- Implement `IContainerOrchestrator` using Dockerode
- Implement `IDeploymentQueue` using BullMQ
- Implement `ILogger` wrapping Fastify logger
- Implement `ICache` using Redis

### Phase 4: Gradual Route Migration (Ongoing)

- **Issue #146**: Migrate Service routes to `ServiceController`
- **Issue #147**: Migrate Deployment routes to `DeploymentController`
- **Issue #148**: Migrate GitHub Proxy routes to `GitHubController`
- **Issue #149**: Migrate Webhook routes to `WebhookController`
- Refactor existing routes incrementally as features are updated
- No deadline - migrate as convenient

## Benefits

### Testability

```typescript
// Before: Hard to test
async function createService(data: ServiceData) {
  const service = await prisma.service.create({ data });
  const docker = new Docker();
  await docker.createContainer(/*...*/);
}

// After: Easy to mock
@injectable()
class ServiceCreator {
  constructor(
    @inject(TOKENS.ServiceRepository) private repo: IServiceRepository,
    @inject(TOKENS.ContainerOrchestrator) private docker: IContainerOrchestrator,
  ) {}

  async createService(data: ServiceData) {
    const service = await this.repo.create(data);
    await this.docker.createContainer(/*...*/);
  }
}
```

### Flexibility

```typescript
// Easy to swap implementations
container.register(TOKENS.Cache, { useClass: RedisCache }); // Production
container.register(TOKENS.Cache, { useClass: InMemoryCache }); // Testing
```

### Error Handling

```typescript
// Before: Generic errors
throw new Error('Service not found');

// After: Typed errors with proper status codes
throw new NotFoundError('Service not found');
throw new ValidationError('Invalid input', errors);
```

## Testing

All DI-related code has comprehensive tests:

- Error classes: 15 tests
- DI container: 12 tests

Run tests:

```bash
pnpm --filter api test src/errors/ src/di/
```

## Best Practices

### ✅ DO: Use Injected Repositories

Always use injected repositories in controllers instead of direct Prisma imports:

```typescript
// ✅ GOOD: Using injected repository
@injectable()
export class ServiceController {
  constructor(
    @inject(Symbol.for('IServiceRepository'))
    private serviceRepository: IServiceRepository,
  ) {}

  async getService(request: FastifyRequest, reply: FastifyReply) {
    const service = await this.serviceRepository.findByIdAndUserId(id, user.id);
    if (!service) {
      return reply.status(404).send({ error: 'Service not found' });
    }
    return service;
  }
}
```

### ❌ DON'T: Direct Prisma Imports

Avoid direct Prisma imports in controllers as they break the DI pattern and make testing difficult:

```typescript
// ❌ BAD: Direct Prisma import (static)
import { prisma } from 'database';

// ❌ BAD: Dynamic Prisma import
async getService(request: FastifyRequest, reply: FastifyReply) {
  const { prisma } = await import('database');
  const service = await prisma.service.findFirst({
    where: { id, userId: user.id },
  });
}
```

### Why Repositories?

1. **Testability**: Easy to mock in unit tests
2. **Consistency**: All controllers follow the same pattern
3. **Flexibility**: Can swap implementations without changing controllers
4. **Type Safety**: Interface contracts ensure correct usage
5. **Performance**: No dynamic imports overhead

### Adding New Repository Methods

If you need a query not available in the repository:

1. Add the method to the interface (`src/interfaces/IServiceRepository.ts`)
2. Implement in the repository (`src/repositories/PrismaServiceRepository.ts`)
3. Add tests for the new method
4. Use the new method in your controller

Example:

```typescript
// 1. Add to interface
export interface IServiceRepository {
  findByIdAndUserId(id: string, userId: string): Promise<Service | null>;
}

// 2. Implement in repository
async findByIdAndUserId(id: string, userId: string): Promise<Service | null> {
  return this.prisma.service.findFirst({
    where: { id, userId, deletedAt: null },
  });
}

// 3. Use in controller
const service = await this.serviceRepository.findByIdAndUserId(id, user.id);
```

## Questions?

- See [apps/api/src/di/README.md](../../src/di/README.md) for detailed usage guide
- Check interface files for API documentation
- Review tests for usage examples

## Next Steps

1. **Issue #126**: Implement repository interfaces (✅)
2. **Issue #128**: Implement container orchestrator (✅)
3. Continue with other infrastructure implementations
4. Gradually migrate existing routes (Issues #146, #147, #148, #149)

No immediate action required. Existing code continues to work!
