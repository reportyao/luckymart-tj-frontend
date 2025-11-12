// tRPC stub for frontend-only build
// Admin backend pages that use tRPC have been moved to src/pages/admin/
// This stub prevents build errors when tRPC is referenced but not used

// Stub implementation for any remaining tRPC references
export const trpc = {
  useQuery: () => ({ data: null, isLoading: false, error: null }),
  useMutation: () => ({ mutate: () => {}, isLoading: false }),
} as any;
