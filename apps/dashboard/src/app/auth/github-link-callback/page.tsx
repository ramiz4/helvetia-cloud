'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL, fetchWithAuth } from 'shared-ui';
import { getUserFriendlyErrorMessage, isApiError } from '../../../utils/apiErrors';

function GitHubLinkCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const linkGitHubAccount = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        toast.error(`GitHub authorization failed: ${error}`);
        setStatus('error');
        setTimeout(() => router.push('/settings'), 2000);
        return;
      }

      if (!code) {
        toast.error('No authorization code received');
        setStatus('error');
        setTimeout(() => router.push('/settings'), 2000);
        return;
      }

      try {
        const response = await fetchWithAuth(`${API_BASE_URL}/auth/github/link`, {
          method: 'POST',
          body: JSON.stringify({ code }),
        });

        if (response.ok) {
          toast.success('GitHub account linked successfully!');
          setStatus('success');
          // Redirect to settings after a brief delay
          setTimeout(() => router.push('/settings'), 1500);
        } else {
          const errorData = await response.json();
          const errorMessage = isApiError(errorData)
            ? getUserFriendlyErrorMessage(errorData)
            : errorData.error || 'Failed to link GitHub account';
          toast.error(errorMessage);
          setStatus('error');
          setTimeout(() => router.push('/settings'), 2000);
        }
      } catch (err) {
        console.error('GitHub link error:', err);
        toast.error('Failed to link GitHub account');
        setStatus('error');
        setTimeout(() => router.push('/settings'), 2000);
      }
    };

    linkGitHubAccount();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-xl dark:shadow-2xl text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Linking GitHub Account
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Please wait while we connect your GitHub account...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Successfully Linked!
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Your GitHub account has been connected. Redirecting...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-rose-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Link Failed</h2>
            <p className="text-slate-600 dark:text-slate-400">
              We couldn't link your GitHub account. Redirecting...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function GitHubLinkCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      }
    >
      <GitHubLinkCallbackContent />
    </Suspense>
  );
}
