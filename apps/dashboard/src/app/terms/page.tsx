import type { TermsOfService } from '@/types/terms';
import { Calendar, Clock, FileText } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

async function fetchLatestTerms(language: string = 'en'): Promise<TermsOfService | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const url = `${baseUrl}/api/v1/terms/latest?language=${language}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(
        `Terms fetch failed for ${language}: ${response.status} ${response.statusText}`,
        { url },
      );
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      console.warn(`Terms API returned success=false for ${language}`, json);
      return null;
    }
    return json.data;
  } catch (error) {
    console.error(`Failed to fetch terms from ${url}:`, error);
    return null;
  }
}

interface TermsPageProps {
  searchParams: Promise<{ lang?: string }>;
}

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get('helvetia-lang')?.value;
  const language = params.lang || cookieLang || 'en';
  const terms = await fetchLatestTerms(language);

  if (!terms) {
    notFound();
  }

  // Fallback labels if translation loading is complex in server component
  // In a real app, we'd import the JSON or use a server-side i18n helper
  const titles: Record<string, string> = {
    en: 'Terms of Service',
    de: 'Nutzungsbedingungen',
    fr: "Conditions d'utilisation",
    it: 'Termini di servizio',
    gsw: 'Nutzigsbedingige',
  };

  const subtitles: Record<string, string> = {
    en: 'Helvetia Cloud Platform Agreement',
    de: 'Helvetia Cloud Plattform-Vereinbarung',
    fr: 'Accord de plateforme Helvetia Cloud',
    it: 'Accordo sulla piattaforma Helvetia Cloud',
    gsw: 'Helvetia Cloud Plattform-Veriiubarig',
  };

  const labels: Record<string, any> = {
    en: {
      version: 'Version',
      effectiveDate: 'Effective Date',
      lastUpdated: 'Last Updated',
      backToDashboard: 'Back to Dashboard',
    },
    de: {
      version: 'Version',
      effectiveDate: 'Gültig ab',
      lastUpdated: 'Zuletzt aktualisiert',
      backToDashboard: 'Zurück zum Dashboard',
    },
    fr: {
      version: 'Version',
      effectiveDate: "Date d'entrée en vigueur",
      lastUpdated: 'Dernière mise à jour',
      backToDashboard: 'Retour au tableau de bord',
    },
    it: {
      version: 'Versione',
      effectiveDate: 'Data di efficacia',
      lastUpdated: 'Ultimo aggiornamento',
      backToDashboard: 'Torna alla dashboard',
    },
    gsw: {
      version: 'Version',
      effectiveDate: 'Gültig ab',
      lastUpdated: 'Zuletzt aktualisiert',
      backToDashboard: 'Zrugg zum Dashboard',
    },
  };

  const t = labels[language] || labels.en;

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
                  {titles[language] || titles.en}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg font-medium mt-2">
                  {subtitles[language] || subtitles.en}
                </p>
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
                {t.version}
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
                {t.effectiveDate}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {new Date(terms.effectiveAt).toLocaleDateString(
                language === 'gsw' ? 'de-CH' : language,
                {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                },
              )}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                <Clock size={20} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {t.lastUpdated}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {new Date(terms.updatedAt).toLocaleDateString(
                language === 'gsw' ? 'de-CH' : language,
                {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                },
              )}
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
          {t.backToDashboard}
        </Link>
      </div>
    </div>
  );
}
