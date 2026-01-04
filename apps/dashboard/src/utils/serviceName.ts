/**
 * Sanitizes a repository name to create a valid DNS-compliant service name.
 * 
 * DNS-compliant rules:
 * - Must contain only lowercase alphanumeric characters and hyphens
 * - Must start and end with an alphanumeric character
 * - Cannot contain consecutive hyphens
 * - Must be between 1 and 63 characters
 * 
 * @param repoName - The repository name to sanitize
 * @returns A DNS-compliant service name, or empty string if input is empty
 * 
 * @example
 * sanitizeServiceName('my___repo')     // 'my-repo'
 * sanitizeServiceName('_myrepo_')      // 'myrepo'
 * sanitizeServiceName('___')           // 'service' (fallback)
 * sanitizeServiceName('')              // '' (empty input)
 */
export function sanitizeServiceName(repoName: string): string {
  if (!repoName) {
    return '';
  }

  // Convert to lowercase and replace non-alphanumeric characters with hyphens
  let sanitized = repoName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');

  // Remove consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');

  // Remove leading and trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Ensure it's not empty after sanitization (e.g., input was all special chars)
  if (!sanitized) {
    return 'service';
  }

  // Truncate to 63 characters (DNS label limit)
  if (sanitized.length > 63) {
    sanitized = sanitized.substring(0, 63);
    // Ensure we didn't truncate in the middle of removing a trailing hyphen
    sanitized = sanitized.replace(/-+$/, '');
  }

  return sanitized;
}
