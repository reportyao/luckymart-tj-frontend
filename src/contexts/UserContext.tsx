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
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [telegramUser] = useState<any>(null);

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
        await fetchWallets(currentUser.id);
      }
    } catch (error) {
      console.error('Failed to check session:', error);
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

  const authenticate = useCallback(async () => {
    if (!WebApp.initData) {
      console.warn('Telegram initData is not available for authentication.');
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

  const refreshWallets = useCallback(async () => {
    if (user) {
      await fetchWallets(user.id);
    }
  }, [user, fetchWallets]);

  const logout = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setWallets([]);
    toast.success('已退出登录');
  }, [authService]);

  const value: UserContextType = {
    user,
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
