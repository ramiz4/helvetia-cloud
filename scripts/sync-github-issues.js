#!/usr/bin/env node

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
  MARKDOWN_SOURCE: path.join(__dirname, '..', 'GITHUB_ISSUES.md'),
  TEMPORARY_BODY: path.join(__dirname, '..', '.temp_issue_body.md'),
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
   * Parses GITHUB_ISSUES.md and returns an array of issue objects.
   */
  parse() {
    log.step('Parsing GITHUB_ISSUES.md');

    if (!fs.existsSync(PATHS.MARKDOWN_SOURCE)) {
      throw new Error(`Source file not found at ${PATHS.MARKDOWN_SOURCE}`);
    }

    const content = fs.readFileSync(PATHS.MARKDOWN_SOURCE, 'utf8');
    const sections = content.split('---');
    const issues = [];

    for (const section of sections) {
      const titleMatch = section.match(/### Issue \d+: (.*)/);
      if (!titleMatch) continue;

      const title = titleMatch[1].trim();

      // Extract Labels
      const labelsMatch = section.match(/\*\*Labels:\*\* (.*)/);
      const labels = labelsMatch ? [...labelsMatch[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]) : [];

      // Extract Body (content after the "Description:" or "Labels:" header)
      let body = '';
      const bodySplit = section.split(/\*\*Description:\*\*/);
      if (bodySplit.length > 1) {
        body = bodySplit[1].trim();
      } else {
        const fallbackSplit = section.split(/\*\*Labels:\*\*/);
        if (fallbackSplit.length > 1) {
          body = fallbackSplit[1].replace(/`[^`]+`(,\s*`[^`]+`)*/, '').trim();
        }
      }

      issues.push({ title, labels, body });
    }

    log.info(`Extracted ${issues.length} issues from markdown.`);
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
      'number,title',
    ]);
    const existingIssues = JSON.parse(rawExisting);

    const existingTitles = new Map();
    existingIssues.forEach((i) => {
      if (!existingTitles.has(i.title)) existingTitles.set(i.title, []);
      existingTitles.get(i.title).push(i.number);
    });

    // 2. Create missing issues
    let createdCount = 0;
    for (const issue of targetIssues) {
      if (existingTitles.has(issue.title)) {
        log.info(`Skipping existing: ${issue.title}`);
        continue;
      }

      try {
        log.info(`Creating: ${issue.title}`);
        fs.writeFileSync(PATHS.TEMPORARY_BODY, issue.body);

        const url = gh([
          'issue',
          'create',
          '--title',
          issue.title,
          '--body-file',
          PATHS.TEMPORARY_BODY,
          '--label',
          issue.labels.join(','),
        ]);

        log.success(`Created: ${url}`);
        existingTitles.set(issue.title, [url.split('/').pop()]); // Update local cache
        createdCount++;

        // Rate limit friendliness
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        log.error(`Failed to create '${issue.title}': ${e.message}`);
      } finally {
        if (fs.existsSync(PATHS.TEMPORARY_BODY)) fs.unlinkSync(PATHS.TEMPORARY_BODY);
      }
    }

    // 3. Deduplicate
    log.step('Checking for duplicates');
    let deletedCount = 0;
    for (const [title, numbers] of existingTitles.entries()) {
      if (numbers.length > 1) {
        numbers.sort((a, b) => parseInt(a) - parseInt(b));
        const keep = numbers[0];
        const duplicates = numbers.slice(1);

        log.warn(
          `Found duplicates for "${title}". Keeping #${keep}, deleting ${duplicates.join(', ')}`,
        );

        for (const num of duplicates) {
          try {
            gh(['issue', 'delete', num.toString(), '--yes']);
            log.info(`Deleted duplicate #${num}`);
            deletedCount++;
          } catch (e) {
            log.error(`Failed to delete #${num}: ${e.message}`);
          }
        }
      }
    }

    log.step('Sync Summary');
    log.success(`Total Created: ${createdCount}`);
    log.success(`Total Duplicates Removed: ${deletedCount}`);
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
