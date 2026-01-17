import type Stripe from 'stripe';
import { vi } from 'vitest';

/**
 * Mock Stripe client for testing
 * Provides mock implementations of Stripe API methods
 */
export function createMockStripe() {
  const mockStripe = {
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      del: vi.fn(),
      list: vi.fn(),
    },
    subscriptions: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
      list: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    invoices: {
      list: vi.fn(),
      retrieve: vi.fn(),
    },
    subscriptionItems: {
      createUsageRecord: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  } as unknown as Stripe;

  return mockStripe;
}

/**
 * Create a mock Stripe customer
 */
export function createMockCustomer(overrides?: Partial<Stripe.Customer>): Stripe.Customer {
  return {
    id: 'cus_test123',
    object: 'customer',
    address: null,
    balance: 0,
    created: Date.now() / 1000,
    currency: 'usd',
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: 'test@example.com',
    invoice_prefix: 'INV',
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
      rendering_options: null,
    },
    livemode: false,
    metadata: {
      userId: 'user-1',
      organizationId: '',
    },
    name: 'Test User',
    phone: null,
    preferred_locales: [],
    shipping: null,
    tax_exempt: 'none',
    test_clock: null,
    ...overrides,
  } as Stripe.Customer;
}

/**
 * Create a mock Stripe subscription
 */
export function createMockSubscription(
  overrides?: Partial<Stripe.Subscription>,
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  const futureDate = now + 30 * 24 * 60 * 60; // 30 days from now

  return {
    id: 'sub_test123',
    object: 'subscription',
    application: null,
    application_fee_percent: null,
    automatic_tax: { enabled: false },
    billing_cycle_anchor: now,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: null,
    collection_method: 'charge_automatically',
    created: now,
    currency: 'usd',
    current_period_end: futureDate,
    current_period_start: now,
    customer: 'cus_test123',
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    ended_at: null,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test123',
          object: 'subscription_item',
          billing_thresholds: null,
          created: now,
          metadata: {},
          price: {
            id: 'price_starter',
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
            product: 'prod_test123',
            recurring: {
              aggregate_usage: null,
              interval: 'month',
              interval_count: 1,
              trial_period_days: null,
              usage_type: 'licensed',
            },
            tax_behavior: 'unspecified',
            tiers_mode: null,
            transform_quantity: null,
            type: 'recurring',
            unit_amount: 1000,
            unit_amount_decimal: '1000',
          },
          quantity: 1,
          subscription: 'sub_test123',
          tax_rates: [],
          current_period_start: now,
          current_period_end: futureDate,
        },
      ],
      has_more: false,
      url: '/v1/subscription_items?subscription=sub_test123',
    },
    latest_invoice: null,
    livemode: false,
    metadata: {},
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: 'on_subscription',
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: now,
    status: 'active',
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: { end_behavior: { missing_payment_method: 'create_invoice' } },
    trial_start: null,
    ...overrides,
  } as Stripe.Subscription;
}

/**
 * Create a mock Stripe invoice
 */
export function createMockInvoice(overrides?: Partial<Stripe.Invoice>): Stripe.Invoice {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: 'in_test123',
    object: 'invoice',
    account_country: 'US',
    account_name: 'Test Account',
    account_tax_ids: null,
    amount_due: 1000,
    amount_paid: 1000,
    amount_remaining: 0,
    amount_shipping: 0,
    application: null,
    application_fee_amount: null,
    attempt_count: 1,
    attempted: true,
    auto_advance: true,
    automatic_tax: { enabled: false, status: null },
    billing_reason: 'subscription_cycle',
    charge: 'ch_test123',
    collection_method: 'charge_automatically',
    created: now,
    currency: 'usd',
    custom_fields: null,
    customer: 'cus_test123',
    customer_address: null,
    customer_email: 'test@example.com',
    customer_name: 'Test User',
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
    effective_at: now,
    ending_balance: 0,
    footer: null,
    from_invoice: null,
    hosted_invoice_url: 'https://invoice.stripe.com/test',
    invoice_pdf: 'https://invoice.stripe.com/test.pdf',
    last_finalization_error: null,
    latest_revision: null,
    lines: {
      object: 'list',
      data: [],
      has_more: false,
      url: '/v1/invoices/in_test123/lines',
    },
    livemode: false,
    metadata: {},
    next_payment_attempt: null,
    number: 'INV-0001',
    on_behalf_of: null,
    paid: true,
    paid_out_of_band: false,
    payment_intent: 'pi_test123',
    payment_settings: {
      default_mandate: null,
      payment_method_options: null,
      payment_method_types: null,
    },
    period_end: now,
    period_start: now - 30 * 24 * 60 * 60,
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
    status: 'paid',
    status_transitions: {
      finalized_at: now,
      marked_uncollectible_at: null,
      paid_at: now,
      voided_at: null,
    },
    subscription: 'sub_test123',
    subscription_details: null,
    subtotal: 1000,
    subtotal_excluding_tax: 1000,
    tax: null,
    test_clock: null,
    total: 1000,
    total_discount_amounts: [],
    total_excluding_tax: 1000,
    total_tax_amounts: [],
    transfer_data: null,
    webhooks_delivered_at: now,
    ...overrides,
  } as Stripe.Invoice;
}

/**
 * Create a mock Stripe checkout session
 */
export function createMockCheckoutSession(
  overrides?: Partial<Stripe.Checkout.Session>,
): Stripe.Checkout.Session {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: 'cs_test123',
    object: 'checkout.session',
    after_expiration: null,
    allow_promotion_codes: null,
    amount_subtotal: 1000,
    amount_total: 1000,
    automatic_tax: { enabled: false, status: null },
    billing_address_collection: null,
    cancel_url: 'https://example.com/cancel',
    client_reference_id: null,
    client_secret: null,
    consent: null,
    consent_collection: null,
    created: now,
    currency: 'usd',
    currency_conversion: null,
    custom_fields: [],
    custom_text: {
      after_submit: null,
      shipping_address: null,
      submit: null,
      terms_of_service_acceptance: null,
    },
    customer: 'cus_test123',
    customer_creation: null,
    customer_details: null,
    customer_email: 'test@example.com',
    expires_at: now + 24 * 60 * 60,
    invoice: null,
    invoice_creation: null,
    livemode: false,
    locale: null,
    metadata: {},
    mode: 'subscription',
    payment_intent: null,
    payment_link: null,
    payment_method_collection: 'if_required',
    payment_method_configuration_details: null,
    payment_method_options: null,
    payment_method_types: ['card'],
    payment_status: 'unpaid',
    phone_number_collection: { enabled: false },
    recovered_from: null,
    setup_intent: null,
    shipping_address_collection: null,
    shipping_cost: null,
    shipping_details: null,
    shipping_options: [],
    status: 'open',
    submit_type: null,
    subscription: null,
    success_url: 'https://example.com/success',
    total_details: {
      amount_discount: 0,
      amount_shipping: 0,
      amount_tax: 0,
    },
    ui_mode: 'hosted',
    url: 'https://checkout.stripe.com/test',
    ...overrides,
  } as Stripe.Checkout.Session;
}

/**
 * Create a mock Stripe billing portal session
 */
export function createMockPortalSession(
  overrides?: Partial<Stripe.BillingPortal.Session>,
): Stripe.BillingPortal.Session {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: 'bps_test123',
    object: 'billing_portal.session',
    configuration: 'bpc_test123',
    created: now,
    customer: 'cus_test123',
    flow: null,
    livemode: false,
    locale: null,
    on_behalf_of: null,
    return_url: 'https://example.com/billing',
    url: 'https://billing.stripe.com/session/test',
    ...overrides,
  } as Stripe.BillingPortal.Session;
}

/**
 * Create a mock Stripe webhook event
 */
export function createMockWebhookEvent(
  type: string,
  data: any,
  overrides?: Partial<Stripe.Event>,
): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: 'evt_test123',
    object: 'event',
    api_version: '2025-12-15.clover',
    created: now,
    data: {
      object: data,
      previous_attributes: undefined,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: 'req_test123',
      idempotency_key: null,
    },
    type,
    ...overrides,
  } as Stripe.Event;
}
