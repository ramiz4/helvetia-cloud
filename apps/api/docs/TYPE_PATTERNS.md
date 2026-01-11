# TypeScript Type Patterns

This document outlines the type safety patterns and best practices used in the Helvetia Cloud API.

## Table of Contents

- [Fastify Type Augmentation](#fastify-type-augmentation)
- [Request/Response Types](#requestresponse-types)
- [Error Handling](#error-handling)
- [Type Guards](#type-guards)
- [Common Patterns](#common-patterns)

## Fastify Type Augmentation

We use TypeScript declaration merging to extend Fastify's built-in types with our custom properties.

### Location

`src/types/fastify.d.ts`

### Custom Properties

#### FastifyRequest

```typescript
interface FastifyRequest {
  user?: JwtPayload;           // Authenticated user from JWT
  metricsEndTimer?: MetricsTimerFunction;  // Prometheus metrics timer
  rawBody?: Buffer;             // Raw request body for webhook signature verification
}
```

#### FastifyInstance

```typescript
interface FastifyInstance {
  redis: Redis;  // Redis connection for caching and rate limiting
}
```

### Usage

Import the augmentation file at the top of files that use these properties:

```typescript
import '../types/fastify';

export const myRoute: FastifyPluginAsync = async (fastify) => {
  const redis = fastify.redis;  // ✅ Type-safe access
  
  fastify.get('/protected', async (request, reply) => {
    const user = request.user;  // ✅ Type-safe access
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
};
```

## Request/Response Types

### Route Parameters

Always type route parameters explicitly:

```typescript
// ❌ Bad
const { id } = request.params as any;

// ✅ Good
const { id } = request.params as { id: string };
```

### Request Body

Use Zod schemas or explicit types for request bodies:

```typescript
// ✅ Using Zod
const data = ServiceCreateSchema.parse(request.body);

// ✅ Using explicit types
const { code } = request.body as { code?: string };
```

### Query Parameters

Type query parameters explicitly:

```typescript
const { sort, per_page, type, page, org } = request.query as {
  sort?: string;
  per_page?: string;
  type?: string;
  page?: string;
  org?: string;
};
```

## Error Handling

### Never use `any` for errors

```typescript
// ❌ Bad
catch (err: any) {
  console.error(err.message);
}

// ✅ Good
catch (err: unknown) {
  const error = err as Error;
  console.error(error.message);
}

// ✅ Better (with type guard)
catch (err: unknown) {
  const error = err as Error & { statusCode?: number; data?: unknown };
  if (error.statusCode === 404) {
    return reply.status(404).send({ error: 'Not found' });
  }
  console.error(error.message);
}
```

### Custom Error Types

Define error types for expected error shapes:

```typescript
type DockerError = Error & { statusCode?: number };

catch (err: unknown) {
  const error = err as DockerError;
  if (error.statusCode !== 404) {
    console.error('Docker error:', error.message);
  }
}
```

## Type Guards

### User Authentication

Always check if user exists before accessing properties:

```typescript
async handler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) {
    return reply.status(401).send({ error: 'User not authenticated' });
  }
  
  // Now user.id is safely accessible
  const services = await getServices(user.id);
}
```

### Optional Properties

Use optional chaining and nullish coalescing:

```typescript
// ✅ Safe access
const password = (service.envVars as Record<string, string> | undefined)?.REDIS_PASSWORD;

// ✅ With default value
const port = service.port ?? 3000;
```

## Common Patterns

### Controller Methods

Controllers should not use `Promise<any>` return types:

```typescript
// ❌ Bad
async getService(request: FastifyRequest, reply: FastifyReply): Promise<any> {
  // ...
}

// ✅ Good
async getService(request: FastifyRequest, reply: FastifyReply) {
  // Return type is inferred
  const { id } = request.params as { id: string };
  const user = request.user;
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  
  const service = await this.serviceRepository.findById(id);
  return service;
}
```

### Service Properties

When accessing optional service properties, use proper typing:

```typescript
// ❌ Bad
const type = (service as any).type;

// ✅ Good
const type = service.type || 'DOCKER';

// ✅ Better (with type assertion if needed)
const customDomain = service.customDomain as string | undefined;
```

### JWT Signing

Type the JWT payload properly:

```typescript
// ❌ Bad
const jwtSign = (payload: any) => fastify.jwt.sign(payload);

// ✅ Good
import type { JwtPayload } from '../types';

const jwtSign = (payload: JwtPayload) => fastify.jwt.sign(payload);
```

## Best Practices

1. **Always import type augmentation**: Include `import '../types/fastify';` at the top of route and controller files.

2. **Use explicit types for parameters**: Never use `as any` for route parameters, query strings, or request bodies.

3. **Handle errors properly**: Use `unknown` for catch blocks and cast to specific error types.

4. **Check authentication**: Always verify `request.user` exists before using it.

5. **Avoid `Promise<any>`**: Let TypeScript infer return types or use specific types.

6. **Use type guards**: Implement proper null/undefined checks before accessing properties.

7. **Leverage Zod schemas**: Use Zod for request validation and automatic type inference.

8. **Document custom types**: Add JSDoc comments to explain non-obvious type decisions.

## Migration Guide

When migrating code from `any` to proper types:

1. **Identify the actual type**: Use console.log or debugger to inspect the actual runtime value
2. **Create explicit type**: Define the type structure
3. **Add type guards**: Add null/undefined checks where necessary
4. **Test thoroughly**: Ensure the code still works with the new types

Example migration:

```typescript
// Before
const user = (request as any).user;
const services = await getServices(user.id);

// After
const user = request.user;
if (!user) {
  return reply.status(401).send({ error: 'User not authenticated' });
}
const services = await getServices(user.id);
```

## Resources

- [TypeScript Handbook - Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
- [Fastify TypeScript Documentation](https://www.fastify.io/docs/latest/Reference/TypeScript/)
- [Zod Documentation](https://zod.dev/)
