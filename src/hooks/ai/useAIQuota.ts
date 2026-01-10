import { useState, useEffect, useCallback } from 'react';
import { aiService, AIQuota } from '../../lib/aiService';
import { useUser } from '../../contexts/UserContext';

export interface UseAIQuotaReturn {
  quota: {
    total: number;
    remaining: number;
    used: number;
    base: number;
    bonus: number;
  };
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * AI 配额管理 Hook
 */
export function useAIQuota(): UseAIQuotaReturn {
  const { user } = useUser();
  const [quotaData, setQuotaData] = useState<AIQuota | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchQuota = useCallback(async () => {
    if (!user) {
      setQuotaData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await aiService.getQuota();
      setQuotaData(data);
    } catch (err) {
      console.error('[useAIQuota] Failed to fetch quota:', err);
      setError(err as Error);
      // 设置默认值
      setQuotaData({
        total_quota: 10,
        used_quota: 0,
        remaining_quota: 10,
        base_quota: 10,
        bonus_quota: 0
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 初始加载和用户变化时刷新
  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  // 定时刷新 (每分钟)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(fetchQuota, 60000);
    return () => clearInterval(interval);
  }, [user, fetchQuota]);

  // 转换为组件使用的格式
  const quota = quotaData ? {
    total: quotaData.total_quota,
    remaining: quotaData.remaining_quota,
    used: quotaData.used_quota,
    base: quotaData.base_quota,
    bonus: quotaData.bonus_quota
  } : {
    total: 10,
    remaining: 10,
    used: 0,
    base: 10,
    bonus: 0
  };

  return {
    quota,
    loading,
    error,
    refetch: fetchQuota
  };
}
