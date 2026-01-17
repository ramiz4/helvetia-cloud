import type { SubscriptionPlan, SubscriptionStatus } from 'database';

/**
 * Test fixtures for billing-related data
 */

export const testUsers = {
  user1: {
    id: 'user-1',
    username: 'testuser1',
    avatarUrl: 'https://avatar.url/1',
    githubId: '123456',
    githubAccessToken: 'encrypted_token_1',
    role: 'MEMBER' as const,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  user2: {
    id: 'user-2',
    username: 'testuser2',
    avatarUrl: 'https://avatar.url/2',
    githubId: '234567',
    githubAccessToken: 'encrypted_token_2',
    role: 'MEMBER' as const,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
};

export const testOrganizations = {
  org1: {
    id: 'org-1',
    name: 'Test Organization',
    slug: 'test-org',
    avatarUrl: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};

export const testSubscriptions = {
  free: {
    id: 'sub-free-1',
    userId: 'user-1',
    organizationId: null,
    stripeCustomerId: 'cus_test_free',
    stripeSubscriptionId: null,
    plan: 'FREE' as SubscriptionPlan,
    status: 'ACTIVE' as SubscriptionStatus,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-12-31'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  starter: {
    id: 'sub-starter-1',
    userId: 'user-2',
    organizationId: null,
    stripeCustomerId: 'cus_test_starter',
    stripeSubscriptionId: 'sub_test_starter',
    plan: 'STARTER' as SubscriptionPlan,
    status: 'ACTIVE' as SubscriptionStatus,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  pro: {
    id: 'sub-pro-1',
    userId: 'user-1',
    organizationId: null,
    stripeCustomerId: 'cus_test_pro',
    stripeSubscriptionId: 'sub_test_pro',
    plan: 'PRO' as SubscriptionPlan,
    status: 'ACTIVE' as SubscriptionStatus,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  pastDue: {
    id: 'sub-pastdue-1',
    userId: 'user-1',
    organizationId: null,
    stripeCustomerId: 'cus_test_pastdue',
    stripeSubscriptionId: 'sub_test_pastdue',
    plan: 'STARTER' as SubscriptionPlan,
    status: 'PAST_DUE' as SubscriptionStatus,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  canceled: {
    id: 'sub-canceled-1',
    userId: 'user-1',
    organizationId: null,
    stripeCustomerId: 'cus_test_canceled',
    stripeSubscriptionId: 'sub_test_canceled',
    plan: 'STARTER' as SubscriptionPlan,
    status: 'CANCELED' as SubscriptionStatus,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};

export const testServices = {
  service1: {
    id: 'service-1',
    name: 'Test Service 1',
    userId: 'user-1',
    repoUrl: 'https://github.com/user/repo1',
    branch: 'main',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    port: 3000,
    status: 'RUNNING' as const,
    envVars: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    customDomain: null,
    staticOutputDir: null,
    type: 'DOCKER' as const,
    isPreview: false,
    prNumber: null,
    deletedAt: null,
    deleteProtected: false,
    environmentId: null,
  },
  service2: {
    id: 'service-2',
    name: 'Test Service 2',
    userId: 'user-1',
    repoUrl: 'https://github.com/user/repo2',
    branch: 'main',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    port: 3001,
    status: 'RUNNING' as const,
    envVars: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    customDomain: null,
    staticOutputDir: null,
    type: 'DOCKER' as const,
    isPreview: false,
    prNumber: null,
    deletedAt: null,
    deleteProtected: false,
    environmentId: null,
  },
};

export const testUsageRecords = {
  compute: {
    id: 'usage-1',
    serviceId: 'service-1',
    metric: 'COMPUTE_HOURS' as const,
    quantity: 100,
    timestamp: new Date('2024-01-15'),
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-15'),
  },
  memory: {
    id: 'usage-2',
    serviceId: 'service-1',
    metric: 'MEMORY_GB_HOURS' as const,
    quantity: 50,
    timestamp: new Date('2024-01-15'),
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-15'),
  },
  bandwidth: {
    id: 'usage-3',
    serviceId: 'service-1',
    metric: 'BANDWIDTH_GB' as const,
    quantity: 25,
    timestamp: new Date('2024-01-15'),
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-15'),
  },
  storage: {
    id: 'usage-4',
    serviceId: 'service-1',
    metric: 'STORAGE_GB' as const,
    quantity: 10,
    timestamp: new Date('2024-01-15'),
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-15'),
  },
};

export const testPriceIds = {
  STARTER: 'price_starter_test',
  PRO: 'price_pro_test',
  ENTERPRISE: 'price_enterprise_test',
  COMPUTE_HOURS: 'price_compute_test',
  MEMORY_GB_HOURS: 'price_memory_test',
  BANDWIDTH_GB: 'price_bandwidth_test',
  STORAGE_GB: 'price_storage_test',
};

/**
 * Expected resource limits for each plan
 */
export const planLimits = {
  FREE: {
    maxServices: 1,
    maxMemoryMB: 512,
    maxCPUCores: 0.5,
    maxBandwidthGB: 10,
    maxStorageGB: 5,
  },
  STARTER: {
    maxServices: 5,
    maxMemoryMB: 2048,
    maxCPUCores: 2,
    maxBandwidthGB: 100,
    maxStorageGB: 50,
  },
  PRO: {
    maxServices: 20,
    maxMemoryMB: 8192,
    maxCPUCores: 8,
    maxBandwidthGB: 500,
    maxStorageGB: 200,
  },
  ENTERPRISE: {
    maxServices: -1,
    maxMemoryMB: -1,
    maxCPUCores: -1,
    maxBandwidthGB: -1,
    maxStorageGB: -1,
  },
};

/**
 * Expected usage pricing per unit
 */
export const usagePricing = {
  COMPUTE_HOURS: 0.01,
  MEMORY_GB_HOURS: 0.005,
  BANDWIDTH_GB: 0.12,
  STORAGE_GB: 0.023,
};
