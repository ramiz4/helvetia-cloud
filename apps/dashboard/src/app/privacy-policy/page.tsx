import type { PrivacyPolicy } from '@/types/privacy';
import { Calendar, Clock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

async function fetchLatestPrivacyPolicy(language: string = 'en'): Promise<PrivacyPolicy | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const url = `${baseUrl}/api/v1/privacy-policy/latest?language=${language}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(
        `Privacy Policy fetch failed for ${language}: ${response.status} ${response.statusText}`,
        { url },
      );
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      console.warn(`Privacy Policy API returned success=false for ${language}`, json);
      return null;
    }
    return json.data;
  } catch (error) {
    console.error(`Failed to fetch privacy policy from ${url}:`, error);
    return null;
  }
}

interface PrivacyPageProps {
  searchParams: Promise<{ lang?: string }>;
}

export default async function PrivacyPage({ searchParams }: PrivacyPageProps) {
  const params = await searchParams;
  const language = params.lang || 'en';
  const policy = await fetchLatestPrivacyPolicy(language);

  if (!policy) {
    notFound();
  }

  return (
    <div className="py-8 animate-fade-in max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-start justify-between gap-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-lg">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Privacy Policy
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg font-medium mt-2">
                  How Helvetia Cloud handles your data
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
                <ShieldCheck size={20} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Version
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{policy.version}</p>
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
              {new Date(policy.effectiveAt).toLocaleDateString(undefined, {
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
              {new Date(policy.updatedAt).toLocaleDateString(undefined, {
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
        <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-a:text-emerald-500 dark:prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900 dark:prose-strong:text-white prose-code:text-emerald-500 dark:prose-code:text-emerald-400 prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-white/10 prose-li:text-slate-700 dark:prose-li:text-slate-300">
          <div className="whitespace-pre-wrap">{policy.content}</div>
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
