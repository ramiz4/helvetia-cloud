# Error Codes Documentation

This document provides a comprehensive reference for all error codes used in the Helvetia Cloud API.

## Error Response Format

All errors follow a standardized response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "statusCode": 400,
    "details": {} // Optional: Additional error context
  }
}
```

## Error Code Categories

Error codes follow the format: `CATEGORY_SPECIFIC_REASON`

- **AUTH\_\***: Authentication and authorization errors (401, 403)
- **VALIDATION\_\***: Input validation errors (400)
- **RESOURCE\_\***: Resource-related errors (404, 409)
- **SERVICE\_\***: Service-specific errors (404, 403)
- **DEPLOYMENT\_\***: Deployment-specific errors (404, 400)
- **RATE*LIMIT*\***: Rate limiting errors (429)
- **PAYLOAD\_\***: Payload size errors (413)
- **SYSTEM\_\***: System and server errors (500)

---

## Authentication & Authorization Errors (4xx)

### AUTH_INVALID_CREDENTIALS

- **Status Code**: 401
- **Message**: "Invalid username or password"
- **When**: Login credentials are incorrect
- **Example**:
  ```json
  {
    "success": false,
    "error": {
      "code": "AUTH_INVALID_CREDENTIALS",
      "message": "Invalid username or password",
      "statusCode": 401
    }
  }
  ```

### AUTH_TOKEN_EXPIRED

- **Status Code**: 401
- **Message**: "Your session has expired. Please log in again."
- **When**: JWT access token has expired
- **Resolution**: Refresh the token or log in again
- **Example**:
  ```json
  {
    "success": false,
    "error": {
      "code": "AUTH_TOKEN_EXPIRED",
      "message": "Your session has expired. Please log in again.",
      "statusCode": 401
    }
  }
  ```

### AUTH_TOKEN_INVALID

- **Status Code**: 401
- **Message**: "Invalid authentication token"
- **When**: JWT token is malformed or invalid
- **Resolution**: Provide a valid token or log in again

### AUTH_TOKEN_MISSING

- **Status Code**: 401
- **Message**: "Authentication required. Please log in."
- **When**: No authentication token provided for a protected route
- **Resolution**: Provide authentication token in cookies or Authorization header

### AUTH_REFRESH_TOKEN_INVALID

- **Status Code**: 401
- **Message**: "Invalid refresh token. Please log in again."
- **When**: Refresh token is invalid, expired, or revoked
- **Resolution**: User must log in again

### AUTH_UNAUTHORIZED

- **Status Code**: 401
- **Message**: "You are not authorized to access this resource"
- **When**: User is not authenticated
- **Resolution**: Log in to access the resource

### AUTH_FORBIDDEN

- **Status Code**: 403
- **Message**: "You do not have permission to perform this action"
- **When**: User is authenticated but lacks required permissions
- **Resolution**: Contact administrator for access

### AUTH_GITHUB_FAILED

- **Status Code**: 500
- **Message**: "GitHub authentication failed. Please try again."
- **When**: GitHub OAuth flow fails
- **Resolution**: Try authentication again

---

## Validation Errors (4xx)

### VALIDATION_FAILED

- **Status Code**: 400
- **Message**: "The provided data is invalid"
- **When**: Request body fails validation
- **Example**:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "The provided data is invalid",
      "statusCode": 400,
      "details": [
        { "field": "email", "message": "Invalid email format" },
        { "field": "password", "message": "Password must be at least 8 characters" }
      ]
    }
  }
  ```

### VALIDATION_INVALID_INPUT

- **Status Code**: 400
- **Message**: "Invalid input provided"
- **When**: Input data doesn't meet requirements

### VALIDATION_MISSING_FIELD

- **Status Code**: 400
- **Message**: "Required field is missing"
- **When**: Required field is not provided

### VALIDATION_INVALID_FORMAT

- **Status Code**: 400
- **Message**: "Invalid format provided"
- **When**: Data format is incorrect (e.g., invalid URL, email)

---

## Resource Errors (4xx)

### RESOURCE_NOT_FOUND

- **Status Code**: 404
- **Message**: "The requested resource was not found"
- **When**: Generic resource not found
- **Example**:
  ```json
  {
    "success": false,
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "The requested resource was not found",
      "statusCode": 404
    }
  }
  ```

### RESOURCE_CONFLICT

- **Status Code**: 409
- **Message**: "A conflict occurred with the existing resource"
- **When**: Resource operation conflicts with existing state

### RESOURCE_ALREADY_EXISTS

- **Status Code**: 409
- **Message**: "A resource with this identifier already exists"
- **When**: Attempting to create a duplicate resource

### RESOURCE_DELETED

- **Status Code**: 404
- **Message**: "This resource has been deleted"
- **When**: Resource has been soft-deleted

### RESOURCE_PROTECTED

- **Status Code**: 403
- **Message**: "This resource is protected and cannot be modified"
- **When**: Resource is marked as protected from deletion or modification

---

## Service-Specific Errors (4xx)

### SERVICE_NOT_FOUND

- **Status Code**: 404
- **Message**: "Service not found"
- **When**: Requested service doesn't exist or user doesn't have access
- **Example**:
  ```json
  {
    "success": false,
    "error": {
      "code": "SERVICE_NOT_FOUND",
      "message": "Service not found",
      "statusCode": 404
    }
  }
  ```

### SERVICE_NAME_TAKEN

- **Status Code**: 403
- **Message**: "This service name is already taken"
- **When**: Service name is already in use by another user

### SERVICE_PROTECTED

- **Status Code**: 403
- **Message**: "This service is protected from deletion"
- **When**: Attempting to delete a service with delete protection enabled
- **Resolution**: Remove delete protection first

### SERVICE_UNAUTHORIZED

- **Status Code**: 403
- **Message**: "You do not have access to this service"
- **When**: User doesn't own the service

---

## Deployment-Specific Errors (4xx)

### DEPLOYMENT_NOT_FOUND

- **Status Code**: 404
- **Message**: "Deployment not found"
- **When**: Requested deployment doesn't exist

### DEPLOYMENT_FAILED

- **Status Code**: 400
- **Message**: "Deployment failed"
- **When**: Deployment process encountered an error

### DEPLOYMENT_IN_PROGRESS

- **Status Code**: 409
- **Message**: "A deployment is already in progress"
- **When**: Attempting to start a new deployment while one is running

---

## Rate Limiting Errors (4xx)

### RATE_LIMIT_EXCEEDED

- **Status Code**: 429
- **Message**: "Too many requests. Please try again later."
- **When**: User exceeds rate limit for an endpoint
- **Headers**: Response includes `Retry-After` header
- **Resolution**: Wait before making additional requests

---

## Payload Errors (4xx)

### PAYLOAD_TOO_LARGE

- **Status Code**: 413
- **Message**: "Request payload is too large"
- **When**: Request body exceeds maximum allowed size
- **Limits**:
  - Global: 10MB
  - Standard endpoints: 1MB
  - Small endpoints (auth, config): 100KB
- **Example**:
  ```json
  {
    "success": false,
    "error": {
      "code": "PAYLOAD_TOO_LARGE",
      "message": "Request body exceeds the maximum allowed size of 1MB",
      "statusCode": 413
    }
  }
  ```

---

## System & Server Errors (5xx)

### SYSTEM_ERROR

- **Status Code**: 500
- **Message**: "An unexpected error occurred. Please try again."
- **When**: Unhandled server error occurs
- **Resolution**: Try again later or contact support

### SYSTEM_DATABASE_ERROR

- **Status Code**: 500
- **Message**: "Database error occurred. Please try again."
- **When**: Database operation fails

### SYSTEM_DOCKER_ERROR

- **Status Code**: 500
- **Message**: "Container management error occurred"
- **When**: Docker/container operation fails

### SYSTEM_GITHUB_API_ERROR

- **Status Code**: 500
- **Message**: "GitHub API error. Please try again."
- **When**: GitHub API request fails

### SYSTEM_REDIS_ERROR

- **Status Code**: 500
- **Message**: "Cache service error. Please try again."
- **When**: Redis/cache operation fails

---

## Internationalization (i18n)

Error messages support internationalization through the `Accept-Language` header.

### Supported Languages

- **English (`en`)**: Default language

### Adding New Languages

1. Create a new language file in `apps/api/src/errors/i18n/`:

   ```typescript
   // apps/api/src/errors/i18n/es.ts
   import { ErrorCode } from '../ErrorCodes';

   export const es: Record<ErrorCode, string> = {
     [ErrorCode.AUTH_UNAUTHORIZED]: 'No estás autorizado para acceder a este recurso',
     // ... other translations
   };
   ```

2. Update `apps/api/src/errors/i18n/index.ts`:

   ```typescript
   import { es } from './es';

   export type Language = 'en' | 'es';

   const translations: Record<Language, Record<ErrorCode, string>> = {
     en,
     es,
   };
   ```

### Language Detection

The API automatically detects the user's language from the `Accept-Language` header:

```http
GET /api/services
Accept-Language: es-ES,es;q=0.9,en;q=0.8
```

If the requested language is not supported, the API falls back to English.

---

## Usage Examples

### Client-Side Error Handling

```typescript
async function fetchServices() {
  try {
    const response = await fetch('/api/services', {
      credentials: 'include',
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();

      // Handle specific error codes
      switch (errorData.error.code) {
        case 'AUTH_TOKEN_EXPIRED':
          // Attempt token refresh
          await refreshToken();
          break;
        case 'SERVICE_NOT_FOUND':
          // Show not found message
          showError('Service not found');
          break;
        default:
          // Show generic error
          showError(errorData.error.message);
      }
    }

    return response.json();
  } catch (error) {
    console.error('Network error:', error);
  }
}
```

### Server-Side Error Throwing

```typescript
import { NotFoundError, ValidationError, ErrorCode } from './errors';

// Throw specific error with default message
throw new NotFoundError(undefined, ErrorCode.SERVICE_NOT_FOUND);

// Throw error with custom message
throw new NotFoundError('Service "my-app" not found', ErrorCode.SERVICE_NOT_FOUND);

// Throw validation error with details
throw new ValidationError('Invalid service configuration', {
  fields: ['name', 'port'],
  errors: ['Name is required', 'Port must be a number'],
});
```

---

## Best Practices

1. **Always use error codes**: Clients should check `error.code` for programmatic handling
2. **Provide context**: Include helpful details in the `details` field when applicable
3. **Log errors**: Server logs include full error context for debugging
4. **Don't expose internals**: In production, system errors hide implementation details
5. **Use specific codes**: Use service/deployment-specific codes instead of generic ones when possible
6. **Handle gracefully**: Always provide user-friendly error messages

---

## Change Log

- **v1.0.0** (2024-01-10): Initial error code standardization
  - Added 30+ error codes across all categories
  - Implemented i18n support
  - Standardized error response format
