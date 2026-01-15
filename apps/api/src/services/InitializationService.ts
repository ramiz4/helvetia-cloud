import { Role } from 'database';
import { inject, injectable } from 'tsyringe';
import { env } from '../config/env';
import { TOKENS } from '../di/tokens';
import type { IFeatureFlagRepository, IUserRepository } from '../interfaces';
import { hashPassword, isLegacyHash } from '../utils/password';

@injectable()
export class InitializationService {
  constructor(
    @inject(TOKENS.UserRepository)
    private userRepository: IUserRepository,
    @inject(TOKENS.FeatureFlagRepository)
    private featureFlagRepository: IFeatureFlagRepository,
  ) {}

  /**
   * Initialize platform wide configuration and data
   */
  async initialize(): Promise<void> {
    await this.initializeAdminUser();
    await this.initializeFeatureFlags();
  }

  /**
   * Create or update the admin user based on environment variables
   */
  private async initializeAdminUser(): Promise<void> {
    const adminUsername = env.HELVETIA_ADMIN;
    const adminPassword = env.HELVETIA_ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      return;
    }

    try {
      // For the static admin, we'll use a deterministic ID or just find by username
      // Since our User model uniquely identifies by githubId, we'll use a special one for the local admin
      const adminGithubId = 'local-admin';

      const existingAdmin = await this.userRepository.findByGithubId(adminGithubId);

      const hashedPassword = await hashPassword(adminPassword);

      if (existingAdmin) {
        // Check if password needs migration from legacy SHA-256 to bcrypt
        const needsPasswordMigration =
          existingAdmin.password && isLegacyHash(existingAdmin.password);

        // Update password and roles if they changed or need migration
        if (
          existingAdmin.username !== adminUsername ||
          existingAdmin.password !== hashedPassword ||
          existingAdmin.role !== Role.ADMIN ||
          needsPasswordMigration
        ) {
          await this.userRepository.update(existingAdmin.id, {
            username: adminUsername,
            password: hashedPassword,
            role: Role.ADMIN,
          });
          console.log(`Admin user '${adminUsername}' updated successfully.`);
        }
      } else {
        // Create new admin user
        await this.userRepository.upsert(
          { githubId: adminGithubId },
          {
            githubId: adminGithubId,
            username: adminUsername,
            password: hashedPassword,
            role: Role.ADMIN,
          },
          {
            username: adminUsername,
            password: hashedPassword,
            role: Role.ADMIN,
          },
        );
        console.log(`Admin user '${adminUsername}' created successfully.`);
      }
    } catch (error) {
      console.error('Failed to initialize admin user:', error);
    }
  }

  /**
   * Initialize default feature flags
   */
  private async initializeFeatureFlags(): Promise<void> {
    const defaultFlags = [
      {
        key: 'show-deployments',
        name: 'Show Deployments',
        description: 'Enable the deployments view in the dashboard',
        enabled: true,
      },
    ];

    for (const flag of defaultFlags) {
      try {
        const existing = await this.featureFlagRepository.findByKey(flag.key);
        if (!existing) {
          await this.featureFlagRepository.create(flag);
          console.log(`Feature flag '${flag.key}' seeded successfully.`);
        }
      } catch (error) {
        console.error(`Failed to seed feature flag '${flag.key}':`, error);
      }
    }
  }
}
