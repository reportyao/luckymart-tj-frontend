import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
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

// 安全地获取 Telegram WebApp，避免在非 Telegram 环境下报错
const getWebApp = () => {
  try {
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      return window.Telegram.WebApp;
    }
  } catch (e) {
    console.warn('[Telegram] Failed to access WebApp:', e);
  }
  // 返回一个安全的模拟对象
  return {
    initData: '',
    initDataUnsafe: {},
    ready: () => {},
    expand: () => {},
  };
};

// 合并 Supabase auth user 和 profile
export type User = UserProfile & { 
  email?: string;
  telegram_username?: string;
  is_verified?: boolean;
  kyc_level?: string;
  invite_code?: string;  // 兼容旧字段
  referral_code?: string;  // 新字段（优先使用）
};

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  wallets: Wallet[];
  isLoading: boolean;
  isAuthenticated: boolean;
  telegramUser: any;
  sessionToken: string | null;
  authenticate: () => Promise<void>;
  refreshWallets: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultContextValue: UserContextType = {
  user: null,
  profile: null,
  wallets: [],
  isLoading: true,
  isAuthenticated: false,
  telegramUser: null,
  sessionToken: null,
  authenticate: async () => {
    throw new Error('UserProvider not initialized');
  },
  refreshWallets: async () => {
    throw new Error('UserProvider not initialized');
  },
  logout: async () => {
    throw new Error('UserProvider not initialized');
  },
};

const UserContext = createContext<UserContextType>(defaultContextValue);
UserContext.displayName = 'UserContext';

export const useUser = () => {
  const context = useContext(UserContext);
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const { authService, walletService, supabase } = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [telegramUser] = useState<any>(null);
  const [hasAttemptedAuth, setHasAttemptedAuth] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const fetchWallets = useCallback(async (userId: string) => {
    try {
      const fetchedWallets = await walletService.getWallets(userId);
      setWallets(fetchedWallets);
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
    }
  }, [walletService]);

  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const storedToken = localStorage.getItem('custom_session_token');
      const storedUser = localStorage.getItem('custom_user');
      
      if (storedToken && storedUser) {
        console.log('[Session] Found stored session, validating...');
        const parsedUser = JSON.parse(storedUser);
        
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          
          // 优化：先检查本地存储的过期时间（如果有），减少不必要的网络请求
          // 如果没有存储过期时间，或者已经快过期了，再进行网络验证
          
          console.log('[Session] Restoring user from localStorage...');
          setUser(parsedUser as User);
          setSessionToken(storedToken);

          // 异步验证，不阻塞 UI
          fetch(
            `${supabaseUrl}/rest/v1/user_sessions?session_token=eq.${storedToken}&user_id=eq.${parsedUser.id}&select=*`,
            {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              }
            }
          ).then(async (response) => {
            if (response.ok) {
              const sessions = await response.json();
              if (!sessions || sessions.length === 0) {
                console.log('[Session] Session token invalid on server, clearing...');
                logout();
              } else {
                const sessionData = sessions[0];
                const expiresAt = new Date(sessionData.expires_at);
                if (expiresAt < new Date()) {
                  console.log('[Session] Session expired on server, clearing...');
                  logout();
                }
              }
            }
          }).catch(err => {
            console.warn('[Session] Network validation failed, keeping local session:', err);
          });
          
          // 已在上方恢复，此处仅保留日志
          console.log('[Session] Session restoration initiated');
          
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', parsedUser.id)
            .single();

          if (profileError) {
            console.error('Failed to fetch profile:', profileError);
          } else {
            setProfile(profileData as UserProfile);
          }

          await fetchWallets(parsedUser.id);
        } catch (error) {
          console.error('[Session] Error validating session:', error);
          localStorage.removeItem('custom_session_token');
          localStorage.removeItem('custom_user');
          setSessionToken(null);
          setUser(null);
          setProfile(null);
        }
      } else {
        console.log('[Session] No stored session found');
      }
    } catch (error) {
      console.error('Failed to check session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWallets, supabase]);

  const authenticate = useCallback(async () => {
    const WebApp = getWebApp();
    
    console.log('[Auth] Starting authentication...');
    console.log('[Auth] WebApp.initData:', WebApp.initData ? `${WebApp.initData.substring(0, 50)}...` : 'null');
    
    if (!WebApp.initData) {
      console.error('[Auth] Telegram initData is not available');
      return;
    }
    
    try {
      setIsLoading(true);
      const startParam = WebApp.initDataUnsafe?.start_param;
      console.log('[Auth] Calling authenticateWithTelegram...');
      const result = await authService.authenticateWithTelegram(WebApp.initData, startParam);
      console.log('[Auth] Authentication result:', result);
      
      const { user, session } = result;
      
      setUser(user as User);
      
      if (session && session.token) {
        console.log('[Auth] Saving session token to localStorage');
        setSessionToken(session.token);
        localStorage.setItem('custom_session_token', session.token);
        localStorage.setItem('custom_user', JSON.stringify(user));
      }
      
      if (user) {
        await fetchWallets(user.id);
      }
      toast.success(t('auth.loginSuccess'));
    } catch (error: any) {
      console.error('Authentication failed:', error);
      toast.error(error.message || t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [authService, fetchWallets, t]);

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
      const WebApp = getWebApp();
      
      if (isLoading) {
        return;
      }
      
      // 如果有 initData 但没有用户且没有 session token，尝试认证
      if (WebApp.initData && !user && !sessionToken && !hasAttemptedAuth) {
        console.log('[Auto Auth] No user or session, attempting authentication...');
        setHasAttemptedAuth(true);
        await authenticate();
      }
    };

    autoAuthenticate();
  }, [user, sessionToken, isLoading, hasAttemptedAuth, authenticate]);

  const refreshWallets = useCallback(async () => {
    if (user) {
      await fetchWallets(user.id);
    }
  }, [user, fetchWallets]);

  const logout = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setWallets([]);
    setSessionToken(null);
    localStorage.removeItem('custom_session_token');
    localStorage.removeItem('custom_user');
    toast.success(t('auth.loggedOut'));
  }, [authService, t]);

  const value: UserContextType = {
    user,
    profile,
    wallets,
    isLoading,
    isAuthenticated: !!user,
    telegramUser,
    sessionToken,
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
