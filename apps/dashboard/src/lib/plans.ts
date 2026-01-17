import type { PlanDetails } from '@/types/billing';

/**
 * Available subscription plans
 * Note: Price IDs should be loaded from environment variables in production
 */
export const PLANS: PlanDetails[] = [
  {
    name: 'FREE',
    displayName: 'Free',
    price: 0,
    interval: 'month',
    priceId: '', // No price ID for free plan
    features: [
      '1 project',
      '1 environment',
      '2 services',
      '100 MB storage',
      '1 GB bandwidth/month',
      'Community support',
    ],
  },
  {
    name: 'STARTER',
    displayName: 'Starter',
    price: 29,
    interval: 'month',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER || '',
    features: [
      '5 projects',
      'Unlimited environments',
      '10 services',
      '10 GB storage',
      '50 GB bandwidth/month',
      'Email support',
      'Custom domains',
      'SSL certificates',
    ],
  },
  {
    name: 'PRO',
    displayName: 'Pro',
    price: 99,
    interval: 'month',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || '',
    highlighted: true,
    features: [
      'Unlimited projects',
      'Unlimited environments',
      'Unlimited services',
      '100 GB storage',
      '500 GB bandwidth/month',
      'Priority support',
      'Advanced monitoring',
      'Team collaboration',
      'API access',
      'Custom integrations',
    ],
  },
  {
    name: 'ENTERPRISE',
    displayName: 'Enterprise',
    price: 299,
    interval: 'month',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE || '',
    features: [
      'Everything in Pro',
      'Unlimited storage',
      'Unlimited bandwidth',
      '99.99% SLA',
      'Dedicated support',
      'Custom contracts',
      'Advanced security',
      'Compliance features',
      'On-premise deployment',
      'Custom training',
    ],
  },
];

/**
 * Get plan details by name
 */
export function getPlanByName(name: string): PlanDetails | undefined {
  return PLANS.find((plan) => plan.name === name);
}
