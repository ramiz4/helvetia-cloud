'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/privacy-policy');
  }, [router]);

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <p className="text-center text-slate-600 dark:text-slate-400">Redirecting to Privacy Policy...</p>
    </div>
  );
}
