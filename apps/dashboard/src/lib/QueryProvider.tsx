'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes (previously cacheTime)
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

declare global {
  var queryClient: QueryClient | undefined;
}

const getQueryClient = () => {
  if (typeof window === 'undefined') {
    // Always create a new QueryClient for each server-side request
    return makeQueryClient();
  }

  if (!globalThis.queryClient) {
    globalThis.queryClient = makeQueryClient();
  }

  return globalThis.queryClient;
};

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
