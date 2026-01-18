import { prisma } from 'database';
import 'reflect-metadata';
import { PrismaPrivacyPolicyRepository } from '../repositories/PrismaPrivacyPolicyRepository';
import { PrivacyPolicyService } from '../services/PrivacyPolicyService';

/**
 * Initialize Privacy Policy
 * This script loads the Privacy Policy markdown files into the database.
 */

async function initializePrivacy() {
  console.log('🔧 Initializing Privacy Policy...');

  try {
    // Create repository and service instances
    const privacyRepository = new PrismaPrivacyPolicyRepository(prisma);
    const privacyService = new PrivacyPolicyService(privacyRepository);

    // Initialize version 1.0.0
    const version = '1.0.0';
    const effectiveAt = new Date('2026-01-18T00:00:00Z');

    console.log(`📄 Loading Privacy Policy version ${version}...`);

    await privacyService.initializePrivacyPolicyFromFiles(version, effectiveAt);

    console.log('✅ Privacy Policy initialized successfully!');
    console.log(`   Version: ${version}`);
    console.log(`   Effective Date: ${effectiveAt.toISOString()}`);
    console.log(`   Languages: EN, DE, FR, IT, GSW`);
  } catch (error) {
    console.error('❌ Failed to initialize Privacy Policy:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializePrivacy()
  .then(() => {
    console.log('\n🎉 Initialization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Initialization failed:', error);
    process.exit(1);
  });
