# Usage Collection System

## Overview

The usage collection system automatically tracks resource usage from running containers for billing purposes. It collects metrics every 10 minutes (configurable) and records them to the database for billing and reporting.

## Architecture

### Components

1. **UsageCollectionService** (`apps/worker/src/services/usageCollection.service.ts`)
   - Collects metrics from Docker containers
   - Calculates usage for each metric type
   - Records usage to database

2. **Usage Collection Worker** (`apps/worker/src/usageCollection.ts`)
   - BullMQ worker that runs periodically
   - Orchestrates the collection process
   - Handles errors and retries

3. **API Endpoints** (`apps/api/src/routes/billing.routes.ts`)
   - `/billing/usage` - Current period usage
   - `/billing/usage/history` - Historical usage
   - `/billing/usage/service/:id` - Service-specific usage

## Metrics Collected

### 1. Compute Hours (`COMPUTE_HOURS`)

- **Description**: Total hours containers were running
- **Calculation**: `(collection_interval_minutes / 60) * number_of_containers`
- **Unit**: Hours
- **Pricing**: $0.01 per compute hour

### 2. Memory GB-Hours (`MEMORY_GB_HOURS`)

- **Description**: Memory usage over time
- **Calculation**: `(memory_MB / 1024) * (collection_interval_minutes / 60)`
- **Unit**: GB-hours
- **Pricing**: $0.005 per GB-hour

### 3. Bandwidth GB (`BANDWIDTH_GB`)

- **Description**: Network data transferred
- **Calculation**: `(network_rx_bytes + network_tx_bytes) / 1024^3`
- **Unit**: Gigabytes
- **Pricing**: $0.12 per GB
- **Note**: Cumulative since container start

### 4. Storage GB (`STORAGE_GB`)

- **Description**: Block I/O as proxy for storage
- **Calculation**: `(block_read_bytes + block_write_bytes) / 1024^3`
- **Unit**: Gigabytes
- **Pricing**: $0.023 per GB per month
- **Note**: Cumulative since container start

## Configuration

### Environment Variables

```env
# Interval (in minutes) for collecting resource usage metrics from containers
# Default: 10 minutes
# Recommended range: 5-15 minutes (lower = more accurate, higher = less overhead)
USAGE_COLLECTION_INTERVAL_MINUTES=10
```

### Adjusting Collection Interval

- **Lower interval (5 min)**: More accurate metrics, higher system overhead
- **Higher interval (15 min)**: Less accurate metrics, lower system overhead
- **Default (10 min)**: Good balance between accuracy and overhead

## How It Works

### 1. Collection Process

```
┌─────────────────────────────────────────────────────────────┐
│ BullMQ Scheduler (Every 10 minutes)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ UsageCollectionWorker                                        │
│ - Triggers collection job                                   │
│ - Handles errors and retries                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ UsageCollectionService.collectAndRecord()                   │
│ 1. List all running containers with helvetia.serviceId      │
│ 2. Collect metrics from each container via Docker API       │
│ 3. Calculate usage for collection interval                  │
│ 4. Record to database                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2. Metric Collection

For each running container:

1. Call Docker `container.stats({ stream: false })`
2. Extract CPU, memory, network, and block I/O stats
3. Calculate usage based on collection interval
4. Aggregate by service (multiple containers per service)

### 3. Database Recording

Usage records are created with:

- `serviceId`: Service the container belongs to
- `metric`: Type of metric (COMPUTE_HOURS, MEMORY_GB_HOURS, etc.)
- `quantity`: Amount of usage
- `timestamp`: When the record was created
- `periodStart`: Start of collection period
- `periodEnd`: End of collection period

## API Usage

### Get Current Period Usage

```bash
GET /api/v1/billing/usage
Authorization: Bearer <token>
```

**Response:**

```json
{
  "usage": [
    {
      "metric": "COMPUTE_HOURS",
      "quantity": 12.5,
      "cost": 0.13
    },
    {
      "metric": "MEMORY_GB_HOURS",
      "quantity": 6.25,
      "cost": 0.03
    }
  ],
  "periodStart": "2024-01-01T00:00:00Z",
  "periodEnd": "2024-02-01T00:00:00Z"
}
```

### Get Historical Usage

```bash
GET /api/v1/billing/usage/history?periodStart=2024-01-01T00:00:00Z&periodEnd=2024-01-31T23:59:59Z
Authorization: Bearer <token>
```

**Query Parameters:**

- `periodStart` (optional): Start date (ISO 8601), defaults to 30 days ago
- `periodEnd` (optional): End date (ISO 8601), defaults to now
- `organizationId` (optional): Filter by organization

### Get Service-Specific Usage

```bash
GET /api/v1/billing/usage/service/:serviceId?periodStart=2024-01-01T00:00:00Z
Authorization: Bearer <token>
```

**Response:**

```json
{
  "usage": [
    {
      "metric": "COMPUTE_HOURS",
      "quantity": 5.0
    },
    {
      "metric": "MEMORY_GB_HOURS",
      "quantity": 2.5
    }
  ],
  "periodStart": "2024-01-01T00:00:00Z",
  "periodEnd": "2024-01-31T23:59:59Z",
  "serviceId": "svc_123",
  "serviceName": "my-api"
}
```

## Monitoring

### Logs

The usage collection worker logs:

- Start of collection: `Starting usage collection`
- Number of containers found
- Number of services processed
- Number of records created
- Errors and failures

**Example logs:**

```
INFO: Starting usage collection intervalMinutes=10 periodStart="2024-01-01T00:00:00Z"
INFO: Recorded usage for collection period count=8 services=2
INFO: Usage collection completed successfully servicesProcessed=2 recordsCreated=8
```

### Errors

The worker retries failed collections up to 3 times with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: 5 seconds delay
- Attempt 3: 10 seconds delay (5s \* 2^1)

**Common errors:**

- Docker API unavailable
- Database connection issues
- Container stats unavailable (container stopped mid-collection)

## Stripe Integration

Usage is automatically reported to Stripe for active subscriptions when STRIPE_SECRET_KEY and price IDs are configured. The system:

1. Collects usage from containers and records to database
2. Retrieves all ACTIVE subscriptions
3. Filters usage by subscription ownership (user or organization)
4. Reports aggregated usage to Stripe for each metric type
5. Handles per-subscription errors with 20% failure threshold

```typescript
// Automatic reporting happens after each collection cycle
// No manual intervention required when properly configured
```

### Mapping to Stripe Products

### Mapping to Stripe Products

Each metric maps to a Stripe metered price:

- `COMPUTE_HOURS` → `STRIPE_PRICE_ID_COMPUTE_HOURS`
- `MEMORY_GB_HOURS` → `STRIPE_PRICE_ID_MEMORY_GB_HOURS`
- `BANDWIDTH_GB` → `STRIPE_PRICE_ID_BANDWIDTH_GB`
- `STORAGE_GB` → `STRIPE_PRICE_ID_STORAGE_GB`

### Error Handling

- Per-subscription errors are logged but don't fail the entire job
- If >20% of subscriptions fail, the job triggers a retry
- Failed subscriptions are logged with IDs for investigation
- Network/storage deltas prevent double-billing across collections

## Database Schema

### UsageRecord Model

```prisma
model UsageRecord {
  id          String      @id @default(uuid())
  serviceId   String
  metric      UsageMetric
  quantity    Float
  timestamp   DateTime    @default(now())
  periodStart DateTime
  periodEnd   DateTime
  createdAt   DateTime    @default(now())

  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@index([serviceId, periodStart, periodEnd])
  @@index([timestamp])
  @@index([metric])
}

enum UsageMetric {
  COMPUTE_HOURS
  MEMORY_GB_HOURS
  BANDWIDTH_GB
  STORAGE_GB
}
```

## Testing

### Unit Tests

Run usage collection service tests:

```bash
pnpm --filter worker test src/services/usageCollection.service.test.ts
```

**Test coverage:**

- Metric collection from containers
- Usage calculation for different intervals
- Aggregation across multiple containers
- Database recording with proper filtering

### Manual Testing

1. **Start a service:**

   ```bash
   # Deploy a service through the API
   curl -X POST http://localhost:3001/api/v1/services \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"name":"test-service", ...}'
   ```

2. **Wait for collection cycle** (10 minutes by default)

3. **Check usage:**
   ```bash
   curl http://localhost:3001/api/v1/billing/usage \
     -H "Authorization: Bearer $TOKEN"
   ```

## Troubleshooting

### No usage records created

**Possible causes:**

1. No containers running with `helvetia.serviceId` label
2. Collection worker not started
3. Docker socket not accessible

**Solution:**

```bash
# Check worker logs
docker logs worker-container

# Check running containers
docker ps --filter label=helvetia.serviceId

# Verify Docker socket permissions
ls -la /var/run/docker.sock
```

### Metrics seem incorrect

**Possible causes:**

1. Collection interval too long (network/storage cumulative)
2. Containers restarting frequently
3. Multiple containers for same service not aggregated

**Solution:**

- Reduce collection interval for more accuracy
- Check container logs for restart issues
- Verify service ID labels are correct

### Database growing too large

**Possible causes:**

1. High collection frequency
2. Many services running
3. No data rollup/archival

**Solution:**

- Implement data rollup (aggregate old records)
- Archive historical data to cold storage
- Increase collection interval

## Future Enhancements

### Planned Features

1. **Data Rollup**: Aggregate old usage records into daily/monthly summaries
2. **Stripe Integration**: Automatic reporting to Stripe metered billing
3. **Usage Forecasting**: Predict future usage based on trends
4. **Cost Alerts**: Notify users when usage exceeds thresholds
5. **Usage Limits**: Enforce per-plan usage limits
6. **Historical Analysis**: Charts and graphs of usage over time
7. **Export**: CSV/JSON export of usage data

### Performance Optimizations

1. Batch database inserts (already implemented with `createMany`)
2. Parallel container stats collection
3. Caching of container lists
4. Background processing of historical queries

## References

- Docker Stats API: https://docs.docker.com/engine/api/v1.43/#tag/Container/operation/ContainerStats
- BullMQ Documentation: https://docs.bullmq.io/
- Stripe Metered Billing: https://stripe.com/docs/billing/subscriptions/usage-based
