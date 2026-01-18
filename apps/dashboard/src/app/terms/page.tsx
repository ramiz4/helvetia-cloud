import type { TermsOfService } from '@/types/terms';
import { Calendar, Clock, FileText, Globe } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

async function fetchLatestTerms(language: string = 'en'): Promise<TermsOfService | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const response = await fetch(`${apiUrl}/terms/latest?language=${language}`, {
      cache: 'no-store', // Always fetch fresh terms
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Failed to fetch terms:', error);
    return null;
  }
}

interface TermsPageProps {
  searchParams: Promise<{ lang?: string }>;
}

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const params = await searchParams;
  const language = params.lang || 'en';
  const terms = await fetchLatestTerms(language);

  if (!terms) {
    notFound();
  }

  const languages = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  ];

  return (
    <div className="py-8 animate-fade-in max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-start justify-between gap-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-lg">
                <FileText size={32} />
              </div>
              <div>
                <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Terms of Service
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg font-medium mt-2">
                  Helvetia Cloud Platform Agreement
                </p>
              </div>
            </div>
          </div>

          {/* Language Selector */}
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-2 shadow-lg">
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-slate-400 ml-2" />
              <div className="flex gap-1">
                {languages.map((lang) => (
                  <Link
                    key={lang.code}
                    href={`/terms?lang=${lang.code}`}
                    className={`
                      px-3 py-2 rounded-xl font-semibold text-sm transition-all
                      ${
                        language === lang.code
                          ? 'bg-indigo-500 text-white shadow-md'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      }
                    `}
                    title={lang.label}
                  >
                    {lang.flag}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center">
                <FileText size={20} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Version
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{terms.version}</p>
          </div>

          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center">
                <Calendar size={20} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Effective Date
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {new Date(terms.effectiveDate).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                <Clock size={20} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Last Updated
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {new Date(terms.updatedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-12 shadow-2xl mb-8">
        <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-a:text-indigo-500 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900 dark:prose-strong:text-white prose-code:text-indigo-500 dark:prose-code:text-indigo-400 prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-white/10 prose-li:text-slate-700 dark:prose-li:text-slate-300">
          <div className="whitespace-pre-wrap">{terms.content}</div>
        </article>
      </div>

      {/* Back to Dashboard */}
      <div className="flex justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-lg"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
