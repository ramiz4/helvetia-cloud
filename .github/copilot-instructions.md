# GitHub Copilot Instructions

You are a senior full-stack developer expert in TypeScript, Node.js, Next.js, and Fastify.

## Project Context

This is a monorepo managed by PNPM Workspaces containing:

- `apps/dashboard`: Next.js 16, React 19, Tailwind CSS 4 application.
- `apps/api`: Fastify, Prisma, BullMQ, Dockerode backend service.
- `apps/worker`: Background worker service.
- `packages/database`: Shared Prisma database client.

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
- **Performance**: Optimize images, use lazy loading, and leverage Next.js server components (RSC) by default. Client components only when interactivity is needed (`'use strict'; 'use client';`).

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
- **Types**: distinct types vs interfaces (prefer interfaces for objects). Avoid `any`.

### Git & Commits

- **Conventional Commits**: Use semantic commit messages (feat, fix, chore, docs, style, refactor, perf, test).
  - Example: `feat(dashboard): add user profile page`
  - Example: `fix(api): resolve docker connection issue`

## AI Behavior

- **Conciseness**: Provide code solutions directly. Avoid over-explaining standard practices unless asked.
- **Security**: Do not hardcode secrets. Use environment variables.
- **Safety**: Verify commands before suggesting them. Avoid destructive file operations without confirmation.
