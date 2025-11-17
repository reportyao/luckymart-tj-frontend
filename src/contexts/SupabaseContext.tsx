import React, { createContext, useContext } from 'react';
import { supabase, authService, lotteryService, walletService, commissionService, showoffService } from '../lib/supabase';
import { Database } from '../types/supabase';

// 定义 Supabase 上下文的类型
interface SupabaseContextType {
  authService: typeof authService;
  supabase: typeof supabase;

  lotteryService: typeof lotteryService;
  walletService: typeof walletService;
  commissionService: typeof commissionService;

  showoffService: typeof showoffService;
  // 导出 Database 类型，方便在其他地方使用
  Database: Database;
}

// 创建上下文
const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

// 上下文提供者组件
export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const contextValue: SupabaseContextType = {
    authService,
    supabase,

    lotteryService,
    walletService,
    commissionService,

    showoffService,
    Database: {} as Database, // 仅用于类型提示，实际值不重要
  };

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
};

// 自定义 Hook，用于在组件中访问 Supabase 服务
export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
