import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import WebApp from '@twa-dev/sdk';
import toast from 'react-hot-toast';
import { useSupabase } from './SupabaseContext';
import { UserProfile, Wallet } from '../lib/supabase';

// 扩展 Window 接口以支持 Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

// 合并 Supabase auth user 和 profile
export type User = UserProfile & { 
  email?: string;
  telegram_username?: string;
  is_verified?: boolean;
  kyc_level?: string;
  invite_code?: string; // 添加缺失的 invite_code 字段
};

interface UserContextType {
  user: User | null;
  profile: UserProfile | null; // 添加 profile 字段
  wallets: Wallet[];
  isLoading: boolean;
  isAuthenticated: boolean;
  telegramUser: any;
  authenticate: () => Promise<void>;
  refreshWallets: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);
UserContext.displayName = 'UserContext';

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { authService, walletService, supabase } = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null); // 添加 profile 状态
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [telegramUser] = useState<any>(null);
  const [hasAttemptedAuth, setHasAttemptedAuth] = useState(false); // 记录是否已尝试认证

  const fetchWallets = useCallback(async (userId: string) => {
    try {
      const fetchedWallets = await walletService.getWallets(userId);
      setWallets(fetchedWallets);
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
      toast.error('获取钱包信息失败');
    }
  }, [walletService]);

  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser as User);
        // 假设 currentUser 已经包含了 profile 数据，或者我们单独获取
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (profileError) {
          console.error('Failed to fetch profile:', profileError);
        } else {
          setProfile(profileData as UserProfile);
        }

        await fetchWallets(currentUser.id);
      }
    } catch (error) {
      console.error('Failed to check session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authService, fetchWallets]);

  const authenticate = useCallback(async () => {
    console.log('[Auth] Starting authentication...');
    console.log('[Auth] WebApp.initData:', WebApp.initData ? `${WebApp.initData.substring(0, 50)}...` : 'null');
    console.log('[Auth] WebApp.initDataUnsafe:', WebApp.initDataUnsafe);
    
    if (!WebApp.initData) {
      console.error('[Auth] Telegram initData is not available');
      console.error('[Auth] This usually means:');
      console.error('[Auth] 1. Not running in Telegram environment');
      console.error('[Auth] 2. Telegram SDK not loaded properly');
      console.error('[Auth] 3. Mini App not configured correctly');
      toast.error('无法连接到 Telegram，请确保在 Telegram 中打开');
      return;
    }
    try {
      setIsLoading(true);
      const startParam = WebApp.initDataUnsafe.start_param;
      const { user } = await authService.authenticateWithTelegram(WebApp.initData, startParam);
      setUser(user as User);
      if (user) {
        await fetchWallets(user.id);
      }
      toast.success('登录成功！');
    } catch (error: any) {
      console.error('Authentication failed:', error);
      toast.error(error.message || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [authService, fetchWallets]);

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      checkSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkSession, supabase]);

  // 自动认证：如果有 initData 但没有用户，尝试自动登录
  useEffect(() => {
    const autoAuthenticate = async () => {
      // 只在有 initData、没有当前用户、未尝试过认证时执行
      if (WebApp.initData && !user && !isLoading && !hasAttemptedAuth) {
        console.log('[Auto Auth] Attempting automatic authentication...');
        setHasAttemptedAuth(true); // 标记已尝试
        await authenticate();
      }
    };

    autoAuthenticate();
  }, [user, isLoading, hasAttemptedAuth, authenticate]);

  const refreshWallets = useCallback(async () => {
    if (user) {
      await fetchWallets(user.id);
    }
  }, [user, fetchWallets]);

  const logout = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null); // 登出时清空 profile
    setWallets([]);
    toast.success('已退出登录');
  }, [authService]);

  const value: UserContextType = {
    user,
    profile, // 暴露 profile
    wallets,
    isLoading,
    isAuthenticated: !!user,
    telegramUser,
    authenticate,
    refreshWallets,
    logout,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};
