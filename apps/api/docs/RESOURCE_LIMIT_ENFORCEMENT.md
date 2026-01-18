# Resource Limit Enforcement Policies

## Overview

This document describes how subscription-based resource limits are enforced in Helvetia Cloud to ensure fair usage and prevent abuse while providing a good user experience.

## Subscription Tiers and Limits

### FREE Tier

- **Max Services**: 1
- **Max Memory**: 512MB total
- **Max CPU**: 0.5 cores total
- **Max Bandwidth**: 10GB per month
- **Max Storage**: 5GB total

### STARTER Tier

- **Max Services**: 5
- **Max Memory**: 2,048MB (2GB) total
- **Max CPU**: 2 cores total
- **Max Bandwidth**: 100GB per month
- **Max Storage**: 50GB total

### PRO Tier

- **Max Services**: 20
- **Max Memory**: 8,192MB (8GB) total
- **Max CPU**: 8 cores total
- **Max Bandwidth**: 500GB per month
- **Max Storage**: 200GB total

### ENTERPRISE Tier

- **Max Services**: Unlimited
- **Max Memory**: Unlimited
- **Max CPU**: Unlimited
- **Max Bandwidth**: Unlimited
- **Max Storage**: Unlimited

## Enforcement Mechanisms

### 1. Subscription Status Check

Before any service operation (create, update, start), the system checks the user's subscription status:

**Allowed Statuses:**

- `ACTIVE` - Full access to all features within tier limits
- `PAST_DUE` (with grace period) - Access granted for 7 days after payment due date

**Blocked Statuses:**

- `PAST_DUE` (after grace period) - Access blocked after 7 days
- `CANCELED` - No access to service creation/modification
- `UNPAID` - No access until payment is completed

**Implementation:**

```typescript
// Middleware: requireActiveSubscription
// Applied to: All service operation routes
// Error: 403 Forbidden with specific message for each status
```

### 2. Resource Limit Enforcement

#### Service Count Enforcement

**When:** Before creating a new service  
**How:** Count existing non-deleted services for the user  
**Enforcement:**

```typescript
if (serviceCount >= limits.maxServices && limits.maxServices !== -1) {
  throw ForbiddenError('Service limit reached for your plan');
}
```

**Middleware:** `enforceResourceLimits('service')`  
**Applied to:** `POST /services`

#### Memory Limit Enforcement

**When:** Before creating a new service  
**How:** Sum memory allocation for all active services + requested memory  
**Default Memory:** 512MB per service if not specified  
**Enforcement:**

```typescript
const totalMemory = currentServicesMemory + requestedMemory;
if (totalMemory > limits.maxMemoryMB && limits.maxMemoryMB !== -1) {
  throw ForbiddenError('Memory limit exceeded');
}
```

**Middleware:** `enforceResourceLimits('memory')`  
**Applied to:** `POST /services`, `PATCH /services/:id`

#### CPU Limit Enforcement

**When:** Before creating a new service  
**How:** Sum CPU allocation for all active services + requested CPU  
**Default CPU:** 0.5 cores per service if not specified  
**Enforcement:**

```typescript
const totalCPU = currentServicesCPU + requestedCPU;
if (totalCPU > limits.maxCPUCores && limits.maxCPUCores !== -1) {
  throw ForbiddenError('CPU limit exceeded');
}
```

**Middleware:** `enforceResourceLimits('cpu')`  
**Applied to:** `POST /services`, `PATCH /services/:id`

#### Bandwidth Limit Enforcement

**When:** During usage tracking (not yet implemented)  
**How:** Track bandwidth usage per billing period  
**Action:** Throttle or suspend service when limit exceeded  
**Future Implementation:** Background job to monitor and enforce

#### Storage Limit Enforcement

**When:** During usage tracking (not yet implemented)  
**How:** Sum storage usage across all services  
**Action:** Block new deployments when limit exceeded  
**Future Implementation:** Background job to monitor and enforce

## Grace Period for Past Due Subscriptions

### Purpose

Allow users time to update their payment method without immediate service disruption.

### Duration

7 days from the end of the current billing period

### Behavior

**Days 0-7 (Grace Period):**

- User can continue using services
- Warning messages shown in dashboard
- Email notifications sent on day 1, 3, and 7
- API logs warning but allows access

**After Day 7:**

- Access to service operations blocked
- Services continue running but cannot be modified
- User must update payment method to regain access

**Implementation:**

```typescript
const gracePeriodMs = 7 * 24 * 60 * 60 * 1000; // 7 days
const timeSinceExpiry = now.getTime() - periodEnd.getTime();

if (timeSinceExpiry < gracePeriodMs) {
  // Within grace period - allow access
  request.log.warn('User accessing service during grace period');
  return;
} else {
  // After grace period - block access
  throw ForbiddenError('Payment past due');
}
```

## Automatic Service Suspension

### Trigger Events

1. Subscription canceled by user
2. Subscription marked as UNPAID by Stripe
3. Past due subscription exceeds grace period

### Suspension Process

**Phase 1: Soft Suspension** (Future Implementation)

- Services remain running but read-only
- No new deployments allowed
- No service modifications allowed
- User can access dashboard to update payment

**Phase 2: Hard Suspension** (Future Implementation)

- All services stopped
- Data retained for 30 days
- User can reactivate by subscribing again

### Recovery Process

**Automatic Recovery:**

- When payment is successful
- When user upgrades/reactivates subscription
- Services automatically restart (if soft suspended)
- User must manually restart (if hard suspended)

## Error Messages

All enforcement errors return HTTP 403 (Forbidden) with descriptive messages:

### Subscription Status Errors

- `SUBSCRIPTION_NOT_FOUND`: "No subscription found. Please subscribe to a plan."
- `SUBSCRIPTION_INACTIVE`: "Your subscription is not active."
- `SUBSCRIPTION_PAST_DUE`: "Your subscription payment is past due. Please update your payment method."
- `SUBSCRIPTION_CANCELED`: "Your subscription has been canceled. Please resubscribe."
- `SUBSCRIPTION_UNPAID`: "Your subscription is unpaid. Please complete payment."

### Resource Limit Errors

- `LIMIT_SERVICE_COUNT_EXCEEDED`: "Service limit reached. Your {plan} plan allows {N} service(s). Please upgrade your plan."
- `LIMIT_MEMORY_EXCEEDED`: "Memory limit exceeded. Your {plan} plan allows {N}MB. Current usage: {X}MB, requested: {Y}MB."
- `LIMIT_CPU_EXCEEDED`: "CPU limit exceeded. Your {plan} plan allows {N} cores. Current usage: {X} cores, requested: {Y} cores."
- `LIMIT_BANDWIDTH_EXCEEDED`: "Bandwidth limit exceeded. Please upgrade your plan."
- `LIMIT_STORAGE_EXCEEDED`: "Storage limit exceeded. Please upgrade your plan."

## Monitoring and Alerts

### System Monitoring

- Track enforcement events (limits reached, access denied)
- Log all grace period access
- Monitor suspension/recovery events
- Track upgrade conversions after limit hits

### User Notifications

- Email alerts for approaching limits (80%, 90%, 100%)
- Dashboard warnings for resource usage
- Grace period countdown notifications
- Suspension warnings

## API Implementation

### Routes Protected by Middleware

```typescript
// Service Creation - Protected by both middlewares
POST /services
  preHandler: [
    requireActiveSubscription,
    enforceResourceLimits('service')
  ]

// Service Updates - May need resource checks
PATCH /services/:id
  preHandler: [
    requireActiveSubscription
  ]

// Other service operations - Subscription check only
GET /services
DELETE /services/:id
POST /services/:id/recover
  preHandler: [requireActiveSubscription]
```

### Middleware Configuration

```typescript
import { requireActiveSubscription, enforceResourceLimits } from './middleware';

// Apply to routes as needed
fastify.post(
  '/services',
  {
    preHandler: [requireActiveSubscription, enforceResourceLimits('service')],
  },
  handler,
);
```

## Future Enhancements

1. **Dynamic Resource Allocation**
   - Allow users to configure resource allocation per service
   - Track actual resource usage vs. allocation

2. **Usage-Based Billing**
   - Implement metered billing for usage beyond base limits
   - Automatic billing for overage

3. **Soft Limits vs Hard Limits**
   - Soft limits: Warn but allow with overage charges
   - Hard limits: Block operations completely

4. **Per-Service Limits**
   - Set individual limits per service
   - Allow users to manage resource distribution

5. **Bandwidth and Storage Enforcement**
   - Real-time bandwidth monitoring
   - Storage quota enforcement with cleanup options

6. **Automated Suspension System**
   - Background job to check subscriptions hourly
   - Automated email notifications
   - Gradual suspension process

## Testing

### Unit Tests

- Subscription status validation
- Resource limit calculations
- Grace period logic
- Error message formatting

### Integration Tests

- End-to-end service creation with limits
- Subscription status changes
- Grace period expiration
- Suspension and recovery flows

### Manual Testing Checklist

- [ ] Create service at limit - blocked
- [ ] Create service under limit - allowed
- [ ] Access with expired subscription - blocked
- [ ] Access during grace period - allowed with warning
- [ ] Upgrade plan - limits updated immediately
- [ ] Downgrade plan - existing services not affected, new services limited

## Security Considerations

1. **Rate Limiting**: Prevent abuse of limit checks
2. **Input Validation**: Validate all resource specifications
3. **Audit Logging**: Log all enforcement decisions
4. **Error Messages**: Don't expose internal system details
5. **Token Security**: Verify subscription data integrity

## Compliance

- **Fair Usage Policy**: Clearly communicated limits
- **Transparency**: Users can see their current usage
- **Warning Period**: Grace period before hard blocks
- **Data Retention**: 30 days after suspension
- **Recovery Options**: Clear path to regain access
