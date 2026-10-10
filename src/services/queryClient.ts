import { QueryClient } from '@tanstack/react-query';
import { HttpError } from './apiClient';

// One client for the whole app (App.tsx wraps the tree in its Provider). Network
// calls here are a small internal API, not a public one with flaky/rate-limited
// edges, so retries are off by default — a failed call surfaces immediately and
// each hook decides how to react, rather than silently retrying 3 times first.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // 4xx (bad session, not found, forbidden, validation) won't succeed on
        // retry; only give transient/server errors (5xx, network) one retry.
        if (error instanceof HttpError && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
