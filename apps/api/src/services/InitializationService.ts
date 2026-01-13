import crypto from 'crypto';
import { Role } from 'database';
import { inject, injectable } from 'tsyringe';
import { env } from '../config/env';
import { TOKENS } from '../di/tokens';
import type { IUserRepository } from '../interfaces';

@injectable()
export class InitializationService {
  constructor(
    @inject(TOKENS.UserRepository)
    private userRepository: IUserRepository,
  ) {}

  /**
   * Initialize platform wide configuration and data
   */
  async initialize(): Promise<void> {
    await this.initializeAdminUser();
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

      const hashedPassword = this.hashPassword(adminPassword);

      if (existingAdmin) {
        // Update password and roles if they changed
        if (
          existingAdmin.username !== adminUsername ||
          existingAdmin.password !== hashedPassword ||
          existingAdmin.role !== Role.ADMIN
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
   * Simple password hashing using Node.js crypto
   */
  private hashPassword(password: string): string {
    // In a real production app, use bcrypt or argon2 with a proper salt
    return crypto.createHash('sha256').update(password).digest('hex');
  }
}
