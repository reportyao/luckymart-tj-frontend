import { useState, useEffect, useCallback } from 'react';
import { referralService, InviteStats } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';

export function useInviteStats() {
  const { user } = useUser();
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const statsData = await referralService.getInviteStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch invite stats:', err);
      setError(err as Error);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats
  };
}
