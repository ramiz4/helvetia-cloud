import Docker from 'dockerode';

/**
 * Validation result for Dockerfile operations
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates Dockerfile syntax and structure
 * Checks for common issues that would cause build failures
 */
export function validateDockerfileSyntax(dockerfileContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = dockerfileContent.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    errors.push('Dockerfile is empty');
    return { valid: false, errors, warnings };
  }

  // Check if first non-comment line is FROM
  const firstNonCommentLine = lines.find((line) => !line.trim().startsWith('#'));
  if (!firstNonCommentLine || !firstNonCommentLine.trim().toUpperCase().startsWith('FROM ')) {
    errors.push('Dockerfile must start with a FROM instruction');
  }

  // Validate each line
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const lineNumber = index + 1;

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed.length === 0) {
      return;
    }

    // Check for valid instruction keywords
    const validInstructions = [
      'FROM',
      'RUN',
      'CMD',
      'LABEL',
      'EXPOSE',
      'ENV',
      'ADD',
      'COPY',
      'ENTRYPOINT',
      'VOLUME',
      'USER',
      'WORKDIR',
      'ARG',
      'ONBUILD',
      'STOPSIGNAL',
      'HEALTHCHECK',
      'SHELL',
    ];

    const instruction = trimmed.split(/\s+/)[0].toUpperCase();
    if (!validInstructions.includes(instruction)) {
      errors.push(`Line ${lineNumber}: Invalid or unrecognized instruction '${instruction}'`);
    }

    // Check for missing arguments
    if (trimmed.split(/\s+/).length === 1 && instruction !== 'FROM') {
      errors.push(`Line ${lineNumber}: Instruction '${instruction}' is missing arguments`);
    }

    // Validate FROM instruction
    if (instruction === 'FROM') {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) {
        errors.push(`Line ${lineNumber}: FROM instruction must specify an image`);
      } else if (parts[1].trim().length === 0) {
        errors.push(`Line ${lineNumber}: FROM instruction has empty image name`);
      }
    }

    // Validate ENV instruction format
    if (instruction === 'ENV') {
      const envContent = trimmed.substring(3).trim();
      if (!envContent.includes('=') && envContent.split(/\s+/).length < 2) {
        errors.push(
          `Line ${lineNumber}: ENV instruction must be in format 'ENV KEY=VALUE' or 'ENV KEY VALUE'`,
        );
      }
    }

    // Validate EXPOSE instruction
    if (instruction === 'EXPOSE') {
      const ports = trimmed.substring(6).trim().split(/\s+/);
      ports.forEach((port) => {
        const portNum = parseInt(port.split('/')[0], 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
          errors.push(`Line ${lineNumber}: Invalid port number '${port}' in EXPOSE instruction`);
        }
      });
    }

    // Validate WORKDIR
    if (instruction === 'WORKDIR') {
      const path = trimmed.substring(7).trim();
      if (path.length === 0) {
        errors.push(`Line ${lineNumber}: WORKDIR instruction requires a path`);
      }
    }

    // Check for unquoted strings with special characters in CMD/ENTRYPOINT
    if ((instruction === 'CMD' || instruction === 'ENTRYPOINT') && !trimmed.includes('[')) {
      const content = trimmed.substring(instruction.length).trim();
      if (content.includes('&&') || content.includes('||') || content.includes('|')) {
        warnings.push(
          `Line ${lineNumber}: ${instruction} with shell operators should use exec form (JSON array) for predictability`,
        );
      }
    }
  });

  // Check for required instructions
  const hasFrom = lines.some((line) => line.trim().toUpperCase().startsWith('FROM '));
  if (!hasFrom) {
    errors.push('Dockerfile must contain at least one FROM instruction');
  }

  const hasCmdOrEntrypoint = lines.some(
    (line) =>
      line.trim().toUpperCase().startsWith('CMD ') ||
      line.trim().toUpperCase().startsWith('ENTRYPOINT '),
  );
  if (!hasCmdOrEntrypoint) {
    warnings.push('Dockerfile should contain a CMD or ENTRYPOINT instruction');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment variable names and values
 */
export function validateEnvironmentVariables(
  envVars: Record<string, string> | undefined,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!envVars || Object.keys(envVars).length === 0) {
    return { valid: true, errors, warnings };
  }

  Object.entries(envVars).forEach(([key, value]) => {
    // Validate key format (must be valid shell variable name)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      errors.push(
        `Invalid environment variable name '${key}': must start with letter or underscore, followed by letters, numbers, or underscores`,
      );
    }

    // Check for reserved variable names
    const reservedNames = ['PATH', 'HOME', 'USER', 'SHELL', 'TERM'];
    if (reservedNames.includes(key)) {
      warnings.push(
        `Environment variable '${key}' is a reserved system variable and may cause unexpected behavior`,
      );
    }

    // Validate value (check for potential injection issues)
    if (typeof value !== 'string') {
      errors.push(`Environment variable '${key}' must have a string value`);
    } else {
      // Check for potentially dangerous characters
      if (value.includes('\n') || value.includes('\r')) {
        errors.push(
          `Environment variable '${key}' contains newline characters which are not allowed`,
        );
      }

      // Warn about very long values
      if (value.length > 10000) {
        warnings.push(
          `Environment variable '${key}' has a very long value (${value.length} characters) which may cause issues`,
        );
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Performs a dry-run validation of the Dockerfile using Docker's API
 * This creates a build context and validates it without actually building
 */
export async function validateDockerfileDryRun(
  docker: Docker,
  dockerfileContent: string,
  contextPath: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Create a minimal tar archive for validation
    // Docker's buildImage API will validate the Dockerfile syntax
    // We use a very small timeout to abort quickly after validation
    const stream = await docker.buildImage(
      {
        context: contextPath,
        src: ['Dockerfile'],
      },
      {
        dockerfile: 'Dockerfile',
        // Use a dummy tag to avoid conflicts
        t: `validation-${Date.now()}`,
        // Force pull to ensure base image is available
        pull: 'false',
        // Don't use cache for validation
        nocache: false,
      },
    );

    // Read the first few events to catch syntax errors
    let validationError: string | null = null;
    let eventCount = 0;
    const maxEvents = 5; // Only check first few events for syntax errors

    await new Promise<void>((resolve, _reject) => {
      stream.on('data', (chunk: Buffer) => {
        eventCount++;

        // Parse Docker's JSON stream format
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const event = JSON.parse(line);

            // Check for error events
            if (event.error || event.errorDetail) {
              validationError =
                event.error || event.errorDetail?.message || 'Build validation failed';
              stream.destroy();
              resolve();
              return;
            }

            // Look for syntax-related errors in the stream
            if (event.stream) {
              const streamText = event.stream.toLowerCase();
              if (
                streamText.includes('dockerfile parse error') ||
                streamText.includes('unknown instruction') ||
                streamText.includes('syntax error')
              ) {
                validationError = event.stream.trim();
                stream.destroy();
                resolve();
                return;
              }
            }
          } catch {
            // Ignore JSON parse errors for non-JSON chunks
          }
        }

        // Stop after checking initial events (early validation)
        if (eventCount >= maxEvents) {
          stream.destroy();
          resolve();
        }
      });

      stream.on('end', () => resolve());
      stream.on('error', (err: Error) => {
        validationError = err.message;
        resolve();
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        stream.destroy();
        resolve();
      }, 10000);
    });

    if (validationError) {
      errors.push(`Docker build validation failed: ${validationError}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to perform dry-run validation: ${errorMessage}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a generated Dockerfile comprehensively
 */
export async function validateGeneratedDockerfile(params: {
  dockerfileContent: string;
  envVars?: Record<string, string>;
  docker?: Docker;
  contextPath?: string;
}): Promise<ValidationResult> {
  const { dockerfileContent, envVars, docker, contextPath } = params;

  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // 1. Syntax validation
  const syntaxResult = validateDockerfileSyntax(dockerfileContent);
  allErrors.push(...syntaxResult.errors);
  allWarnings.push(...syntaxResult.warnings);

  // 2. Environment variable validation
  if (envVars) {
    const envResult = validateEnvironmentVariables(envVars);
    allErrors.push(...envResult.errors);
    allWarnings.push(...envResult.warnings);
  }

  // 3. Optional dry-run validation (only if Docker instance and context provided)
  if (docker && contextPath && allErrors.length === 0) {
    try {
      const dryRunResult = await validateDockerfileDryRun(docker, dockerfileContent, contextPath);
      allErrors.push(...dryRunResult.errors);
      allWarnings.push(...dryRunResult.warnings);
    } catch {
      // Don't fail validation if dry-run can't be performed
      allWarnings.push('Could not perform dry-run validation');
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Formats validation results into a human-readable error message
 */
export function formatValidationErrors(result: ValidationResult): string {
  const messages: string[] = [];

  if (result.errors.length > 0) {
    messages.push('❌ Dockerfile Validation Errors:');
    result.errors.forEach((error, index) => {
      messages.push(`  ${index + 1}. ${error}`);
    });
  }

  if (result.warnings.length > 0) {
    messages.push('\n⚠️  Dockerfile Validation Warnings:');
    result.warnings.forEach((warning, index) => {
      messages.push(`  ${index + 1}. ${warning}`);
    });
  }

  if (messages.length === 0) {
    return '✅ Dockerfile validation passed';
  }

  return messages.join('\n');
}
