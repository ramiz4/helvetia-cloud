import type Stripe from 'stripe';

/**
 * Mock Stripe client for testing
 * Provides in-memory implementations of Stripe API methods
 */

/**
 * Mock data stores
 */
const mockCustomers = new Map<string, Stripe.Customer>();
const mockSubscriptions = new Map<string, Stripe.Subscription>();
const mockInvoices = new Map<string, Stripe.Invoice>();
const mockCheckoutSessions = new Map<string, Stripe.Checkout.Session>();
const mockBillingPortalSessions = new Map<string, Stripe.BillingPortal.Session>();

let customerIdCounter = 1;
let subscriptionIdCounter = 1;
let invoiceIdCounter = 1;
let sessionIdCounter = 1;

/**
 * Reset all mock data stores
 * Call this in test setup (beforeEach) to ensure test isolation
 */
export function resetMockStripe(): void {
  mockCustomers.clear();
  mockSubscriptions.clear();
  mockInvoices.clear();
  mockCheckoutSessions.clear();
  mockBillingPortalSessions.clear();
  customerIdCounter = 1;
  subscriptionIdCounter = 1;
  invoiceIdCounter = 1;
  sessionIdCounter = 1;
}

/**
 * Mock Stripe Customer API
 */
export const mockStripeCustomers = {
  create: async (params: Stripe.CustomerCreateParams): Promise<Stripe.Customer> => {
    const id = `cus_test_${customerIdCounter++}`;
    const customer: Stripe.Customer = {
      id,
      object: 'customer',
      address: null,
      balance: 0,
      created: Math.floor(Date.now() / 1000),
      currency: null,
      default_source: null,
      delinquent: false,
      description: null,
      discount: null,
      email: params.email || null,
      invoice_prefix: 'INV',
      invoice_settings: {
        custom_fields: null,
        default_payment_method: null,
        footer: null,
        rendering_options: null,
      },
      livemode: false,
      metadata: params.metadata || {},
      name: params.name || null,
      next_invoice_sequence: 1,
      phone: null,
      preferred_locales: [],
      shipping: null,
      tax_exempt: 'none',
      test_clock: null,
    };

    mockCustomers.set(id, customer);
    return customer;
  },

  retrieve: async (id: string): Promise<Stripe.Customer> => {
    const customer = mockCustomers.get(id);
    if (!customer) {
      const error = new Error(`No such customer: ${id}`) as Error & {
        type: string;
        statusCode: number;
      };
      error.type = 'StripeInvalidRequestError';
      error.statusCode = 404;
      throw error;
    }
    return customer;
  },

  update: async (
    id: string,
    params: Stripe.CustomerUpdateParams,
  ): Promise<Stripe.Customer> => {
    const customer = await mockStripeCustomers.retrieve(id);
    const updated = {
      ...customer,
      email: params.email || customer.email,
      name: params.name || customer.name,
      metadata: params.metadata || customer.metadata,
    };
    mockCustomers.set(id, updated);
    return updated;
  },

  del: async (id: string): Promise<Stripe.DeletedCustomer> => {
    const customer = await mockStripeCustomers.retrieve(id);
    mockCustomers.delete(id);
    return {
      id: customer.id,
      object: 'customer',
      deleted: true,
    };
  },
};

/**
 * Mock Stripe Subscription API
 */
export const mockStripeSubscriptions = {
  create: async (
    params: Stripe.SubscriptionCreateParams,
  ): Promise<Stripe.Subscription> => {
    const id = `sub_test_${subscriptionIdCounter++}`;
    const now = Math.floor(Date.now() / 1000);
    const subscription: Stripe.Subscription = {
      id,
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
      customer:
        typeof params.customer === 'string' ? params.customer : params.customer.toString(),
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
        data: params.items
          ? params.items.map((item, index) => ({
              id: `si_test_${index}`,
              object: 'subscription_item' as const,
              billing_thresholds: null,
              created: now,
              discounts: [],
              metadata: {},
              price: {
                id: typeof item.price === 'string' ? item.price : 'price_test',
                object: 'price' as const,
                active: true,
                billing_scheme: 'per_unit' as const,
                created: now,
                currency: 'usd',
                custom_unit_amount: null,
                livemode: false,
                lookup_key: null,
                metadata: {},
                nickname: null,
                product: 'prod_test',
                recurring: {
                  aggregate_usage: null,
                  interval: 'month' as const,
                  interval_count: 1,
                  meter: null,
                  trial_period_days: null,
                  usage_type: 'licensed' as const,
                },
                tax_behavior: 'unspecified' as const,
                tiers_mode: null,
                transform_quantity: null,
                type: 'recurring' as const,
                unit_amount: 2000,
                unit_amount_decimal: '2000',
              },
              quantity: item.quantity || 1,
              subscription: id,
              tax_rates: [],
              // Add period fields to match what BillingService expects (even though they're not standard)
              current_period_start: now,
              current_period_end: now + 30 * 24 * 60 * 60,
            }))
          : [],
        has_more: false,
        url: `/v1/subscription_items?subscription=${id}`,
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
        save_default_payment_method: params.payment_settings?.save_default_payment_method || null,
      },
      pending_invoice_item_interval: null,
      pending_setup_intent: null,
      pending_update: null,
      plan: null,
      quantity: null,
      schedule: null,
      start_date: now,
      status: 'active',
      test_clock: null,
      transfer_data: null,
      trial_end: null,
      trial_settings: { end_behavior: { missing_payment_method: 'create_invoice' } },
      trial_start: null,
    };

    mockSubscriptions.set(id, subscription);
    return subscription;
  },

  retrieve: async (id: string): Promise<Stripe.Subscription> => {
    const subscription = mockSubscriptions.get(id);
    if (!subscription) {
      const error = new Error(`No such subscription: ${id}`) as Error & {
        type: string;
        statusCode: number;
      };
      error.type = 'StripeInvalidRequestError';
      error.statusCode = 404;
      throw error;
    }
    return subscription;
  },

  update: async (
    id: string,
    params: Stripe.SubscriptionUpdateParams,
  ): Promise<Stripe.Subscription> => {
    const subscription = await mockStripeSubscriptions.retrieve(id);
    const updated = {
      ...subscription,
      metadata: params.metadata || subscription.metadata,
      cancel_at_period_end:
        params.cancel_at_period_end !== undefined
          ? params.cancel_at_period_end
          : subscription.cancel_at_period_end,
    };
    mockSubscriptions.set(id, updated);
    return updated;
  },

  cancel: async (id: string): Promise<Stripe.Subscription> => {
    const subscription = await mockStripeSubscriptions.retrieve(id);
    const now = Math.floor(Date.now() / 1000);
    const canceled = {
      ...subscription,
      status: 'canceled' as const,
      canceled_at: now,
      ended_at: now,
    };
    mockSubscriptions.set(id, canceled);
    return canceled;
  },

  list: async (
    params?: Stripe.SubscriptionListParams,
  ): Promise<Stripe.ApiList<Stripe.Subscription>> => {
    const allSubscriptions = Array.from(mockSubscriptions.values());
    const filtered = params?.customer
      ? allSubscriptions.filter((sub) => sub.customer === params.customer)
      : allSubscriptions;

    return {
      object: 'list',
      data: filtered,
      has_more: false,
      url: '/v1/subscriptions',
    };
  },
};

/**
 * Mock Stripe Invoice API
 */
export const mockStripeInvoices = {
  create: async (params: Stripe.InvoiceCreateParams): Promise<Stripe.Invoice> => {
    const id = `in_test_${invoiceIdCounter++}`;
    const now = Math.floor(Date.now() / 1000);
    const invoice: Stripe.Invoice = {
      id,
      object: 'invoice',
      account_country: 'US',
      account_name: 'Test Account',
      account_tax_ids: null,
      amount_due: 2000,
      amount_paid: 0,
      amount_remaining: 2000,
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
      customer:
        typeof params.customer === 'string' ? params.customer : params.customer.toString(),
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
      description: params.description || null,
      discount: null,
      discounts: [],
      due_date: null,
      effective_at: null,
      ending_balance: null,
      footer: null,
      from_invoice: null,
      hosted_invoice_url: `https://invoice.stripe.com/i/test_${id}`,
      invoice_pdf: `https://invoice.stripe.com/i/test_${id}/pdf`,
      issuer: { type: 'self' },
      last_finalization_error: null,
      latest_revision: null,
      lines: {
        object: 'list',
        data: [],
        has_more: false,
        url: `/v1/invoices/${id}/lines`,
      },
      livemode: false,
      metadata: params.metadata || {},
      next_payment_attempt: null,
      number: null,
      on_behalf_of: null,
      paid: false,
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
      status: 'draft',
      status_transitions: {
        finalized_at: null,
        marked_uncollectible_at: null,
        paid_at: null,
        voided_at: null,
      },
      subscription: typeof params.subscription === 'string' ? params.subscription : null,
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
    };

    mockInvoices.set(id, invoice);
    return invoice;
  },

  retrieve: async (id: string): Promise<Stripe.Invoice> => {
    const invoice = mockInvoices.get(id);
    if (!invoice) {
      const error = new Error(`No such invoice: ${id}`) as Error & {
        type: string;
        statusCode: number;
      };
      error.type = 'StripeInvalidRequestError';
      error.statusCode = 404;
      throw error;
    }
    return invoice;
  },

  list: async (
    params?: Stripe.InvoiceListParams,
  ): Promise<Stripe.ApiList<Stripe.Invoice>> => {
    const allInvoices = Array.from(mockInvoices.values());
    const filtered = params?.customer
      ? allInvoices.filter((inv) => inv.customer === params.customer)
      : allInvoices;

    return {
      object: 'list',
      data: filtered,
      has_more: false,
      url: '/v1/invoices',
    };
  },
};

/**
 * Mock Stripe Checkout Session API
 */
export const mockStripeCheckout = {
  sessions: {
    create: async (
      params: Stripe.Checkout.SessionCreateParams,
    ): Promise<Stripe.Checkout.Session> => {
      const id = `cs_test_${sessionIdCounter++}`;
      const session: Stripe.Checkout.Session = {
        id,
        object: 'checkout.session',
        after_expiration: null,
        allow_promotion_codes: null,
        amount_subtotal: null,
        amount_total: null,
        automatic_tax: { enabled: false, liability: null, status: null },
        billing_address_collection: null,
        cancel_url: params.cancel_url || 'http://localhost:3000/billing',
        client_reference_id: null,
        client_secret: null,
        consent: null,
        consent_collection: null,
        created: Math.floor(Date.now() / 1000),
        currency: null,
        currency_conversion: null,
        custom_fields: [],
        custom_text: {
          after_submit: null,
          shipping_address: null,
          submit: null,
          terms_of_service_acceptance: null,
        },
        customer:
          typeof params.customer === 'string' ? params.customer : params.customer?.toString() || null,
        customer_creation: null,
        customer_details: null,
        customer_email: null,
        expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours from now
        invoice: null,
        invoice_creation: null,
        livemode: false,
        locale: null,
        metadata: params.metadata || {},
        mode: params.mode || 'subscription',
        payment_intent: null,
        payment_link: null,
        payment_method_collection: null,
        payment_method_configuration_details: null,
        payment_method_options: null,
        payment_method_types: ['card'],
        payment_status: 'unpaid',
        phone_number_collection: { enabled: false },
        recovered_from: null,
        redirect_on_completion: null,
        return_url: null,
        saved_payment_method_options: null,
        setup_intent: null,
        shipping_address_collection: null,
        shipping_cost: null,
        shipping_details: null,
        shipping_options: [],
        status: 'open',
        submit_type: null,
        subscription: null,
        success_url: params.success_url || 'http://localhost:3000/billing/success',
        total_details: null,
        ui_mode: 'hosted',
        url: `https://checkout.stripe.com/c/pay/test_${id}`,
      };

      mockCheckoutSessions.set(id, session);
      return session;
    },

    retrieve: async (id: string): Promise<Stripe.Checkout.Session> => {
      const session = mockCheckoutSessions.get(id);
      if (!session) {
        const error = new Error(`No such checkout session: ${id}`) as Error & {
          type: string;
          statusCode: number;
        };
        error.type = 'StripeInvalidRequestError';
        error.statusCode = 404;
        throw error;
      }
      return session;
    },
  },
};

/**
 * Mock Stripe Billing Portal Session API
 */
export const mockStripeBillingPortal = {
  sessions: {
    create: async (
      params: Stripe.BillingPortal.SessionCreateParams,
    ): Promise<Stripe.BillingPortal.Session> => {
      const id = `bps_test_${sessionIdCounter++}`;
      const session: Stripe.BillingPortal.Session = {
        id,
        object: 'billing_portal.session',
        configuration: 'bpc_test_default',
        created: Math.floor(Date.now() / 1000),
        customer:
          typeof params.customer === 'string' ? params.customer : params.customer.toString(),
        flow: null,
        livemode: false,
        locale: null,
        on_behalf_of: null,
        return_url: params.return_url || 'http://localhost:3000/billing',
        url: `https://billing.stripe.com/p/session/test_${id}`,
      };

      mockBillingPortalSessions.set(id, session);
      return session;
    },
  },
};

/**
 * Create a complete mock Stripe instance
 */
export function createMockStripe(): Partial<Stripe> {
  return {
    customers: mockStripeCustomers as unknown as Stripe.CustomersResource,
    subscriptions: mockStripeSubscriptions as unknown as Stripe.SubscriptionsResource,
    invoices: mockStripeInvoices as unknown as Stripe.InvoicesResource,
    checkout: mockStripeCheckout as unknown as Stripe.CheckoutResource,
    billingPortal: mockStripeBillingPortal as unknown as Stripe.BillingPortalResource,
  };
}

/**
 * Helper function to create a test customer with subscription
 */
export async function createTestCustomerWithSubscription(params: {
  email: string;
  name: string;
  priceId: string;
  metadata?: Record<string, string>;
}): Promise<{
  customer: Stripe.Customer;
  subscription: Stripe.Subscription;
}> {
  const customer = await mockStripeCustomers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata,
  });

  const subscription = await mockStripeSubscriptions.create({
    customer: customer.id,
    items: [{ price: params.priceId }],
  });

  return { customer, subscription };
}

/**
 * Helper function to get all mock data (for debugging)
 */
export function getMockData() {
  return {
    customers: Array.from(mockCustomers.values()),
    subscriptions: Array.from(mockSubscriptions.values()),
    invoices: Array.from(mockInvoices.values()),
    checkoutSessions: Array.from(mockCheckoutSessions.values()),
    billingPortalSessions: Array.from(mockBillingPortalSessions.values()),
  };
}
