import type { UsageMetric } from 'database';

/**
 * Usage tracking service interface
 * Handles recording and reporting of resource usage
 */
export interface IUsageTrackingService {
  /**
   * Record usage for a service
   */
  recordUsage(params: {
    serviceId: string;
    metric: UsageMetric;
    quantity: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void>;

  /**
   * Get usage for a service in a period
   */
  getServiceUsage(params: { serviceId: string; periodStart: Date; periodEnd: Date }): Promise<
    Array<{
      metric: UsageMetric;
      quantity: number;
    }>
  >;

  /**
   * Get aggregated usage for all services of a user/organization
   */
  getAggregatedUsage(params: {
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
  >;

  /**
   * Calculate cost for usage
   */
  calculateCost(metric: UsageMetric, quantity: number): number;
}
