import { PrismaClient, UsageMetric } from 'database';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens.js';
import type { IUsageTrackingService } from '../interfaces/index.js';

/**
 * Pricing per unit for each metric (in USD)
 */
const USAGE_PRICING = {
  COMPUTE_HOURS: 0.01, // $0.01 per compute hour
  MEMORY_GB_HOURS: 0.005, // $0.005 per GB-hour
  BANDWIDTH_GB: 0.12, // $0.12 per GB
  STORAGE_GB: 0.023, // $0.023 per GB per month
} as const;

/**
 * UsageTrackingService
 * Handles recording and reporting of resource usage
 */
@injectable()
export class UsageTrackingService implements IUsageTrackingService {
  constructor(
    @inject(TOKENS.PrismaClient)
    private prisma: PrismaClient,
  ) {}

  /**
   * Record usage for a service
   */
  async recordUsage(params: {
    serviceId: string;
    metric: UsageMetric;
    quantity: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    await this.prisma.usageRecord.create({
      data: {
        serviceId: params.serviceId,
        metric: params.metric,
        quantity: params.quantity,
        timestamp: new Date(),
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      },
    });
  }

  /**
   * Get usage for a service in a period
   */
  async getServiceUsage(params: { serviceId: string; periodStart: Date; periodEnd: Date }): Promise<
    Array<{
      metric: UsageMetric;
      quantity: number;
    }>
  > {
    const records = await this.prisma.usageRecord.groupBy({
      by: ['metric'],
      where: {
        serviceId: params.serviceId,
        periodStart: {
          gte: params.periodStart,
        },
        periodEnd: {
          lte: params.periodEnd,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    return records.map((record) => ({
      metric: record.metric,
      quantity: record._sum.quantity || 0,
    }));
  }

  /**
   * Get aggregated usage for all services of a user/organization
   */
  async getAggregatedUsage(params: {
    userId?: string;
    organizationId?: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<
    Array<{
      metric: UsageMetric;
      quantity: number;
      cost: number;
    }>
  > {
    // Get all services for user/organization
    const services = await this.prisma.service.findMany({
      where: {
        userId: params.userId,
        environment: params.organizationId
          ? {
              project: {
                organizationId: params.organizationId,
              },
            }
          : undefined,
      },
      select: { id: true },
    });

    const serviceIds = services.map((s) => s.id);

    if (serviceIds.length === 0) {
      return [];
    }

    // Get aggregated usage
    const records = await this.prisma.usageRecord.groupBy({
      by: ['metric'],
      where: {
        serviceId: {
          in: serviceIds,
        },
        periodStart: {
          gte: params.periodStart,
        },
        periodEnd: {
          lte: params.periodEnd,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    return records.map((record) => {
      const quantity = record._sum.quantity || 0;
      return {
        metric: record.metric,
        quantity,
        cost: this.calculateCost(record.metric, quantity),
      };
    });
  }

  /**
   * Calculate cost for usage
   */
  calculateCost(metric: UsageMetric, quantity: number): number {
    const pricePerUnit = USAGE_PRICING[metric];
    return Math.round(pricePerUnit * quantity * 100) / 100; // Round to 2 decimal places
  }
}
