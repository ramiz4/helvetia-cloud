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
 * @returns A DNS-compliant service name
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

  // Ensure it's not empty after sanitization
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
