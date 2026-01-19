import { prisma } from 'database';
import 'reflect-metadata';
import { PrismaTermsRepository } from '../repositories/PrismaTermsRepository.js';
import { TermsService } from '../services/TermsService.js';

/**
 * Initialize Terms of Service
 * This script loads the Terms of Service markdown files into the database.
 * It should be run once during initial deployment or whenever new terms versions are added.
 *
 * Usage:
 *   pnpm tsx src/scripts/init-terms.ts
 *
 * Environment variables required:
 *   DATABASE_URL - PostgreSQL connection string
 */

async function initializeTerms() {
  console.log('🔧 Initializing Terms of Service...');

  try {
    // Create repository and service instances
    const termsRepository = new PrismaTermsRepository(prisma);
    const termsService = new TermsService(termsRepository);

    // Initialize terms version 1.0.0
    const version = '1.0.0';
    const effectiveAt = new Date('2026-01-18T00:00:00Z');

    console.log(`📄 Loading Terms of Service version ${version}...`);

    await termsService.initializeTermsFromFiles(version, effectiveAt);

    console.log('✅ Terms of Service initialized successfully!');
    console.log(`   Version: ${version}`);
    console.log(`   Effective Date: ${effectiveAt.toISOString()}`);
    console.log(`   Languages: EN, DE, FR, IT`);
  } catch (error) {
    console.error('❌ Failed to initialize Terms of Service:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeTerms()
  .then(() => {
    console.log('\n🎉 Initialization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Initialization failed:', error);
    process.exit(1);
  });
