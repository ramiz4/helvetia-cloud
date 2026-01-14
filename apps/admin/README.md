# Admin Panel

Administrative control panel for Helvetia Cloud platform.

## Overview

The Admin Panel is a standalone Next.js application that provides administrative functionality for the Helvetia Cloud platform. It runs independently from the main dashboard and is accessible only to users with admin privileges.

## Features

- **Admin Dashboard**: Central hub for administrative tasks
- **Server Setup**: Generate deployment scripts for VPS setup
- **Feature Flags**: Manage feature toggles and A/B testing
- **User Management**: (Coming Soon) Manage users, roles, and permissions
- **System Analytics**: (Coming Soon) Monitor platform performance
- **Security Settings**: (Coming Soon) Configure security policies
- **Activity Logs**: (Coming Soon) View system and user activity logs

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19, Tailwind CSS 4
- **Language**: TypeScript
- **Authentication**: JWT-based admin authentication
- **Notifications**: react-hot-toast

## Development

### Prerequisites

- Node.js v20+
- pnpm (package manager)
- API service running on port 3001

### Getting Started

1. Install dependencies (from monorepo root):

   ```bash
   pnpm install
   ```

2. Start the development server:

   ```bash
   pnpm --filter admin dev
   ```

3. Access the admin panel at http://localhost:3002

### Scripts

- `pnpm dev` - Start development server (port 3002)
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode

## Authentication

The admin panel requires users to have the `ADMIN` role. Users are authenticated via the `/auth/login` endpoint of the API service.

### Login Flow

1. User enters credentials on `/login`
2. Credentials are validated against the API
3. If user has `ADMIN` role, they are redirected to the dashboard
4. If user lacks admin privileges, access is denied

## Environment Variables

The admin panel uses the same environment variables as the main platform:

- `NEXT_PUBLIC_API_URL` - API base URL (default: http://localhost:3001)
- `NEXT_PUBLIC_APP_URL` - Admin app URL (default: http://localhost:3002)

See `.env.example` in the repository root for full configuration.

## Architecture

The admin panel is designed to be:

- **Standalone**: Runs independently on its own port
- **Lightweight**: Only includes admin-specific features
- **Secure**: Enforces admin role verification on all routes
- **Minimal**: No navigation bar or complex layouts

## Deployment

The admin panel can be deployed separately from the main dashboard:

```bash
# Build
pnpm --filter admin build

# Start
pnpm --filter admin start
```

Or use Docker:

```bash
docker build -t helvetia-admin -f apps/admin/Dockerfile .
docker run -p 3002:3002 helvetia-admin
```

## Security

- All admin routes require authentication
- Role verification happens on both client and server
- Unauthorized access attempts are logged
- No guest or public access allowed

## Contributing

When adding new admin features:

1. Create new pages under `src/app/`
2. Use the `useAdminAuth()` hook for authentication
3. Follow existing UI patterns for consistency
4. Update this README with new features
