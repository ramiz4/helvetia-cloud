#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * GITHUB ISSUE SYNCHRONIZER
 *
 * A consolidated, production-grade script to synchronize findings from GITHUB_ISSUES.md
 * to GitHub using the 'gh' CLI.
 *
 * Workflow:
 * 1. Parse GITHUB_ISSUES.md into structured data.
 * 2. Setup/Sync necessary labels in the repository.
 * 3. Fetch existing issues to avoid duplicates.
 * 4. Create missing issues with full traceability.
 * 5. Cleanup any accidental manual duplicates.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

    for (const name of requiredLabels) {
      const color = LABEL_COLORS[name] || LABEL_COLORS.default;
      try {
        gh(['label', 'create', name, '--color', color, '--force']);
        log.info(`Label ensured: ${name}`);
      } catch (e) {
        log.warn(`Could not sync label '${name}': ${e.message}`);
      }
    }
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
    // Preliminary check for GH CLI
    try {
      gh(['auth', 'status']);
    } catch {
      log.error('GitHub CLI not authenticated. Please run "gh auth login" first.');
      process.exit(1);
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
