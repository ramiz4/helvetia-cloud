---
applyTo: 'apps/{api,worker}/**/*.{ts,js}'
excludeAgent: ''
---

# Backend (API & Worker) Instructions

## AI Agent Rules & Principles

- **Task Execution**: All tasks MUST be performed using **TDD (Test-Driven Development)**.
- **Quality Check**: Before finishing work, MUST run `pnpm format`, `pnpm lint` (ZERO warnings and errors), and `pnpm test` (Ensure ALL tests pass).
- **Principles**: Always follow **SOLID**, **DRY**, **KISS**, and **YAGNI** principles.
- **Role**: Act like a principal world-class software architect / engineer. Design for the future but implement for the present.

## Fastify Best Practices

### Route Structure

- **Location**: `apps/api/src/routes/[feature].ts`
- **Pattern**: Export `FastifyPluginAsync` and register in `src/index.ts`
- **Keep routes thin**: Move business logic to services
- Example:

  ```typescript
  import { FastifyPluginAsync } from 'fastify';
  import { serviceService } from '../services/service.service';

  export const serviceRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/services', async (request, reply) => {
      const services = await serviceService.getAll(request.user.id);
      return reply.send(services);
    });
  };
  ```

### Authentication & Authorization

- **JWT tokens**: Use `@fastify/jwt` for token generation/verification
- **Protected routes**: Use `preHandler` hook to verify authentication
  ```typescript
  fastify.get(
    '/protected',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      // request.user is available here
    },
  );
  ```
- **Token storage**: Store in HTTP-only cookies or Authorization header
- **Never log tokens**: Redact sensitive data in logs

### Request Validation with Zod

- **Always validate input**: Use Zod schemas for request body/query/params
- **Pattern**:

  ```typescript
  import { z } from 'zod';

  const createServiceSchema = z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['DOCKER', 'STATIC']),
    repository: z.url(),
  });

  fastify.post('/services', async (request, reply) => {
    try {
      const data = createServiceSchema.parse(request.body);
      // data is now type-safe
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      throw error;
    }
  });
  ```

- **Error handling**: Zod throws on validation failure - catch and return 400
  ```typescript
  try {
    const data = schema.parse(request.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: error.errors });
    }
    throw error;
  }
  ```

### Service Layer Architecture

- **Location**: `apps/api/src/services/[feature].service.ts`
- **Responsibility**: Business logic, database interactions, external API calls
- **Pattern**: Export object with methods (not a class)

  ```typescript
  import { prisma } from 'database';

  export const serviceService = {
    async getAll(userId: string) {
      return prisma.service.findMany({
        where: { userId },
      });
    },

    async create(userId: string, data: CreateServiceData) {
      return prisma.service.create({
        data: { ...data, userId },
      });
    },
  };
  ```

### Database with Prisma

- **Client location**: `packages/database` (shared package)
- **Import**: `import { prisma } from 'database';`
- **Schema**: `packages/database/prisma/schema.prisma`
- **After schema changes**: Run `pnpm generate` to update client
- **Transactions**: Use for multi-step operations
  ```typescript
  await prisma.$transaction(async (tx) => {
    const service = await tx.service.create({ data: serviceData });
    await tx.deployment.create({ data: { serviceId: service.id } });
  });
  ```
- **Error handling**: Catch Prisma errors and return appropriate HTTP codes

  ```typescript
  import { Prisma } from '@prisma/client';

  try {
    await prisma.service.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply.code(409).send({ error: 'Service already exists' });
      }
    }
    throw error;
  }
  ```

### Background Jobs with BullMQ

- **Queue definition**: `apps/api/src/queues/` or `apps/worker/src/queues/`
- **Adding jobs (API)**: Queue tasks for asynchronous processing

  ```typescript
  import { Queue } from 'bullmq';
  import Redis from 'ioredis';

  const redis = new Redis(process.env.REDIS_URL);
  const deploymentQueue = new Queue('deployment', { connection: redis });

  await deploymentQueue.add('deploy', {
    serviceId,
    commitHash,
    branch,
  });
  ```

- **Processing jobs (Worker)**: Handle queued tasks

  ```typescript
  import { Worker } from 'bullmq';

  const worker = new Worker(
    'deployment',
    async (job) => {
      const { serviceId, commitHash } = job.data;

      // Update progress
      await job.updateProgress(50);

      // Do work
      await buildService(serviceId, commitHash);

      // Return result
      return { success: true, imageTag: 'v1.0.0' };
    },
    { connection: redis },
  );
  ```

### Docker Integration (Dockerode)

- **Used in**: Worker service for building and running containers
- **Pattern**:

  ```typescript
  import Docker from 'dockerode';

  const docker = new Docker({ socketPath: '/var/run/docker.sock' });

  // Build image
  const stream = await docker.buildImage(
    {
      context: buildContext,
      src: ['Dockerfile', 'package.json'],
    },
    { t: 'my-service:latest' },
  );

  // Run container
  const container = await docker.createContainer({
    Image: 'my-service:latest',
    name: 'my-service',
    Env: ['NODE_ENV=production'],
    HostConfig: {
      Memory: 512 * 1024 * 1024, // 512MB
      NanoCpus: 1000000000, // 1 CPU
    },
  });
  await container.start();
  ```

### Error Handling

- **Always use try/catch** for async operations
- **Log errors** with context
- **Return appropriate status codes**:
  - 400: Bad Request (validation errors)
  - 401: Unauthorized (missing/invalid token)
  - 403: Forbidden (insufficient permissions)
  - 404: Not Found
  - 409: Conflict (duplicate resource)
  - 500: Internal Server Error (unexpected errors)
- Example:

  ```typescript
  fastify.get('/service/:id', async (request, reply) => {
    try {
      const service = await serviceService.getById(request.params.id);

      if (!service) {
        return reply.code(404).send({ error: 'Service not found' });
      }

      if (service.userId !== request.user.id) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      return reply.send(service);
    } catch (error) {
      fastify.log.error(error, 'Failed to fetch service');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
  ```

### Logging

- Use Fastify's built-in logger: `fastify.log`
- Levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- Always include context
- Example:
  ```typescript
  fastify.log.info({ serviceId, userId }, 'Service created');
  fastify.log.error({ error, serviceId }, 'Build failed');
  ```

### Security

- **Never log sensitive data**: Tokens, passwords, API keys
- **Use environment variables**: All secrets in `.env`
- **Rate limiting**: Already configured with `@fastify/rate-limit`
- **CORS**: Already configured with `@fastify/cors`
- **Input validation**: Always validate with Zod
- **SQL injection**: Prevented by Prisma (use parameterized queries)

### Testing

- Test location: `__tests__/` or `*.test.ts` files
- Use Vitest for testing
- Run tests: `pnpm --filter api test` or `pnpm --filter worker test`
- Example:

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest';
  import { build } from './app'; // Your Fastify app builder

  describe('Service Routes', () => {
    let app;

    beforeAll(async () => {
      app = await build();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should create a service', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/services',
        payload: { name: 'test', type: 'DOCKER' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toHaveProperty('id');
    });
  });
  ```

### Common Mistakes to Avoid

- ❌ Putting business logic in route handlers
- ❌ Not validating request input
- ❌ Forgetting error handling and try/catch
- ❌ Logging sensitive data (tokens, passwords)
- ❌ Not using transactions for multi-step database operations
- ❌ Hardcoding configuration instead of environment variables
- ❌ Using `any` type in TypeScript
- ❌ Not closing resources (database connections, streams)
- ❌ Returning stack traces to clients in production
