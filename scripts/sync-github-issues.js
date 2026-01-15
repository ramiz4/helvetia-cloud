#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * GITHUB ISSUE SYNCHRONIZER
 *
 * A consolidated, production-grade script to synchronize findings from github_issues.json
 * to GitHub using the 'gh' CLI.
 *
 * Authentication:
 * - Set GH_TOKEN or GITHUB_TOKEN environment variable, OR
 * - Run 'gh auth login' to authenticate interactively
 *
 * Workflow:
 * 1. Parse github_issues.json into structured data.
 * 2. Setup/Sync necessary labels in the repository.
 * 3. Fetch existing issues to avoid duplicates.
 * 4. Create missing issues with full traceability.
 * 5. Cleanup any accidental manual duplicates.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// --- Authentication ---

/**
 * Get the GitHub token from environment variables.
 * The gh CLI automatically uses GH_TOKEN or GITHUB_TOKEN if set in the environment.
 * This function is used to detect which authentication method is being used.
 * @see https://cli.github.com/manual/gh_help_environment
 */
function getGitHubToken() {
  return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || null;
}

// --- Configuration & Constants ---

const PATHS = {
  JSON_SOURCE: path.join(__dirname, '..', 'github_issues.json'),
};

const LABEL_COLORS = {
  // Priorities
  P0: 'd73a4a',
  P1: 'ff9933',
  P2: 'fbca04',
  P3: '0e8a16',
  // Types
  security: '8b0000',
  bug: 'd73a4a',
  enhancement: 'a2eeef',
  critical: 'd73a4a',
  refactoring: '7057ff',
  // Categories
  api: '1d76db',
  worker: '5319e7',
  dashboard: '006b75',
  infrastructure: 'c5def5',
  database: 'bfd4f2',
  // Additional specialized labels
  maintainability: '3e4b9e',
  observability: '5319e7',
  testing: 'e99695',
  quality: '0e8a16',
  configuration: 'bfd4f2',
  deployment: 'c2e0c6',
  frontend: 'a2eeef',
  monitoring: '006b75',
  'type-safety': '1d76db',
  ux: 'f9d0c4',
  accessibility: 'f9d0c4',
  a11y: 'f9d0c4',
  'di-migration': 'bfd4f2',
  dx: 'f9d0c4',
  'resource-management': 'c5def5',
  reliability: 'd1d1d1',
  architecture: 'ffffff',
  concurrency: '444444',
  'data-loss': 'd73a4a',
  performance: 'fbca04',
  // Fallback
  default: 'aaaaaa',
};

// --- Utilities ---

const log = {
  info: (msg) => console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  step: (msg) => console.log(`\n\x1b[1m\x1b[35m=== ${msg} ===\x1b[0m`),
};

/**
 * Execute a GitHub CLI command safely.
 */
function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(
      result.stderr || `Command 'gh ${args.join(' ')}' failed with exit code ${result.status}`,
    );
  }
  return result.stdout.trim();
}

// --- Core Modules ---

const Parser = {
  /**
   * Parses github_issues.json and returns an array of issue objects.
   */
  parse() {
    log.step('Parsing github_issues.json');

    if (!fs.existsSync(PATHS.JSON_SOURCE)) {
      throw new Error(`Source file not found at ${PATHS.JSON_SOURCE}`);
    }

    const content = fs.readFileSync(PATHS.JSON_SOURCE, 'utf8');
    let issues;
    try {
      issues = JSON.parse(content);
    } catch (e) {
      throw new Error(`Failed to parse JSON: ${e.message}`);
    }

    log.info(`Loaded ${issues.length} issues from JSON.`);
    return issues;
  },
};

const LabelManager = {
  /**
   * Ensures all labels required by the issues exist in GitHub.
   */
  sync(issues) {
    log.step('Synchronizing Labels');

    const requiredLabels = new Set();
    issues.forEach((issue) => issue.labels.forEach((l) => requiredLabels.add(l)));

    log.info(`Checking ${requiredLabels.size} unique labels...`);

    // Fetch existing labels to skip unnecessary updates
    let existingLabels = [];
    try {
      const rawLabels = gh(['label', 'list', '--limit', '1000', '--json', 'name,color']);
      existingLabels = JSON.parse(rawLabels);
    } catch (e) {
      log.warn(`Could not fetch existing labels: ${e.message}. Proceeding with fallback.`);
    }

    const existingMap = new Map(existingLabels.map((l) => [l.name, l.color.toLowerCase()]));
    let syncCount = 0;

    for (const name of requiredLabels) {
      const targetColor = (LABEL_COLORS[name] || LABEL_COLORS.default).toLowerCase();
      const existingColor = existingMap.get(name);

      if (existingColor === targetColor) {
        continue;
      }

      try {
        gh(['label', 'create', name, '--color', targetColor, '--force']);
        log.info(`Label ensured: ${name} (${existingColor ? 'color update' : 'new'})`);
        syncCount++;
      } catch (e) {
        log.warn(`Could not sync label '${name}': ${e.message}`);
      }
    }

    log.success(`Label synchronization complete. ${syncCount} labels updated/created.`);
  },
};

const Synchronizer = {
  /**
   * Fetch current state, create missing issues, and deduplicate.
   */
  async run(targetIssues) {
    log.step('Synchronizing Issues');

    // 1. Fetch current state
    log.info('Fetching existing issues from GitHub...');
    const rawExisting = gh([
      'issue',
      'list',
      '--state',
      'all',
      '--limit',
      '1000',
      '--json',
      'number,title,state,url',
    ]);
    const existingIssues = JSON.parse(rawExisting);

    const existingTitles = new Map();
    existingIssues.forEach((i) => {
      if (!existingTitles.has(i.title)) existingTitles.set(i.title, []);
      existingTitles.get(i.title).push(i);
    });

    // 2. Create missing issues
    let createdCount = 0;
    for (const issue of targetIssues) {
      if (issue.synced) continue;

      const matches = existingTitles.get(issue.title) || [];
      const hasOpenIssue = matches.some((m) => m.state === 'OPEN');

      if (hasOpenIssue) {
        log.info(`Skipping existing (OPEN): ${issue.title}`);
        continue;
      }

      try {
        log.info(`Creating: ${issue.title}`);

        const url = gh([
          'issue',
          'create',
          '--title',
          issue.title,
          '--body',
          issue.body,
          '--label',
          issue.labels.join(','),
        ]);

        log.success(`Created: ${url}`);

        // Update local cache with new open issue
        const newNumber = parseInt(url.split('/').pop());
        if (!existingTitles.has(issue.title)) existingTitles.set(issue.title, []);
        existingTitles
          .get(issue.title)
          .push({ number: newNumber, title: issue.title, state: 'OPEN' });

        createdCount++;

        // Rate limit friendliness
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        log.error(`Failed to create '${issue.title}': ${e.message}`);
      }
    }

    // 3. Deduplicate
    log.step('Checking for duplicates');
    let deletedCount = 0;
    for (const [title, matches] of existingTitles.entries()) {
      const openMatches = matches.filter((m) => m.state === 'OPEN');

      if (openMatches.length > 1) {
        openMatches.sort((a, b) => a.number - b.number);
        const keep = openMatches[0];
        const duplicates = openMatches.slice(1);

        log.warn(
          `Found duplicates for "${title}". Keeping #${keep.number}, deleting ${duplicates.map((d) => '#' + d.number).join(', ')}`,
        );

        for (const dup of duplicates) {
          try {
            gh(['issue', 'delete', dup.number.toString(), '--yes']);
            log.info(`Deleted duplicate #${dup.number}`);
            deletedCount++;
          } catch (e) {
            log.error(`Failed to delete #${dup.number}: ${e.message}`);
          }
        }
      }
    }

    log.step('Sync Summary');
    log.success(`Total Created: ${createdCount}`);
    log.success(`Total Duplicates Removed: ${deletedCount}`);

    // 4. Sync state back to JSON
    log.step('Updating github_issues.json');
    let updatedCount = 0;

    for (const issue of targetIssues) {
      const matches = existingTitles.get(issue.title) || [];
      let bestMatch = null;

      const openMatches = matches.filter((m) => m.state === 'OPEN');
      const closedMatches = matches.filter((m) => m.state === 'CLOSED');

      if (openMatches.length > 0) {
        // Pick oldest open issue (consistent with deduplication)
        openMatches.sort((a, b) => a.number - b.number);
        bestMatch = openMatches[0];
      } else if (closedMatches.length > 0) {
        // Pick newest closed issue
        closedMatches.sort((a, b) => b.number - a.number);
        bestMatch = closedMatches[0];
      }

      if (bestMatch) {
        issue.number = bestMatch.number;
        issue.state = bestMatch.state;
        issue.url = bestMatch.url;
        issue.synced = true;
        updatedCount++;
      }
    }

    fs.writeFileSync(PATHS.JSON_SOURCE, JSON.stringify(targetIssues, null, 2));
    log.success(`Updated ${updatedCount} issues in ${PATHS.JSON_SOURCE}`);
    log.success(`Total Local JSON Updates: ${updatedCount}`);
  },
};

// --- Execution Entry Point ---

async function main() {
  try {
    // Check for token-based authentication first
    const token = getGitHubToken();

    if (token) {
      log.info('Using token from GH_TOKEN or GITHUB_TOKEN environment variable.');
      // Validate token works by checking auth status
      // gh CLI automatically uses GH_TOKEN/GITHUB_TOKEN when set
      try {
        gh(['auth', 'status']);
      } catch {
        log.error('Token validation failed. Please check your GH_TOKEN or GITHUB_TOKEN is valid.');
        process.exit(1);
      }
    } else {
      // Fallback to checking gh auth status for interactive login
      try {
        gh(['auth', 'status']);
        log.info('Using existing gh CLI authentication.');
      } catch {
        log.error('GitHub CLI not authenticated.');
        log.error('');
        log.error('Please authenticate using one of the following methods:');
        log.error('  1. Set GH_TOKEN or GITHUB_TOKEN environment variable:');
        log.error('     export GH_TOKEN=ghp_your_token_here');
        log.error('     node scripts/sync-github-issues.js');
        log.error('');
        log.error('  2. Or run "gh auth login" to authenticate interactively.');
        process.exit(1);
      }
    }

    const issues = Parser.parse();
    LabelManager.sync(issues);
    await Synchronizer.run(issues);

    log.step('All operations completed successfully.');
  } catch (error) {
    log.error(`Fatal error during synchronization: ${error.message}`);
    process.exit(1);
  }
}

main();
