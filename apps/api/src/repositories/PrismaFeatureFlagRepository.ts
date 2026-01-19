import crypto from 'crypto';
import { Prisma, PrismaClient } from 'database';
import { inject, injectable } from 'tsyringe';
import {
  CreateFeatureFlagData,
  FeatureFlag,
  IFeatureFlagRepository,
  UpdateFeatureFlagData,
} from '../interfaces/index.js';

/**
 * Prisma implementation of IFeatureFlagRepository
 */
@injectable()
export class PrismaFeatureFlagRepository implements IFeatureFlagRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  async findById(id: string): Promise<FeatureFlag | null> {
    return this.prisma.featureFlag.findUnique({
      where: { id },
    });
  }

  async findByKey(key: string): Promise<FeatureFlag | null> {
    return this.prisma.featureFlag.findUnique({
      where: { key },
    });
  }

  async findAll(): Promise<FeatureFlag[]> {
    return this.prisma.featureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateFeatureFlagData): Promise<FeatureFlag> {
    return this.prisma.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description ?? null,
        enabled: data.enabled ?? false,
        segments:
          data.segments !== undefined ? (data.segments as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  async update(id: string, data: UpdateFeatureFlagData): Promise<FeatureFlag> {
    return this.prisma.featureFlag.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        segments:
          data.segments !== undefined ? (data.segments as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.featureFlag.delete({
      where: { id },
    });
  }

  async isEnabled(key: string, userId?: string): Promise<boolean> {
    const flag = await this.findByKey(key);

    if (!flag) {
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // If no userId provided or no segments defined, return the flag's enabled status
    if (!userId || !flag.segments) {
      return flag.enabled;
    }

    // A/B testing based on segments
    const segments = flag.segments as {
      type?: 'userIds' | 'percentage';
      userIds?: string[];
      percentage?: number;
    };

    // Check if user is in specific user list
    if (segments.type === 'userIds' && segments.userIds) {
      return segments.userIds.includes(userId);
    }

    // Check if user falls within percentage rollout
    if (segments.type === 'percentage' && typeof segments.percentage === 'number') {
      // Use deterministic hashing for consistent user assignment
      const hash = this.hashUserId(userId, key);
      return hash < segments.percentage;
    }

    return flag.enabled;
  }

  /**
   * Check multiple feature flags at once with a single database query
   * More efficient than calling isEnabled multiple times
   */
  async checkMultiple(keys: string[], userId?: string): Promise<Record<string, boolean>> {
    if (keys.length === 0) {
      return {};
    }

    // Fetch all flags in a single query
    const flags = await this.prisma.featureFlag.findMany({
      where: {
        key: {
          in: keys,
        },
      },
    });

    // Create a map of key to flag for quick lookup
    const flagMap = new Map<string, FeatureFlag>();
    for (const flag of flags) {
      flagMap.set(flag.key, flag);
    }

    // Evaluate each flag
    const results: Record<string, boolean> = {};
    for (const key of keys) {
      const flag = flagMap.get(key);

      if (!flag || !flag.enabled) {
        results[key] = false;
        continue;
      }

      // If no userId provided or no segments defined, return the flag's enabled status
      if (!userId || !flag.segments) {
        results[key] = flag.enabled;
        continue;
      }

      // A/B testing based on segments
      const segments = flag.segments as {
        type?: 'userIds' | 'percentage';
        userIds?: string[];
        percentage?: number;
      };

      // Check if user is in specific user list
      if (segments.type === 'userIds' && segments.userIds) {
        results[key] = segments.userIds.includes(userId);
        continue;
      }

      // Check if user falls within percentage rollout
      if (segments.type === 'percentage' && typeof segments.percentage === 'number') {
        const hash = this.hashUserId(userId, key);
        results[key] = hash < segments.percentage;
        continue;
      }

      results[key] = flag.enabled;
    }

    return results;
  }

  /**
   * Generate a deterministic hash for user ID to percentage (0-100)
   * This ensures the same user always gets the same result for a given flag
   * Uses SHA-256 for better hash distribution
   */
  private hashUserId(userId: string, flagKey: string): number {
    const input = `${userId}:${flagKey}`;
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    // Take first 8 characters and convert to int (0-4294967295)
    const hashInt = parseInt(hash.substring(0, 8), 16);
    // Convert to percentage (0-99)
    return hashInt % 100;
  }
}
