import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui';
import { env } from './env.js';

/**
 * OpenAPI/Swagger Configuration
 *
 * Provides comprehensive API documentation with:
 * - OpenAPI 3.0 specification
 * - Interactive Swagger UI
 * - Authentication schemas
 * - Request/response examples
 * - Error codes documentation
 */

/**
 * Swagger/OpenAPI configuration
 */
export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'Helvetia Cloud API',
      description: `
# Helvetia Cloud API Documentation

Helvetia Cloud is a Platform-as-a-Service (PaaS) that simplifies application deployment and management.

## Features
- **Service Management**: Deploy Docker containers, static sites, and databases
- **GitHub Integration**: Automated deployments from GitHub repositories
- **Real-time Monitoring**: Live logs, metrics, and health checks
- **Organization Management**: Team collaboration and access control

## Authentication

All API endpoints (except public routes) require authentication using JWT tokens.

### Getting Started

1. Authenticate with GitHub OAuth: \`POST /api/v1/auth/github\`
2. Receive JWT access token and refresh token
3. Include access token in requests: \`Authorization: Bearer <token>\` or via cookie
4. Refresh token when expired: \`POST /api/v1/auth/refresh\`

### Token Lifetimes
- **Access Token**: 15 minutes
- **Refresh Token**: 7 days

## Rate Limiting

API requests are rate limited to prevent abuse:
- **Global**: 100 requests per minute per IP
- **Authentication**: 5 requests per minute per IP
- **Deployments**: 10 requests per minute per user
- **WebSocket/SSE**: 20 connections per minute per user

Rate limit headers are included in responses:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Timestamp when limit resets

## Versioning

The API uses URL-based versioning: \`/api/v{version}/\`

Current version: **v1** (\`/api/v1/\`)

### Version Support Policy
- Breaking changes require a new version (v2, v3, etc.)
- Old versions supported for at least 6 months after new release
- Deprecated endpoints marked in documentation

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": {
    "field": "name",
    "issue": "Name is required"
  }
}
\`\`\`

### Common Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request (validation error)
- **401**: Unauthorized (missing/invalid token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate resource)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error

See [Error Codes Documentation](https://github.com/ramiz4/helvetia-cloud/blob/main/apps/api/docs/ERROR_CODES.md) for details.

## Webhooks

GitHub webhooks enable automated deployments on push events.

Configure webhook in your repository:
- **Payload URL**: \`https://your-domain.com/api/v1/webhooks/github\`
- **Content Type**: \`application/json\`
- **Secret**: Your webhook secret (configure in service settings)
- **Events**: Push, Pull Request

## Support

- **Documentation**: [GitHub Repository](https://github.com/ramiz4/helvetia-cloud)
- **Issues**: [GitHub Issues](https://github.com/ramiz4/helvetia-cloud/issues)
- **API Reference**: [API Documentation](/api/v1/docs)
      `,
      version: '1.0.0',
      contact: {
        name: 'Helvetia Cloud',
        url: 'https://github.com/ramiz4/helvetia-cloud',
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC',
      },
    },
    servers: [
      {
        url:
          env.NODE_ENV === 'production'
            ? `https://api.${env.PLATFORM_DOMAIN}`
            : 'http://localhost:3001',
        description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Services',
        description: 'Service management and deployment operations',
      },
      {
        name: 'Deployments',
        description: 'Deployment tracking and log streaming',
      },
      {
        name: 'Projects',
        description: 'Project and environment management',
      },
      {
        name: 'Organizations',
        description: 'Organization and team management',
      },
      {
        name: 'GitHub',
        description: 'GitHub API proxy endpoints',
      },
      {
        name: 'Webhooks',
        description: 'GitHub webhook handlers',
      },
      {
        name: 'Feature Flags',
        description: 'Feature flag management',
      },
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from authentication endpoints',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'JWT token stored in HTTP-only cookie',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            statusCode: {
              type: 'integer',
              example: 400,
            },
            error: {
              type: 'string',
              example: 'Bad Request',
            },
            message: {
              type: 'string',
              example: 'Validation failed',
            },
            details: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: 'clx123456789abcdef',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            name: {
              type: 'string',
              example: 'John Doe',
              nullable: true,
            },
            githubId: {
              type: 'string',
              example: '12345678',
              nullable: true,
            },
            githubUsername: {
              type: 'string',
              example: 'johndoe',
              nullable: true,
            },
            avatarUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://avatars.githubusercontent.com/u/12345678',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Service: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'my-service',
            },
            type: {
              type: 'string',
              enum: ['DOCKER', 'STATIC', 'POSTGRES', 'REDIS', 'MYSQL', 'COMPOSE'],
              example: 'DOCKER',
            },
            status: {
              type: 'string',
              enum: ['running', 'stopped', 'pending', 'failed', 'building', 'deploying'],
              example: 'running',
            },
            repoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://github.com/user/repo',
              nullable: true,
            },
            branch: {
              type: 'string',
              example: 'main',
              nullable: true,
            },
            buildCommand: {
              type: 'string',
              example: 'npm install && npm run build',
              nullable: true,
            },
            startCommand: {
              type: 'string',
              example: 'npm start',
              nullable: true,
            },
            port: {
              type: 'integer',
              example: 3000,
              nullable: true,
            },
            envVars: {
              type: 'object',
              additionalProperties: {
                type: 'string',
              },
              example: {
                NODE_ENV: 'production',
                API_KEY: 'secret',
              },
            },
            customDomain: {
              type: 'string',
              example: 'myapp.com',
              nullable: true,
            },
            staticOutputDir: {
              type: 'string',
              example: 'dist',
              nullable: true,
            },
            volumes: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['/data'],
              nullable: true,
            },
            deleteProtected: {
              type: 'boolean',
              example: false,
            },
            isPreview: {
              type: 'boolean',
              example: false,
            },
            prNumber: {
              type: 'integer',
              example: 42,
              nullable: true,
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            environmentId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Deployment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            serviceId: {
              type: 'string',
              format: 'uuid',
            },
            status: {
              type: 'string',
              enum: ['pending', 'building', 'deploying', 'success', 'failed'],
              example: 'success',
            },
            commitHash: {
              type: 'string',
              example: 'abc123def456',
              nullable: true,
            },
            commitMessage: {
              type: 'string',
              example: 'feat: add new feature',
              nullable: true,
            },
            imageTag: {
              type: 'string',
              example: 'v1.2.3',
              nullable: true,
            },
            logs: {
              type: 'string',
              example: 'Building...\nDeployment successful',
              nullable: true,
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'My Project',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Organization: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'My Organization',
            },
            slug: {
              type: 'string',
              example: 'my-organization',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        cookieAuth: [],
      },
    ],
  },
};

/**
 * Swagger UI configuration
 */
export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: '/api/v1/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
  },
  staticCSP: true,
  transformSpecificationClone: true,
};
