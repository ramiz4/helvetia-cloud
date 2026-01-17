'use client';

import type { Invoice } from '@/types/billing';
import { Download, FileText } from 'lucide-react';

interface InvoiceListProps {
  invoices: Invoice[];
}

export function InvoiceList({ invoices }: InvoiceListProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'text-emerald-400 bg-emerald-500/10';
      case 'open':
        return 'text-amber-400 bg-amber-500/10';
      case 'void':
      case 'uncollectible':
        return 'text-slate-400 bg-slate-500/10';
      default:
        return 'text-slate-400 bg-slate-500/10';
    }
  };

  return (
    <div className="p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">Invoices</h3>
        <p className="text-slate-400 text-sm">Your billing history</p>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800/80 flex items-center justify-center mb-4">
            <FileText size={32} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                    <FileText size={24} className="text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-lg font-bold text-white">
                        {invoice.number || `Invoice ${invoice.id.slice(-8)}`}
                      </h4>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(invoice.status)}`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">{formatDate(invoice.created)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {formatAmount(invoice.amount_due, invoice.currency)}
                    </p>
                    {invoice.amount_paid > 0 && invoice.amount_paid < invoice.amount_due && (
                      <p className="text-sm text-slate-400">
                        Paid: {formatAmount(invoice.amount_paid, invoice.currency)}
                      </p>
                    )}
                  </div>

                  {invoice.invoice_pdf && (
                    <a
                      href={invoice.invoice_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-lg"
                      title="Download PDF"
                    >
                      <Download size={20} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
