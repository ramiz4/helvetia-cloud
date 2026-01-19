import Stripe from 'stripe';
import { env } from './env.js';

/**
 * Stripe client instance
 * Initialized with secret key from environment variables
 */
let stripeClient: Stripe | null = null;

/**
 * Get Stripe client instance (singleton)
 * Returns null if Stripe is not configured
 */
export function getStripeClient(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
      appInfo: {
        name: 'Helvetia Cloud',
        version: '1.0.0',
      },
    });
  }

  return stripeClient;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!env.STRIPE_SECRET_KEY;
}

/**
 * Stripe price IDs for subscription plans
 */
export function getStripePriceIds() {
  return {
    STARTER: env.STRIPE_PRICE_ID_STARTER,
    PRO: env.STRIPE_PRICE_ID_PRO,
    ENTERPRISE: env.STRIPE_PRICE_ID_ENTERPRISE,
    COMPUTE_HOURS: env.STRIPE_PRICE_ID_COMPUTE_HOURS,
    MEMORY_GB_HOURS: env.STRIPE_PRICE_ID_MEMORY_GB_HOURS,
    BANDWIDTH_GB: env.STRIPE_PRICE_ID_BANDWIDTH_GB,
    STORAGE_GB: env.STRIPE_PRICE_ID_STORAGE_GB,
  } as const;
}
