import { QueryClient } from '@tanstack/react-query';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: Data considered fresh for this duration
      staleTime: 1000 * 60 * 5, // 5 minutes
      
      // Cache time: Data kept in cache for this duration
      gcTime: 1000 * 60 * 30, // 30 minutes (renamed from cacheTime in v5)
      
      // Retry configuration
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch configuration  
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      
      // Network mode
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});

// Query keys for consistent cache management
export const queryKeys = {
  // User queries
  user: ['user'] as const,
  userProfile: (userId: string) => ['user', 'profile', userId] as const,
  userWallets: (userId: string) => ['user', 'wallets', userId] as const,
  
  // Lottery queries
  lotteries: {
    all: ['lotteries'] as const,
    lists: () => ['lotteries', 'list'] as const,
    list: (status?: string) => ['lotteries', 'list', { status }] as const,
    detail: (id: string) => ['lotteries', 'detail', id] as const,
    result: (id: string) => ['lotteries', 'result', id] as const,
  },
  
  // Prize queries
  prizes: {
    all: ['prizes'] as const,
    user: (userId: string) => ['prizes', 'user', userId] as const,
  },
  
  // Resale queries
  resales: {
    all: ['resales'] as const,
    lists: () => ['resales', 'list'] as const,
    user: (userId: string) => ['resales', 'user', userId] as const,
  },
  
  // Referral queries
  referrals: {
    stats: (userId: string) => ['referrals', 'stats', userId] as const,
    invited: (userId: string) => ['referrals', 'invited', userId] as const,
  },
  
  // Showoff queries
  showoffs: {
    all: ['showoffs'] as const,
    lists: () => ['showoffs', 'list'] as const,
    user: (userId: string) => ['showoffs', 'user', userId] as const,
  },
  
  // Payment queries
  paymentConfigs: ['payment', 'configs'] as const,
};

// Prefetch helpers
export const prefetchHelpers = {
  async prefetchLotteries(status?: string) {
    // Implementation would go here when we convert services to use React Query
    console.log('Prefetching lotteries:', status);
  },
  
  async prefetchUserData(userId: string) {
    console.log('Prefetching user data:', userId);
  },
};
