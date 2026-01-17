import type { Invoice } from '@/types/billing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InvoiceList } from './InvoiceList';

describe('InvoiceList', () => {
  const mockInvoices: Invoice[] = [
    {
      id: 'in_123',
      number: 'INV-001',
      status: 'paid',
      created: 1704067200, // Jan 1, 2024
      amount_due: 9900,
      amount_paid: 9900,
      currency: 'usd',
      hosted_invoice_url: 'https://stripe.com/invoice',
      invoice_pdf: 'https://stripe.com/invoice.pdf',
    },
    {
      id: 'in_124',
      number: 'INV-002',
      status: 'open',
      created: 1706745600, // Feb 1, 2024
      amount_due: 2900,
      amount_paid: 0,
      currency: 'usd',
      hosted_invoice_url: null,
      invoice_pdf: null,
    },
  ];

  it('should render invoice list title', () => {
    render(<InvoiceList invoices={mockInvoices} />);

    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText('Your billing history')).toBeInTheDocument();
  });

  it('should render all invoices', () => {
    render(<InvoiceList invoices={mockInvoices} />);

    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('INV-002')).toBeInTheDocument();
  });

  it('should render invoice amounts correctly', () => {
    render(<InvoiceList invoices={mockInvoices} />);

    expect(screen.getByText('$99.00')).toBeInTheDocument();
    expect(screen.getByText('$29.00')).toBeInTheDocument();
  });

  it('should render invoice statuses', () => {
    render(<InvoiceList invoices={mockInvoices} />);

    expect(screen.getByText('paid')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
  });

  it('should render download link when PDF is available', () => {
    render(<InvoiceList invoices={mockInvoices} />);

    const downloadLinks = screen.getAllByTitle('Download PDF');
    expect(downloadLinks).toHaveLength(1);
    expect(downloadLinks[0]).toHaveAttribute('href', 'https://stripe.com/invoice.pdf');
  });

  it('should not render download link when PDF is not available', () => {
    const invoiceWithoutPdf: Invoice[] = [
      {
        ...mockInvoices[1],
        invoice_pdf: null,
      },
    ];

    render(<InvoiceList invoices={invoiceWithoutPdf} />);

    expect(screen.queryByTitle('Download PDF')).not.toBeInTheDocument();
  });

  it('should show "No invoices yet" message when invoices are empty', () => {
    render(<InvoiceList invoices={[]} />);

    expect(screen.getByText('No invoices yet')).toBeInTheDocument();
  });

  it('should show correct status colors', () => {
    render(<InvoiceList invoices={mockInvoices} />);

    const paidBadge = screen.getByText('paid');
    const openBadge = screen.getByText('open');

    expect(paidBadge).toHaveClass('text-emerald-400');
    expect(openBadge).toHaveClass('text-amber-400');
  });
});
