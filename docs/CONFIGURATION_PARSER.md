# Configuration Parser Documentation

## Overview

The configuration parser provides safe environment variable parsing utilities that handle invalid values gracefully, preventing silent failures or NaN values. All numeric configuration values are validated with appropriate ranges and logged warnings when invalid or out-of-range values are detected.

## Parsing Functions

### `parseIntEnv(name, defaultValue, options)`

Safely parses an integer environment variable with range validation.

**Parameters:**

- `name` (string): Environment variable name
- `defaultValue` (number): Default value if not set or invalid
- `options` (object, optional):
  - `min` (number): Minimum allowed value
  - `max` (number): Maximum allowed value

**Behavior:**

- Returns the default value if the environment variable is not set
- Logs a warning and returns the default if the value cannot be parsed (NaN)
- Logs a warning and returns the minimum if the value is below the minimum
- Logs a warning and returns the maximum if the value is above the maximum
- Returns the parsed value if valid and within range

**Example:**

```typescript
const memoryLimit = parseIntEnv('CONTAINER_MEMORY_LIMIT_MB', 512, { min: 64, max: 8192 });
```

### `parseFloatEnv(name, defaultValue, options)`

Safely parses a float environment variable with range validation.

**Parameters:**

- `name` (string): Environment variable name
- `defaultValue` (number): Default value if not set or invalid
- `options` (object, optional):
  - `min` (number): Minimum allowed value
  - `max` (number): Maximum allowed value

**Behavior:**

- Same as `parseIntEnv`, but parses floating-point numbers

**Example:**

```typescript
const cpuCores = parseFloatEnv('CONTAINER_CPU_CORES', 1.0, { min: 0.1, max: 8.0 });
```

## Valid Configuration Ranges

### Shared Package (`packages/shared/src/utils/constants.ts`)

#### Container Resource Limits

- **CONTAINER_MEMORY_LIMIT_MB**
  - Default: `512` MB
  - Range: `64` MB - `8192` MB (8 GB)
  - Description: Maximum memory allocation per container

- **CONTAINER_CPU_CORES**
  - Default: `1.0` cores
  - Range: `0.1` - `8.0` cores
  - Description: CPU cores allocation per container

#### Lock Configuration

- **STATUS_LOCK_TTL_MS**
  - Default: `10000` ms (10 seconds)
  - Range: `1000` ms (1 second) - `60000` ms (1 minute)
  - Description: Time-to-live for status locks

- **LOCK_RETRY_DELAY_MS**
  - Default: `200` ms
  - Range: `50` ms - `5000` ms
  - Description: Delay between lock retry attempts

- **LOCK_RETRY_JITTER_MS**
  - Default: `100` ms
  - Range: `0` ms - `1000` ms
  - Description: Random jitter added to retry delays

### API Service (`apps/api/src/config/constants.ts`)

#### Time Intervals

- **METRICS_UPDATE_INTERVAL_MS**
  - Default: `5000` ms (5 seconds)
  - Range: `1000` ms (1 second) - `60000` ms (1 minute)
  - Description: Interval for updating metrics

- **STATUS_RECONCILIATION_INTERVAL_MS**
  - Default: `30000` ms (30 seconds)
  - Range: `5000` ms (5 seconds) - `300000` ms (5 minutes)
  - Description: Interval for reconciling service statuses

- **STATUS_LOCK_TTL_MS**
  - Default: `10000` ms (10 seconds)
  - Range: `1000` ms (1 second) - `60000` ms (1 minute)
  - Description: Time-to-live for status locks

- **STATUS_RECONCILIATION_LOCK_TTL_MS**
  - Default: `5000` ms (5 seconds)
  - Range: `1000` ms (1 second) - `30000` ms (30 seconds)
  - Description: Time-to-live for reconciliation locks

- **CONNECTION_TIMEOUT_MS**
  - Default: `1800000` ms (30 minutes)
  - Range: `60000` ms (1 minute) - `7200000` ms (2 hours)
  - Description: Maximum connection timeout duration

#### Lock Configuration

- **LOCK_RETRY_DELAY_MS**
  - Default: `200` ms
  - Range: `50` ms - `5000` ms
  - Description: Delay between lock retry attempts

- **LOCK_RETRY_JITTER_MS**
  - Default: `100` ms
  - Range: `0` ms - `1000` ms
  - Description: Random jitter added to retry delays

#### Body Size Limits

- **BODY_LIMIT_GLOBAL**
  - Default: `10` MB
  - Range: `1` MB - `100` MB
  - Description: Maximum request body size for global endpoints

- **BODY_LIMIT_STANDARD**
  - Default: `1` MB
  - Range: `0.1` MB - `10` MB
  - Description: Maximum request body size for standard endpoints

- **BODY_LIMIT_SMALL**
  - Default: `100` KB
  - Range: `10` KB - `1024` KB (1 MB)
  - Description: Maximum request body size for small payload endpoints

### Worker Service (`apps/worker/src/config/constants.ts`)

#### Log Configuration

- **MAX_LOG_SIZE_CHARS**
  - Default: `50000` characters
  - Range: `1000` - `1000000` characters
  - Description: Maximum log size before truncation

#### Lock Configuration

- **STATUS_LOCK_TTL_MS**
  - Default: `10000` ms (10 seconds)
  - Range: `1000` ms (1 second) - `60000` ms (1 minute)
  - Description: Time-to-live for status locks

- **LOCK_RETRY_DELAY_MS**
  - Default: `200` ms
  - Range: `50` ms - `5000` ms
  - Description: Delay between lock retry attempts

- **LOCK_RETRY_JITTER_MS**
  - Default: `100` ms
  - Range: `0` ms - `1000` ms
  - Description: Random jitter added to retry delays

#### Health Check

- **WORKER_HEALTH_PORT**
  - Default: `3003`
  - Range: `1024` - `65535`
  - Description: Port for worker health check server

#### Docker Image Cleanup

- **IMAGE_RETENTION_DAYS**
  - Default: `7` days
  - Range: `1` - `90` days
  - Description: Number of days to retain Docker images

- **DISK_USAGE_THRESHOLD_PERCENT**
  - Default: `80`%
  - Range: `50`% - `95`%
  - Description: Disk usage threshold that triggers cleanup

## Error Handling

The configuration parser handles the following error cases:

1. **Missing Environment Variable**: Uses the default value without logging a warning
2. **Invalid Value (NaN)**: Logs a warning and uses the default value
3. **Below Minimum**: Logs a warning and uses the minimum value
4. **Above Maximum**: Logs a warning and uses the maximum value
5. **Empty String**: Logs a warning and uses the default value

### Warning Format

Warnings are logged to the console in the following format:

```
[Config] Invalid VARIABLE_NAME value 'invalid-value', using default 100
[Config] VARIABLE_NAME value 50 below minimum 64, using 64
[Config] VARIABLE_NAME value 10000 above maximum 8192, using 8192
```

## Best Practices

1. **Always provide sensible defaults**: The default value should be safe for production use
2. **Set appropriate ranges**: Ranges should prevent misconfiguration while allowing flexibility
3. **Document your ranges**: Include comments explaining the reasoning behind min/max values
4. **Monitor warnings**: Set up logging/monitoring to detect configuration issues in production
5. **Test edge cases**: Ensure your application handles the minimum and maximum values correctly

## Testing

The configuration parser includes comprehensive tests covering:

- Default behavior (missing environment variables)
- Valid value parsing (integers, floats, negative numbers, zero)
- Invalid value handling (NaN, empty strings, special characters)
- Range validation (below minimum, above maximum, within range, at boundaries)
- Edge cases (large numbers, scientific notation, whitespace)

Run tests with:

```bash
pnpm --filter shared test
```
