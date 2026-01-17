# API Getting Started Guide

Welcome to the Helvetia Cloud API! This guide will help you get started with the API quickly.

## Base URL

- **Production**: `https://api.helvetia.cloud`
- **Development**: `http://localhost:3001`

All API endpoints are versioned and use the `/api/v1` prefix:

```
https://api.helvetia.cloud/api/v1/{endpoint}
```

## Interactive Documentation

Visit the interactive API documentation at:

- **Production**: `https://api.helvetia.cloud/api/v1/docs`
- **Development**: `http://localhost:3001/api/v1/docs`

The interactive docs allow you to:

- Browse all available endpoints
- View request/response schemas
- Try out endpoints directly from your browser
- See code examples in multiple languages

## Authentication

Helvetia Cloud API uses JWT (JSON Web Tokens) for authentication. There are two types of tokens:

1. **Access Token**: Short-lived (15 minutes), used for API requests
2. **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

### Authenticating with GitHub OAuth

1. **Redirect user to GitHub OAuth**:

   ```
   https://github.com/login/oauth/authorize?client_id={YOUR_CLIENT_ID}&scope=user:email,read:org,repo
   ```

2. **Exchange authorization code for tokens**:

   ```bash
   curl -X POST https://api.helvetia.cloud/api/v1/auth/github \
     -H "Content-Type: application/json" \
     -d '{"code": "AUTHORIZATION_CODE"}'
   ```

   Response:

   ```json
   {
     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": "clx123...",
       "email": "user@example.com",
       "name": "John Doe",
       "githubUsername": "johndoe"
     }
   }
   ```

### Authenticating with Email/Password

```bash
curl -X POST https://api.helvetia.cloud/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!"
  }'
```

### Using Access Tokens

Include the access token in the `Authorization` header:

```bash
curl https://api.helvetia.cloud/api/v1/services \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Alternatively, tokens can be sent via cookies (set automatically after authentication).

### Refreshing Tokens

When your access token expires (after 15 minutes), use the refresh token to get a new one:

```bash
curl -X POST https://api.helvetia.cloud/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Quick Start Example

Here's a complete example of deploying a service:

### 1. Authenticate

```bash
# Get your access token (after GitHub OAuth)
export ACCESS_TOKEN="your_access_token_here"
```

### 2. Create a Service

```bash
curl -X POST https://api.helvetia.cloud/api/v1/services \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "type": "DOCKER",
    "repoUrl": "https://github.com/username/my-app",
    "branch": "main",
    "buildCommand": "npm install && npm run build",
    "startCommand": "npm start",
    "port": 3000,
    "envVars": {
      "NODE_ENV": "production"
    }
  }'
```

Response:

```json
{
  "id": "clx123...",
  "name": "my-app",
  "type": "DOCKER",
  "status": "pending",
  "repoUrl": "https://github.com/username/my-app",
  "branch": "main",
  "port": 3000,
  "createdAt": "2024-01-16T12:00:00Z"
}
```

### 3. Deploy the Service

```bash
curl -X POST https://api.helvetia.cloud/api/v1/services/clx123.../deploy \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

Response:

```json
{
  "id": "deploy_123...",
  "serviceId": "clx123...",
  "status": "pending",
  "createdAt": "2024-01-16T12:01:00Z"
}
```

### 4. Monitor Deployment (Real-time logs)

```bash
curl -N https://api.helvetia.cloud/api/v1/deployments/deploy_123.../logs/stream \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: text/event-stream"
```

This will stream deployment logs in real-time using Server-Sent Events (SSE).

### 5. Check Service Status

```bash
curl https://api.helvetia.cloud/api/v1/services/clx123... \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Common Use Cases

### List All Services

```bash
curl https://api.helvetia.cloud/api/v1/services \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Update Service Configuration

```bash
curl -X PATCH https://api.helvetia.cloud/api/v1/services/clx123... \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "envVars": {
      "NODE_ENV": "production",
      "API_KEY": "new_secret_key"
    }
  }'
```

### Get Service Metrics

```bash
curl https://api.helvetia.cloud/api/v1/services/clx123.../metrics \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### View Deployment History

```bash
curl https://api.helvetia.cloud/api/v1/services/clx123.../deployments \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Set Up GitHub Webhook

Configure in your GitHub repository settings:

- **Payload URL**: `https://api.helvetia.cloud/api/v1/webhooks/github`
- **Content Type**: `application/json`
- **Secret**: Your webhook secret (from service settings)
- **Events**: Select "Push" and "Pull request"

Now deployments will trigger automatically on git push!

## Code Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE_URL = 'https://api.helvetia.cloud/api/v1';
let accessToken = 'YOUR_ACCESS_TOKEN';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});

// Create a service
async function createService() {
  try {
    const response = await api.post('/services', {
      name: 'my-app',
      type: 'DOCKER',
      repoUrl: 'https://github.com/username/my-app',
      branch: 'main',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm start',
      port: 3000,
    });

    console.log('Service created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Deploy a service
async function deployService(serviceId) {
  try {
    const response = await api.post(`/services/${serviceId}/deploy`);
    console.log('Deployment started:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Get service metrics
async function getServiceMetrics(serviceId) {
  try {
    const response = await api.get(`/services/${serviceId}/metrics`);
    console.log('Metrics:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Refresh access token
async function refreshToken(refreshToken) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: refreshToken,
    });

    accessToken = response.data.accessToken;
    // Update axios instance with new token
    api.defaults.headers['Authorization'] = `Bearer ${accessToken}`;

    return response.data.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error.response.data);
  }
}
```

### Python

```python
import requests
import json

API_BASE_URL = 'https://api.helvetia.cloud/api/v1'
access_token = 'YOUR_ACCESS_TOKEN'

# Create headers
headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json'
}

# Create a service
def create_service():
    data = {
        'name': 'my-app',
        'type': 'DOCKER',
        'repoUrl': 'https://github.com/username/my-app',
        'branch': 'main',
        'buildCommand': 'npm install && npm run build',
        'startCommand': 'npm start',
        'port': 3000
    }

    response = requests.post(
        f'{API_BASE_URL}/services',
        headers=headers,
        json=data
    )

    if response.ok:
        print('Service created:', response.json())
        return response.json()
    else:
        print('Error:', response.json())

# Deploy a service
def deploy_service(service_id):
    response = requests.post(
        f'{API_BASE_URL}/services/{service_id}/deploy',
        headers=headers
    )

    if response.ok:
        print('Deployment started:', response.json())
        return response.json()
    else:
        print('Error:', response.json())

# Get service metrics
def get_service_metrics(service_id):
    response = requests.get(
        f'{API_BASE_URL}/services/{service_id}/metrics',
        headers=headers
    )

    if response.ok:
        print('Metrics:', response.json())
        return response.json()
    else:
        print('Error:', response.json())

# List all services
def list_services():
    response = requests.get(
        f'{API_BASE_URL}/services',
        headers=headers
    )

    if response.ok:
        services = response.json()
        print(f'Found {len(services)} services')
        return services
    else:
        print('Error:', response.json())

# Refresh access token
def refresh_token(refresh_token):
    response = requests.post(
        f'{API_BASE_URL}/auth/refresh',
        json={'refreshToken': refresh_token}
    )

    if response.ok:
        global access_token
        access_token = response.json()['accessToken']
        headers['Authorization'] = f'Bearer {access_token}'
        return access_token
    else:
        print('Token refresh failed:', response.json())
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

| Endpoint Type      | Limit                          |
| ------------------ | ------------------------------ |
| Global             | 100 requests/minute per IP     |
| Authentication     | 5 requests/minute per IP       |
| Deployments        | 10 requests/minute per user    |
| Webhooks/SSE       | 20 connections/minute per user |
| Feature Flag Check | 30 requests/minute per IP      |

Rate limit information is included in response headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

When rate limited, you'll receive a `429 Too Many Requests` response:

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 30 seconds"
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": {
    "field": "name",
    "issue": "Name must be at least 2 characters"
  }
}
```

Common status codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (duplicate resource)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Best Practices

1. **Token Management**
   - Store tokens securely (never in version control)
   - Implement automatic token refresh before expiry
   - Handle 401 errors by refreshing token

2. **Rate Limiting**
   - Monitor rate limit headers
   - Implement exponential backoff for retries
   - Cache responses when appropriate

3. **Error Handling**
   - Always check response status codes
   - Parse error messages for user feedback
   - Implement proper logging

4. **Webhooks**
   - Verify webhook signatures
   - Implement idempotency for webhook handlers
   - Return 200 response quickly (process async)

5. **Real-time Updates**
   - Use SSE endpoints for live logs/metrics
   - Implement reconnection logic
   - Handle connection timeouts gracefully

## Support

- **Documentation**: [API Reference](https://api.helvetia.cloud/api/v1/docs)
- **Repository**: [GitHub](https://github.com/ramiz4/helvetia-cloud)
- **Issues**: [GitHub Issues](https://github.com/ramiz4/helvetia-cloud/issues)

## Next Steps

- Explore the [Interactive API Documentation](https://api.helvetia.cloud/api/v1/docs)
- Check out [Error Codes Documentation](./ERROR_CODES.md)
- Read about [API Versioning](./API_VERSIONING.md)
- Learn about [Security Best Practices](./SECURITY.md)
