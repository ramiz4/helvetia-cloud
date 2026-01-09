/**
 * Normalizes a repository URL by trimming whitespace and removing .git suffix
 * @param url - The repository URL to normalize
 * @returns The normalized URL without .git suffix
 */
export function normalizeRepoUrl(url: string): string {
  if (!url) {
    return '';
  }

  return url.trim().replace(/\.git$/, '');
}

/**
 * Generates Prisma query condition for matching repo URLs
 * Handles both with and without .git suffix
 * @param repoUrl - The repository URL to match
 * @returns Prisma OR condition for exact matching
 */
export function getRepoUrlMatchCondition(repoUrl: string) {
  const normalized = normalizeRepoUrl(repoUrl);

  if (!normalized) {
    // If empty, return a condition that matches nothing
    return { repoUrl: null };
  }

  return {
    OR: [{ repoUrl: normalized }, { repoUrl: `${normalized}.git` }],
  };
}
