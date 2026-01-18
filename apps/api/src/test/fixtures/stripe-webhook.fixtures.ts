import crypto from 'crypto';
import Stripe from 'stripe';

/**
 * Test fixtures for Stripe webhook events
 * Provides reusable mock webhook payloads for testing
 */

/**
 * Helper to create a mock Stripe subscription object
 */
export function createMockStripeSubscription(
  params: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: params.id || 'sub_test_12345',
    object: 'subscription',
    application: null,
    application_fee_percent: null,
    automatic_tax: { enabled: false, liability: null },
    billing_cycle_anchor: now,
    billing_cycle_anchor_config: null,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: null,
    collection_method: 'charge_automatically',
    created: now,
    currency: 'usd',
    current_period_end: now + 30 * 24 * 60 * 60, // 30 days from now
    current_period_start: now,
    customer: params.customer || 'cus_test_customer123',
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    discounts: [],
    ended_at: null,
    invoice_settings: { issuer: { type: 'self' } },
    items: {
      object: 'list',
      data: params.items?.data || [
        {
          id: 'si_test_item1',
          object: 'subscription_item',
          billing_thresholds: null,
          created: now,
          discounts: [],
          metadata: {},
          price: {
            id: 'price_test_starter',
            object: 'price',
            active: true,
            billing_scheme: 'per_unit',
            created: now,
            currency: 'usd',
            custom_unit_amount: null,
            livemode: false,
            lookup_key: null,
            metadata: {},
            nickname: 'Starter Plan',
            product: 'prod_test_starter',
            recurring: {
              aggregate_usage: null,
              interval: 'month',
              interval_count: 1,
              meter: null,
              trial_period_days: null,
              usage_type: 'licensed',
            },
            tax_behavior: 'unspecified',
            tiers_mode: null,
            transform_quantity: null,
            type: 'recurring',
            unit_amount: 2000, // $20.00
            unit_amount_decimal: '2000',
          },
          quantity: 1,
          subscription: params.id || 'sub_test_12345',
          tax_rates: [],
          current_period_start: now,
          current_period_end: now + 30 * 24 * 60 * 60,
        },
      ],
      has_more: false,
      url: `/v1/subscription_items?subscription=${params.id || 'sub_test_12345'}`,
    },
    latest_invoice: null,
    livemode: false,
    metadata: params.metadata || {},
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: null,
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    plan: null,
    quantity: null,
    schedule: null,
    start_date: now,
    status: (params.status as Stripe.Subscription.Status) || 'active',
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: { end_behavior: { missing_payment_method: 'create_invoice' } },
    trial_start: null,
    ...params,
  };
}

/**
 * Helper to create a mock Stripe customer object
 */
export function createMockStripeCustomer(params: Partial<Stripe.Customer> = {}): Stripe.Customer {
  return {
    id: params.id || 'cus_test_customer123',
    object: 'customer',
    address: null,
    balance: 0,
    created: Math.floor(Date.now() / 1000),
    currency: null,
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: params.email || 'test@example.com',
    invoice_prefix: 'INV',
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
      rendering_options: null,
    },
    livemode: false,
    metadata: params.metadata || {
      userId: 'user-test-123',
    },
    name: params.name || 'Test User',
    next_invoice_sequence: 1,
    phone: null,
    preferred_locales: [],
    shipping: null,
    tax_exempt: 'none',
    test_clock: null,
    ...params,
  };
}

/**
 * Helper to create a mock Stripe invoice object
 */
export function createMockStripeInvoice(params: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: params.id || 'in_test_invoice123',
    object: 'invoice',
    account_country: 'US',
    account_name: 'Test Account',
    account_tax_ids: null,
    amount_due: params.amount_due || 2000,
    amount_paid: params.amount_paid || 0,
    amount_remaining: params.amount_remaining || 2000,
    amount_shipping: 0,
    application: null,
    application_fee_amount: null,
    attempt_count: 0,
    attempted: false,
    auto_advance: true,
    automatic_tax: { enabled: false, liability: null, status: null },
    automatically_finalizes_at: null,
    billing_reason: 'subscription_create',
    charge: null,
    collection_method: 'charge_automatically',
    created: now,
    currency: 'usd',
    custom_fields: null,
    customer: params.customer || 'cus_test_customer123',
    customer_address: null,
    customer_email: null,
    customer_name: null,
    customer_phone: null,
    customer_shipping: null,
    customer_tax_exempt: 'none',
    customer_tax_ids: [],
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    discounts: [],
    due_date: null,
    effective_at: null,
    ending_balance: null,
    footer: null,
    from_invoice: null,
    hosted_invoice_url: 'https://invoice.stripe.com/i/test',
    invoice_pdf: 'https://invoice.stripe.com/i/test/pdf',
    issuer: { type: 'self' },
    last_finalization_error: null,
    latest_revision: null,
    lines: {
      object: 'list',
      data: [],
      has_more: false,
      url: `/v1/invoices/${params.id || 'in_test_invoice123'}/lines`,
    },
    livemode: false,
    metadata: {},
    next_payment_attempt: null,
    number: null,
    on_behalf_of: null,
    paid: params.paid || false,
    paid_out_of_band: false,
    payment_intent: null,
    payment_settings: {
      default_mandate: null,
      payment_method_options: null,
      payment_method_types: null,
    },
    period_end: now,
    period_start: now,
    post_payment_credit_notes_amount: 0,
    pre_payment_credit_notes_amount: 0,
    quote: null,
    receipt_number: null,
    rendering: null,
    rendering_options: null,
    shipping_cost: null,
    shipping_details: null,
    starting_balance: 0,
    statement_descriptor: null,
    status: (params.status as Stripe.Invoice.Status) || 'draft',
    status_transitions: {
      finalized_at: null,
      marked_uncollectible_at: null,
      paid_at: null,
      voided_at: null,
    },
    subscription: params.subscription || 'sub_test_12345',
    subscription_details: null,
    subscription_proration_date: undefined,
    subtotal: 2000,
    subtotal_excluding_tax: null,
    tax: null,
    test_clock: null,
    threshold_reason: null,
    total: 2000,
    total_discount_amounts: [],
    total_excluding_tax: null,
    total_tax_amounts: [],
    transfer_data: null,
    webhooks_delivered_at: null,
    ...params,
  };
}

/**
 * Create a mock Stripe webhook event
 */
export function createMockStripeWebhookEvent<T extends Stripe.Event.Type>(
  type: T,
  data: Stripe.Event.Data,
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2025-12-15.clover',
    created: Math.floor(Date.now() / 1000),
    data,
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
    type,
  };
}

/**
 * Predefined webhook event fixtures
 */
export const webhookEventFixtures = {
  /**
   * customer.subscription.created event
   */
  subscriptionCreated: (customerId = 'cus_test_customer123', priceId = 'price_test_starter') => {
    const subscription = createMockStripeSubscription({
      id: 'sub_test_created',
      customer: customerId,
      status: 'active',
      items: {
        object: 'list',
        data: [
          {
            id: 'si_test_item1',
            object: 'subscription_item',
            billing_thresholds: null,
            created: Math.floor(Date.now() / 1000),
            discounts: [],
            metadata: {},
            price: {
              id: priceId,
              object: 'price',
              active: true,
              billing_scheme: 'per_unit',
              created: Math.floor(Date.now() / 1000),
              currency: 'usd',
              custom_unit_amount: null,
              livemode: false,
              lookup_key: null,
              metadata: {},
              nickname: null,
              product: 'prod_test',
              recurring: {
                aggregate_usage: null,
                interval: 'month',
                interval_count: 1,
                meter: null,
                trial_period_days: null,
                usage_type: 'licensed',
              },
              tax_behavior: 'unspecified',
              tiers_mode: null,
              transform_quantity: null,
              type: 'recurring',
              unit_amount: 2000,
              unit_amount_decimal: '2000',
            },
            quantity: 1,
            subscription: 'sub_test_created',
            tax_rates: [],
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          },
        ],
        has_more: false,
        url: '/v1/subscription_items?subscription=sub_test_created',
      },
    });

    return createMockStripeWebhookEvent('customer.subscription.created', {
      object: subscription,
      previous_attributes: undefined,
    });
  },

  /**
   * customer.subscription.updated event
   */
  subscriptionUpdated: (
    subscriptionId = 'sub_test_12345',
    status: Stripe.Subscription.Status = 'active',
  ) => {
    const subscription = createMockStripeSubscription({
      id: subscriptionId,
      status,
    });

    return createMockStripeWebhookEvent('customer.subscription.updated', {
      object: subscription,
      previous_attributes: { status: 'trialing' },
    });
  },

  /**
   * customer.subscription.deleted event
   */
  subscriptionDeleted: (subscriptionId = 'sub_test_12345') => {
    const subscription = createMockStripeSubscription({
      id: subscriptionId,
      status: 'canceled',
      canceled_at: Math.floor(Date.now() / 1000),
      ended_at: Math.floor(Date.now() / 1000),
    });

    return createMockStripeWebhookEvent('customer.subscription.deleted', {
      object: subscription,
      previous_attributes: undefined,
    });
  },

  /**
   * invoice.paid event
   */
  invoicePaid: (subscriptionId = 'sub_test_12345', customerId = 'cus_test_customer123') => {
    const invoice = createMockStripeInvoice({
      id: 'in_test_paid',
      customer: customerId,
      subscription: subscriptionId,
      status: 'paid',
      paid: true,
      amount_paid: 2000,
      amount_remaining: 0,
    });

    return createMockStripeWebhookEvent('invoice.paid', {
      object: invoice,
      previous_attributes: undefined,
    });
  },

  /**
   * invoice.payment_failed event
   */
  invoicePaymentFailed: (
    subscriptionId = 'sub_test_12345',
    customerId = 'cus_test_customer123',
  ) => {
    const invoice = createMockStripeInvoice({
      id: 'in_test_failed',
      customer: customerId,
      subscription: subscriptionId,
      status: 'open',
      paid: false,
      amount_paid: 0,
      amount_remaining: 2000,
      attempt_count: 1,
      attempted: true,
    });

    return createMockStripeWebhookEvent('invoice.payment_failed', {
      object: invoice,
      previous_attributes: undefined,
    });
  },
};

/**
 * Helper to generate Stripe webhook signature for testing
 * This mimics how Stripe signs webhook payloads
 */
export function generateStripeWebhookSignature(
  payload: string,
  secret: string,
  timestamp?: number,
): string {
  const t = timestamp || Math.floor(Date.now() / 1000);
  const signedPayload = `${t}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${t},v1=${signature}`;
}
