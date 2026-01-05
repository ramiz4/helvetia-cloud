'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { API_BASE_URL } from '../../../lib/config';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  useEffect(() => {
    if (!code) {
      router.push('/login');
      return;
    }

    const exchangeCode = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/github`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        if (data.token) {
          localStorage.setItem('token', data.token);
          if (data.accessToken) {
            localStorage.setItem('gh_token', data.accessToken);
          }
          localStorage.setItem('user', JSON.stringify(data.user));
          router.push('/');
        } else {
          console.error('Auth failed response:', JSON.stringify(data, null, 2));
          router.push(
            `/login?error=auth_failed&details=${encodeURIComponent(data.error || 'unknown')}`,
          );
        }
      } catch (err) {
        console.error('Network error', err);
        router.push('/login?error=network_error');
      }
    };

    exchangeCode();
  }, [code, router]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <div className="spinner"></div>
      <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
        Authenticating with GitHub...
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
