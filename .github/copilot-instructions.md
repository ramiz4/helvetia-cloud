# GitHub Copilot Instructions

You are a senior full-stack developer expert in TypeScript, Node.js, Next.js, and Fastify.

## Project Context

This is a monorepo managed by PNPM Workspaces containing:

- `apps/dashboard`: Next.js 16, React 19, Tailwind CSS 4 application.
- `apps/api`: Fastify, Prisma, BullMQ, Dockerode backend service.
- `apps/worker`: Background worker service.
- `packages/database`: Shared Prisma database client.

### Code Documentation

Project documentation is organized by component in their respective directories:

- **General Documentation** (`docs/`): Architecture, roadmap, integration tests, and Docker security
  - `docs/ARCHITECTURE.md` - System architecture and design decisions
  - `docs/ROADMAP.md` - Project roadmap and future plans
  - `docs/INTEGRATION_TESTS.md`, `docs/TEST_COVERAGE_REPORT.md` - Testing documentation
  - `docs/DOCKER_SECURITY_HARDENING.md` - Docker security hardening guide
  
- **API Documentation** (`apps/api/docs/`): API-specific documentation
  - `apps/api/docs/API_VERSIONING.md`, `apps/api/docs/ERROR_CODES.md` - API versioning and error codes
  - `apps/api/docs/LOGGING.md`, `apps/api/docs/REQUEST_TRACING.md` - Logging and request tracing
  - `apps/api/docs/BODY_SIZE_LIMITS.md`, `apps/api/docs/SAFE_QUERY_PATTERNS.md` - API patterns and limits
  - `apps/api/docs/SECURITY.md` - Security guidelines, authentication, and token management
  - `apps/api/docs/SSE_AND_STATUS_MANAGEMENT.md` - Server-Sent Events and status management
  - `apps/api/docs/METRICS.md` - Observability and monitoring metrics
  - `apps/api/docs/DI_IMPLEMENTATION_SUMMARY.md`, `apps/api/docs/MIGRATION_GUIDE.md` - DI framework and migration
  - `apps/api/docs/IMPLEMENTATION_SUMMARY.md` - API implementation details
  - `apps/api/docs/TYPE_PATTERNS.md`, `apps/api/docs/TYPE_SAFETY_IMPROVEMENTS.md` - TypeScript patterns
  
- **Worker Documentation** (`apps/worker/docs/`): Worker service documentation
  - `apps/worker/docs/HEALTH_CHECK.md` - Health check endpoints and format
  - `apps/worker/docs/MONITORING_SETUP.md` - Monitoring and observability setup
  - `apps/worker/docs/INTEGRATION_TESTS.md` - Worker integration tests
  
- **Dashboard Documentation** (`apps/dashboard/docs/`): Frontend-specific documentation
  - `apps/dashboard/docs/ACCESSIBILITY.md` - WCAG compliance, keyboard navigation, and accessibility testing
  - `apps/dashboard/docs/FEATURE_FLAGS.md` - Feature flag system and usage
  
- **Database Documentation** (`packages/database/docs/`): Database-specific documentation
  - `packages/database/docs/DATABASE_MIGRATIONS.md` - Database migration guidelines

When working on features or making changes, check the relevant component's `docs/` folder for documentation.

## Tech Stack & Guidelines

### General

- Use **TypeScript** for all code.
- Prefer **Functional Programming** patterns where applicable.
- Use **PNPM** for package management. Always use `pnpm` commands (e.g., `pnpm install`, `pnpm run dev`).
- **Monorepo**: Be aware of the workspace structure. Run commands from the root or filter by package (e.g., `pnpm --filter dashboard run dev`).

### Frontend (Dashboard)

- **Framework**: Next.js 16 (App Router).
- **Styling**: Tailwind CSS 4. Use utility classes. Avoid custom CSS unless identical to utility classes.
- **State Management**: Use React Hooks and Context. Avoid external state libraries unless necessary (e.g., Zustand, TanStack Query).
- **Components**: Create small, reusable components. Use functional components with hooks.
- **Performance**: Optimize images, use lazy loading, and leverage Next.js server components (RSC) by default. Use client components only when interactivity is needed (add `'use client'` at the top of the file).

### Backend (API & Worker)

- **Framework**: Fastify.
- **Database**: Prisma ORM. Schema is in `packages/database/prisma/schema.prisma`.
- **Queue**: BullMQ with Redis.
- **Validation**: Zod.
- **Architecture**: Service-based architecture. Keep controllers thin, move logic to services.

### Coding Standards

- **Naming**: camelCase for variables/functions, PascalCase for classes/components, UPPER_CASE for constants.
- **Async/Await**: Always use async/await over raw Promises.
- **Error Handling**: Use try/catch blocks. Ensure errors are logged and handled gracefully.
- **Types**: Distinguish between type aliases and interfaces. Prefer interfaces for object shapes; use type aliases for unions, primitives, and utility/derived types. Avoid `any`.

### Software Principles

- Always follow **SOLID**, **DRY**, **KISS**, and **YAGNI** principles.
- Use best practices for performance, scalability, and maintainability.
- Act as a principal world-class software architect / engineer. Design for the future but implement for the present.

### Git & Commits

- **Conventional Commits**: Use semantic commit messages (feat, fix, chore, docs, style, refactor, perf, test).
  - Example: `feat(dashboard): add user profile page`
  - Example: `fix(api): resolve docker connection issue`

## Build, Test & Lint Commands

### Root Level

- **Install Dependencies**: `pnpm install`
- **Dev Mode (All Services)**: `pnpm dev` - Runs all services in parallel
- **Build (All)**: `pnpm build` - Builds all workspaces
- **Start (Production)**: `pnpm start` - Starts all services in production mode
- **Lint**: `pnpm lint` - Runs ESLint across the entire monorepo
- **Format**: `pnpm format` - Formats code with Prettier
- **Test (All)**: `pnpm test` - Runs tests in all workspaces

### Dashboard (Frontend)

- **Dev**: `pnpm --filter dashboard dev` - Starts Next.js dev server (port 3000)
- **Build**: `pnpm --filter dashboard build` - Creates production build
- **Start**: `pnpm --filter dashboard start` - Runs production server
- **Test**: `pnpm --filter dashboard test` - Runs Vitest tests

### API (Backend)

- **Dev**: `pnpm --filter api dev` - Starts Fastify server with watch mode (port 3001)
- **Build**: `pnpm --filter api build` - Compiles TypeScript to `dist/`
- **Start**: `pnpm --filter api start` - Runs compiled API server
- **Test**: `pnpm --filter api test` - Runs Vitest tests

### Worker (Background Jobs)

- **Dev**: `pnpm --filter worker dev` - Starts worker with watch mode
- **Build**: `pnpm --filter worker build` - Compiles TypeScript to `dist/`
- **Start**: `pnpm --filter worker start` - Runs compiled worker
- **Test**: `pnpm --filter worker test` - Runs Vitest tests

### Database

- **Generate Prisma Client**: `pnpm generate` - Regenerates Prisma client after schema changes
- **Push Schema**: `pnpm db:push` - Pushes schema changes to database (dev only)
- **Schema Location**: `packages/database/prisma/schema.prisma`

## Environment Setup

### Prerequisites

- Node.js v20+
- pnpm (package manager)
- Docker & Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)

### Initial Setup Steps

1. Copy environment file: `cp .env.example .env`
2. Configure required variables in `.env`:
   - `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET` (GitHub OAuth)
   - `DATABASE_URL` (PostgreSQL connection string)
   - `REDIS_URL` (Redis connection string)
   - `JWT_SECRET` (for JWT token signing)
   - `ENCRYPTION_KEY` (32-character key for encrypting tokens)
   - `ENCRYPTION_SALT` (hex string for key derivation)
   - `PLATFORM_DOMAIN` (e.g., `helvetia.cloud`)
3. Start infrastructure: `docker-compose up -d postgres redis traefik`
4. Install dependencies: `pnpm install`
5. Push database schema: `pnpm db:push`
6. Start development servers: `pnpm dev`

### Docker Commands

- **Start Services**: `docker-compose up -d postgres redis traefik`
- **Stop Services**: `docker-compose down`
- **View Logs**: `docker-compose logs -f [service-name]`
- **Restart Service**: `docker-compose restart [service-name]`

### Access Points

- Dashboard: http://localhost:3000
- API: http://localhost:3001
- Traefik Dashboard: http://localhost:8090

## Agent Workflow

- **Task Execution**: All tasks MUST be performed using **TDD (Test-Driven Development)**.
  1. Write a failing test.
  2. Implement the minimum code to pass the test.
  3. Refactor.
- **Task Invitation**: When starting a task from a user prompt, the Agent MUST follow this GitHub Flow:
  1. **Create Branch**: Create a new branch appropriate for the task (e.g., `git checkout -b feat/task-name`).
  2. **Implement**: Make the necessary code changes.
  3. **Quality Check**: Before finishing work, MUST run:
     - `pnpm format`
     - `pnpm lint` (Ensure ZERO warnings and errors)
     - `pnpm test` (Ensure ALL tests pass)
  4. **Commit**: Create small, conventional commits (e.g., `feat: add functionality`, `chore: update config`).
  5. **Push**: Push the changes to the remote (e.g., `git push -u origin feat/task-name`).

## Common Patterns & Examples

### Adding a New API Route

1. Create route handler in `apps/api/src/routes/`
2. Use Zod for request validation
3. Keep business logic in services (`apps/api/src/services/`)
4. Register route in `apps/api/src/index.ts`
5. Example:

   ```typescript
   // apps/api/src/routes/example.ts
   import { FastifyPluginAsync } from 'fastify';
   import { z } from 'zod';

   const schema = z.object({
     name: z.string().min(1),
   });

   export const exampleRoutes: FastifyPluginAsync = async (fastify) => {
     fastify.post('/example', async (request, reply) => {
       const parseResult = schema.safeParse(request.body);

       if (!parseResult.success) {
         return reply.status(400).send({
           success: false,
           error: parseResult.error.flatten(),
         });
       }

       const data = parseResult.data;
       // Business logic here
       return { success: true };
     });
   };
   ```

### Creating a New Dashboard Page

1. Create route in `apps/dashboard/src/app/[route]/page.tsx`
2. Use Server Components by default (no `'use client'`)
3. Add `'use client'` only when using hooks, events, or browser APIs
4. Fetch data server-side when possible
5. Example:

   ```typescript
   // apps/dashboard/src/app/services/page.tsx
   export default async function ServicesPage() {
     // Server-side data fetching
     const services = await fetchServices();

     return (
       <div className="container mx-auto p-4">
         <h1 className="text-2xl font-bold">Services</h1>
         {/* Use Tailwind utility classes */}
       </div>
     );
   }
   ```

### Adding Background Jobs

1. Define job processor in `apps/worker/src/jobs/`
2. Queue job from API using BullMQ
3. Example:

   ```typescript
   // Queue job in API
   import { Queue } from 'bullmq';
   import Redis from 'ioredis';

   const redis = new Redis(process.env.REDIS_URL);
   const deploymentQueue = new Queue('deployment', { connection: redis });

   await deploymentQueue.add('deploy', {
     serviceId,
     commitHash,
   });

   // Process in worker
   import { Worker } from 'bullmq';

   const worker = new Worker(
     'deployment',
     async (job) => {
       const { serviceId, commitHash } = job.data;
       // Processing logic
     },
     { connection: redis },
   );
   ```

## Troubleshooting

### Common Issues

- **"Cannot connect to database"**: Ensure PostgreSQL is running (`docker-compose up -d postgres`) and `DATABASE_URL` is correct
- **"Redis connection failed"**: Start Redis (`docker-compose up -d redis`) and verify `REDIS_URL`
- **"Port already in use"**: Check if services are already running. Kill processes or change ports in `.env`
- **"Module not found"**: Run `pnpm install` and `pnpm generate` (for Prisma client)
- **Build failures**: Clear build cache (`rm -rf apps/*/dist apps/*/.next`) and rebuild

### Debugging

- Use `console.log()` for quick debugging (remove before committing)
- API logs are visible in terminal when running `pnpm dev`
- Worker logs show job processing status
- Check Docker logs: `docker-compose logs -f [service-name]`

## AI Behavior

- **Role**: Act like a principal world-class software architect / engineer.
- **Conciseness**: Provide code solutions directly. Avoid over-explaining standard practices unless asked.
- **Security**: Do not hardcode secrets. Use environment variables.
- **Safety**: Verify commands before suggesting them. Avoid destructive file operations without confirmation.
- **Quality Assurance**:
  - ALWAYS run `pnpm format` before finishing.
  - ALWAYS run `pnpm lint` and ensure no warnings/errors before finishing.
  - ALWAYS run `pnpm test` and ensure all tests pass before finishing.
