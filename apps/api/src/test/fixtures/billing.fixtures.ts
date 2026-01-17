import type { SubscriptionPlan, SubscriptionStatus, UsageMetric } from 'database';

/**
 * Test fixtures for billing scenarios
 * Provides reusable test data for subscriptions, usage records, and billing scenarios
 */

/**
 * Test user data
 */
export const testUsers = {
  freeUser: {
    id: 'user-free-001',
    githubId: '12345',
    username: 'freeuser',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
    email: 'freeuser@test.com',
  },
  starterUser: {
    id: 'user-starter-001',
    githubId: '12346',
    username: 'starteruser',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12346',
    email: 'starteruser@test.com',
  },
  proUser: {
    id: 'user-pro-001',
    githubId: '12347',
    username: 'prouser',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12347',
    email: 'prouser@test.com',
  },
  enterpriseUser: {
    id: 'user-enterprise-001',
    githubId: '12348',
    username: 'enterpriseuser',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12348',
    email: 'enterpriseuser@test.com',
  },
};

/**
 * Test Stripe customer IDs
 */
export const testStripeCustomers = {
  free: 'cus_test_free_001',
  starter: 'cus_test_starter_001',
  pro: 'cus_test_pro_001',
  enterprise: 'cus_test_enterprise_001',
};

/**
 * Test Stripe subscription IDs
 */
export const testStripeSubscriptions = {
  starter: 'sub_test_starter_001',
  pro: 'sub_test_pro_001',
  enterprise: 'sub_test_enterprise_001',
};

/**
 * Test Stripe price IDs
 */
export const testStripePrices = {
  starter: 'price_test_starter_monthly',
  pro: 'price_test_pro_monthly',
  enterprise: 'price_test_enterprise_monthly',
  computeHours: 'price_test_compute_hours',
  memoryGbHours: 'price_test_memory_gb_hours',
  bandwidthGb: 'price_test_bandwidth_gb',
  storageGb: 'price_test_storage_gb',
};

/**
 * Subscription plans with their limits
 */
export const subscriptionPlans = {
  FREE: {
    plan: 'FREE' as SubscriptionPlan,
    limits: {
      maxServices: 1,
      maxMemoryMB: 512,
      maxCPUCores: 0.5,
      maxBandwidthGB: 10,
      maxStorageGB: 5,
    },
    pricing: {
      monthly: 0,
      computeHours: 0,
      memoryGbHours: 0,
      bandwidthGb: 0,
      storageGb: 0,
    },
  },
  STARTER: {
    plan: 'STARTER' as SubscriptionPlan,
    limits: {
      maxServices: 5,
      maxMemoryMB: 2048,
      maxCPUCores: 2,
      maxBandwidthGB: 100,
      maxStorageGB: 50,
    },
    pricing: {
      monthly: 20, // $20/month
      computeHours: 0.01, // $0.01 per hour
      memoryGbHours: 0.005, // $0.005 per GB-hour
      bandwidthGb: 0.12, // $0.12 per GB
      storageGb: 0.023, // $0.023 per GB/month
    },
  },
  PRO: {
    plan: 'PRO' as SubscriptionPlan,
    limits: {
      maxServices: 20,
      maxMemoryMB: 8192,
      maxCPUCores: 8,
      maxBandwidthGB: 500,
      maxStorageGB: 200,
    },
    pricing: {
      monthly: 50, // $50/month
      computeHours: 0.01,
      memoryGbHours: 0.005,
      bandwidthGb: 0.12,
      storageGb: 0.023,
    },
  },
  ENTERPRISE: {
    plan: 'ENTERPRISE' as SubscriptionPlan,
    limits: {
      maxServices: -1, // Unlimited
      maxMemoryMB: -1, // Unlimited
      maxCPUCores: -1, // Unlimited
      maxBandwidthGB: -1, // Unlimited
      maxStorageGB: -1, // Unlimited
    },
    pricing: {
      monthly: 500, // $500/month
      computeHours: 0.008, // Discounted
      memoryGbHours: 0.004, // Discounted
      bandwidthGb: 0.10, // Discounted
      storageGb: 0.020, // Discounted
    },
  },
};

/**
 * Generate subscription fixture
 */
export function createSubscriptionFixture(params: {
  userId?: string;
  organizationId?: string;
  plan: SubscriptionPlan;
  status?: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}): {
  id: string;
  userId: string | null;
  organizationId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
} {
  const now = new Date();
  const periodStart = new Date(now);
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30); // 30 days from now

  return {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    userId: params.userId || null,
    organizationId: params.organizationId || null,
    stripeCustomerId: params.stripeCustomerId || `cus_test_${Date.now()}`,
    stripeSubscriptionId:
      params.plan === 'FREE' ? null : params.stripeSubscriptionId || `sub_test_${Date.now()}`,
    plan: params.plan,
    status: params.status || 'ACTIVE',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generate usage record fixture
 */
export function createUsageRecordFixture(params: {
  serviceId: string;
  metric: UsageMetric;
  quantity: number;
  periodStart?: Date;
  periodEnd?: Date;
}): {
  id: string;
  serviceId: string;
  metric: UsageMetric;
  quantity: number;
  timestamp: Date;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
} {
  const now = new Date();
  const periodStart = params.periodStart || new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
  const periodEnd = params.periodEnd || now;

  return {
    id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    serviceId: params.serviceId,
    metric: params.metric,
    quantity: params.quantity,
    timestamp: now,
    periodStart,
    periodEnd,
    createdAt: now,
  };
}

/**
 * Predefined billing scenarios for testing
 */
export const billingScenarios = {
  /**
   * User with free plan, no services yet
   */
  newFreeUser: {
    user: testUsers.freeUser,
    subscription: createSubscriptionFixture({
      userId: testUsers.freeUser.id,
      plan: 'FREE',
      stripeCustomerId: testStripeCustomers.free,
    }),
    services: [],
    usage: [],
  },

  /**
   * User on starter plan with one service and some usage
   */
  starterWithUsage: {
    user: testUsers.starterUser,
    subscription: createSubscriptionFixture({
      userId: testUsers.starterUser.id,
      plan: 'STARTER',
      stripeCustomerId: testStripeCustomers.starter,
      stripeSubscriptionId: testStripeSubscriptions.starter,
    }),
    services: [
      {
        id: 'service-starter-001',
        name: 'api-service',
        userId: testUsers.starterUser.id,
        status: 'RUNNING',
      },
    ],
    usage: [
      createUsageRecordFixture({
        serviceId: 'service-starter-001',
        metric: 'COMPUTE_HOURS',
        quantity: 100, // 100 hours
      }),
      createUsageRecordFixture({
        serviceId: 'service-starter-001',
        metric: 'MEMORY_GB_HOURS',
        quantity: 50, // 50 GB-hours
      }),
      createUsageRecordFixture({
        serviceId: 'service-starter-001',
        metric: 'BANDWIDTH_GB',
        quantity: 25, // 25 GB
      }),
      createUsageRecordFixture({
        serviceId: 'service-starter-001',
        metric: 'STORAGE_GB',
        quantity: 10, // 10 GB
      }),
    ],
  },

  /**
   * User on pro plan with multiple services
   */
  proWithMultipleServices: {
    user: testUsers.proUser,
    subscription: createSubscriptionFixture({
      userId: testUsers.proUser.id,
      plan: 'PRO',
      stripeCustomerId: testStripeCustomers.pro,
      stripeSubscriptionId: testStripeSubscriptions.pro,
    }),
    services: [
      {
        id: 'service-pro-001',
        name: 'api-service',
        userId: testUsers.proUser.id,
        status: 'RUNNING',
      },
      {
        id: 'service-pro-002',
        name: 'web-frontend',
        userId: testUsers.proUser.id,
        status: 'RUNNING',
      },
      {
        id: 'service-pro-003',
        name: 'worker-service',
        userId: testUsers.proUser.id,
        status: 'RUNNING',
      },
    ],
    usage: [
      // API service usage
      createUsageRecordFixture({
        serviceId: 'service-pro-001',
        metric: 'COMPUTE_HOURS',
        quantity: 200,
      }),
      createUsageRecordFixture({
        serviceId: 'service-pro-001',
        metric: 'MEMORY_GB_HOURS',
        quantity: 100,
      }),
      // Frontend usage
      createUsageRecordFixture({
        serviceId: 'service-pro-002',
        metric: 'COMPUTE_HOURS',
        quantity: 150,
      }),
      createUsageRecordFixture({
        serviceId: 'service-pro-002',
        metric: 'BANDWIDTH_GB',
        quantity: 100,
      }),
      // Worker usage
      createUsageRecordFixture({
        serviceId: 'service-pro-003',
        metric: 'COMPUTE_HOURS',
        quantity: 300,
      }),
      createUsageRecordFixture({
        serviceId: 'service-pro-003',
        metric: 'MEMORY_GB_HOURS',
        quantity: 200,
      }),
    ],
  },

  /**
   * User approaching plan limits
   */
  starterApproachingLimits: {
    user: { ...testUsers.starterUser, id: 'user-starter-002' },
    subscription: createSubscriptionFixture({
      userId: 'user-starter-002',
      plan: 'STARTER',
      stripeCustomerId: 'cus_test_starter_002',
      stripeSubscriptionId: 'sub_test_starter_002',
    }),
    services: [
      { id: 'service-001', name: 'service-1', userId: 'user-starter-002', status: 'RUNNING' },
      { id: 'service-002', name: 'service-2', userId: 'user-starter-002', status: 'RUNNING' },
      { id: 'service-003', name: 'service-3', userId: 'user-starter-002', status: 'RUNNING' },
      { id: 'service-004', name: 'service-4', userId: 'user-starter-002', status: 'RUNNING' },
      { id: 'service-005', name: 'service-5', userId: 'user-starter-002', status: 'RUNNING' },
    ],
    usage: [
      createUsageRecordFixture({
        serviceId: 'service-001',
        metric: 'BANDWIDTH_GB',
        quantity: 95, // Close to 100 GB limit
      }),
    ],
  },

  /**
   * User with past due subscription
   */
  pastDueSubscription: {
    user: { ...testUsers.starterUser, id: 'user-starter-003' },
    subscription: createSubscriptionFixture({
      userId: 'user-starter-003',
      plan: 'STARTER',
      status: 'PAST_DUE',
      stripeCustomerId: 'cus_test_starter_003',
      stripeSubscriptionId: 'sub_test_starter_003',
    }),
    services: [
      { id: 'service-pastdue-001', name: 'api-service', userId: 'user-starter-003', status: 'STOPPED' },
    ],
    usage: [],
  },

  /**
   * Enterprise user with high usage
   */
  enterpriseHighUsage: {
    user: testUsers.enterpriseUser,
    subscription: createSubscriptionFixture({
      userId: testUsers.enterpriseUser.id,
      plan: 'ENTERPRISE',
      stripeCustomerId: testStripeCustomers.enterprise,
      stripeSubscriptionId: testStripeSubscriptions.enterprise,
    }),
    services: Array.from({ length: 25 }, (_, i) => ({
      id: `service-enterprise-${String(i + 1).padStart(3, '0')}`,
      name: `service-${i + 1}`,
      userId: testUsers.enterpriseUser.id,
      status: 'RUNNING',
    })),
    usage: [
      createUsageRecordFixture({
        serviceId: 'service-enterprise-001',
        metric: 'COMPUTE_HOURS',
        quantity: 5000, // Very high usage
      }),
      createUsageRecordFixture({
        serviceId: 'service-enterprise-001',
        metric: 'MEMORY_GB_HOURS',
        quantity: 10000,
      }),
      createUsageRecordFixture({
        serviceId: 'service-enterprise-001',
        metric: 'BANDWIDTH_GB',
        quantity: 2000,
      }),
      createUsageRecordFixture({
        serviceId: 'service-enterprise-001',
        metric: 'STORAGE_GB',
        quantity: 500,
      }),
    ],
  },
};

/**
 * Helper to calculate expected cost for usage records
 */
export function calculateUsageCost(
  usage: Array<{ metric: UsageMetric; quantity: number }>,
  plan: SubscriptionPlan,
): number {
  const pricing = subscriptionPlans[plan].pricing;
  let totalCost = 0;

  for (const record of usage) {
    switch (record.metric) {
      case 'COMPUTE_HOURS':
        totalCost += record.quantity * pricing.computeHours;
        break;
      case 'MEMORY_GB_HOURS':
        totalCost += record.quantity * pricing.memoryGbHours;
        break;
      case 'BANDWIDTH_GB':
        totalCost += record.quantity * pricing.bandwidthGb;
        break;
      case 'STORAGE_GB':
        totalCost += record.quantity * pricing.storageGb;
        break;
    }
  }

  return parseFloat(totalCost.toFixed(2));
}

/**
 * Helper to check if user is within plan limits
 */
export function isWithinPlanLimits(
  usage: { services: number; memoryMB: number; cpuCores: number; bandwidthGB: number; storageGB: number },
  plan: SubscriptionPlan,
): {
  withinLimits: boolean;
  exceeded: string[];
} {
  const limits = subscriptionPlans[plan].limits;
  const exceeded: string[] = [];

  if (limits.maxServices !== -1 && usage.services > limits.maxServices) {
    exceeded.push(`services (${usage.services} > ${limits.maxServices})`);
  }
  if (limits.maxMemoryMB !== -1 && usage.memoryMB > limits.maxMemoryMB) {
    exceeded.push(`memory (${usage.memoryMB}MB > ${limits.maxMemoryMB}MB)`);
  }
  if (limits.maxCPUCores !== -1 && usage.cpuCores > limits.maxCPUCores) {
    exceeded.push(`cpu (${usage.cpuCores} > ${limits.maxCPUCores} cores)`);
  }
  if (limits.maxBandwidthGB !== -1 && usage.bandwidthGB > limits.maxBandwidthGB) {
    exceeded.push(`bandwidth (${usage.bandwidthGB}GB > ${limits.maxBandwidthGB}GB)`);
  }
  if (limits.maxStorageGB !== -1 && usage.storageGB > limits.maxStorageGB) {
    exceeded.push(`storage (${usage.storageGB}GB > ${limits.maxStorageGB}GB)`);
  }

  return {
    withinLimits: exceeded.length === 0,
    exceeded,
  };
}
