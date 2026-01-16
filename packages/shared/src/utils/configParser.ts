/**
 * Safe environment variable parsing utilities
 * Handles invalid values gracefully and provides range validation
 */

interface ParseOptions {
  min?: number;
  max?: number;
}

/**
 * Safely parse an integer environment variable with range validation
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 * @param options - Optional min/max range validation
 * @returns Parsed and validated integer value
 */
export function parseIntEnv(
  name: string,
  defaultValue: number,
  options: ParseOptions = {},
): number {
  const raw = process.env[name];

  // Use default if not set
  if (raw === undefined) {
    return defaultValue;
  }

  // Warn and use default for empty string
  if (raw.trim() === '') {
    console.warn(`[Config] Invalid ${name} value '${raw}', using default ${defaultValue}`);
    return defaultValue;
  }

  // Parse the value
  const parsed = parseInt(raw, 10);

  // Handle NaN
  if (isNaN(parsed)) {
    console.warn(`[Config] Invalid ${name} value '${raw}', using default ${defaultValue}`);
    return defaultValue;
  }

  // Validate minimum
  if (options.min !== undefined && parsed < options.min) {
    console.warn(
      `[Config] ${name} value ${parsed} below minimum ${options.min}, using ${options.min}`,
    );
    return options.min;
  }

  // Validate maximum
  if (options.max !== undefined && parsed > options.max) {
    console.warn(
      `[Config] ${name} value ${parsed} above maximum ${options.max}, using ${options.max}`,
    );
    return options.max;
  }

  return parsed;
}

/**
 * Safely parse a float environment variable with range validation
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 * @param options - Optional min/max range validation
 * @returns Parsed and validated float value
 */
export function parseFloatEnv(
  name: string,
  defaultValue: number,
  options: ParseOptions = {},
): number {
  const raw = process.env[name];

  // Use default if not set
  if (raw === undefined) {
    return defaultValue;
  }

  // Warn and use default for empty string
  if (raw.trim() === '') {
    console.warn(`[Config] Invalid ${name} value '${raw}', using default ${defaultValue}`);
    return defaultValue;
  }

  // Parse the value
  const parsed = parseFloat(raw);

  // Handle NaN
  if (isNaN(parsed)) {
    console.warn(`[Config] Invalid ${name} value '${raw}', using default ${defaultValue}`);
    return defaultValue;
  }

  // Validate minimum
  if (options.min !== undefined && parsed < options.min) {
    console.warn(
      `[Config] ${name} value ${parsed} below minimum ${options.min}, using ${options.min}`,
    );
    return options.min;
  }

  // Validate maximum
  if (options.max !== undefined && parsed > options.max) {
    console.warn(
      `[Config] ${name} value ${parsed} above maximum ${options.max}, using ${options.max}`,
    );
    return options.max;
  }

  return parsed;
}

/**
 * Safely parse a string environment variable with validation
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 * @param options - Optional validation options
 * @returns Parsed and validated string value
 */
export function parseStringEnv(
  name: string,
  defaultValue: string,
  options: { validate?: (value: string) => boolean; errorMessage?: string } = {},
): string {
  const raw = process.env[name];

  // Use default if not set
  if (raw === undefined) {
    return defaultValue;
  }

  // Warn and use default for empty string
  if (raw.trim() === '') {
    console.warn(`[Config] Invalid ${name} value (empty string), using default ${defaultValue}`);
    return defaultValue;
  }

  // Validate if validator provided
  if (options.validate && !options.validate(raw)) {
    console.warn(
      `[Config] Invalid ${name} value '${raw}': ${options.errorMessage || 'validation failed'}, using default ${defaultValue}`,
    );
    return defaultValue;
  }

  return raw;
}
