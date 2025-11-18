import { createClient } from '@supabase/supabase-js';
import { Database, Tables, Enums, Functions } from '../types/supabase';

// 导出常用的类型
export type Lottery = Tables<'lotteries'> & {
  name_i18n: Record<string, string> | null;
  description_i18n: Record<string, string> | null;
  details_i18n: Record<string, string> | null;
};


// 检查环境变量，优先使用 NEXT_PUBLIC_ (Next.js 风格) 或 VITE_ (Vite 风格)
const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key. Please check your .env.local file.');
}

// 创建 Supabase 客户端实例
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// 导出常用的类型

export type UserProfile = Tables<'user_profiles'>;
export type Wallet = Tables<'wallets'>;
export type Order = Tables<'orders'>;
export type Commission = Tables<'commissions'>;
export type DepositRequest = Tables<'deposit_requests'>;

export type WithdrawalRequest = Tables<'withdrawal_requests'>;
export type Showoff = Tables<'showoffs'>;

// 邀请/推荐相关类型
export type InviteStats = Functions<'get_user_referral_stats'>['Returns'][0];
export interface InvitedUser {
  id: string;
  username: string;
  avatar_url: string;
  created_at: string;
  level: number;
  commission_earned: number;
  total_spent: number;
}
export type Currency = Enums<'Currency'>;
export type LotteryStatus = Enums<'LotteryStatus'>;
export type ShowoffStatus = Enums<'ShowoffStatus'>;
export type OrderStatus = Enums<'OrderStatus'>;

// --- 数据服务层抽象 ---

/**
 * 认证服务
 */
export const authService = {
  /**
   * 使用 Telegram Mini App 的 initData 进行认证
   * @param initData Telegram Mini App 启动参数
   * @param startParam 启动参数 (可选)
   */
  async authenticateWithTelegram(initData: string, startParam?: string) {
    try {
      // 调用 Supabase Edge Function 进行认证
      const { data, error } = await supabase.functions.invoke('auth-telegram', {
        body: { initData, startParam }
      });
      
      if (error) {
        console.error('Telegram authentication failed:', error);
        throw new Error(`Telegram 认证失败: ${error.message}`);
      }
      // 假设 Edge Function 返回 { session: Session, user: User }
      return data as { session: any, user: UserProfile };
    } catch (error) {
      console.error('authenticateWithTelegram error:', error);
      throw error;
    }
  },

  /**
   * 获取当前登录用户
   */
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 获取用户 Profile
    const { data: profile, error } = await supabase
	      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to fetch user profile:', error);
      throw new Error(`获取用户资料失败: ${error.message}`);
    }

    return { ...user, ...profile };
  },

  /**
   * 登出
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out failed:', error);
      throw new Error(`登出失败: ${error.message}`);
    }
  }
};

/**
 * 夺宝/产品服务
 */
export const lotteryService: any = {
  /**
   * 获取所有夺宝列表
   */
  async getAllLotteries(): Promise<Lottery[]> {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch all lotteries:', error);
      throw new Error(`获取所有夺宝列表失败: ${error.message}`);
    }
    return data;
  },

  /**
   * 根据状态获取夺宝列表
   * @param status 夺宝状态 (ACTIVE, DRAWN, CANCELLED)
   */
  async getLotteriesByStatus(status: string): Promise<Lottery[]> {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .eq('status', status as LotteryStatus)
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error(`Failed to fetch lotteries with status ${status}:`, error);
      throw new Error(`获取夺宝列表失败: ${error.message}`);
    }
    return data;
  },

  /**
   * 获取所有活跃的夺宝列表
   */
  async getActiveLotteries(): Promise<Lottery[]> {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .in('status', ['ACTIVE' as LotteryStatus]) // 仅获取 ACTIVE 状态的
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch lotteries:', error);
      throw new Error(`获取夺宝列表失败: ${error.message}`);
    }
    return data;
  },

  /**
   * 获取单个夺宝详情
   * @param lotteryId 夺宝 ID
   */
  async getLotteryDetails(lotteryId: string): Promise<Lottery | null> {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', lotteryId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
      console.error('Failed to fetch lottery details:', error);
      throw new Error(`获取夺宝详情失败: ${error.message}`);
    }
    return data;
  },

  /**
   * 购买夺宝门票
   * @param lotteryId 夺宝 ID
   * @param ticketCount 购买数量
   */
  async purchaseTickets(lotteryId: string, ticketCount: number): Promise<Order> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    // 调用 Supabase 存储过程 place_lottery_order
    const { data, error } = await supabase.rpc('place_lottery_order', {
      p_user_id: user.id,
      p_lottery_id: lotteryId,
      p_ticket_count: ticketCount
    });

    if (error) {
      console.error('Lottery purchase failed:', error);
      throw new Error(`购买失败: ${error.message}`);
    }
    
    // 存储过程返回的是 order_id，我们需要获取完整的订单信息
    const orderId = data as string;
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Failed to fetch order details after purchase:', orderError);
      throw new Error(`购买成功但获取订单详情失败: ${orderError.message}`);
    }

    return orderData;
  },

  /**
   * 获取用户的夺宝订单记录
   * @param userId 用户 ID
   */
  async getLotteryResult(lotteryId: string) {
    const { data, error } = await supabase
	      .from('lottery_results')
      .select(
        `
	          *,
	          winner:tickets!lottery_results_winner_id_fkey (
	            ticket_number,
	            user_id,
	            profiles:user_profiles (username, avatar_url)
	          ),
	          lottery:lotteries (
	            title,
	            image_url,
	            ticket_price,
	            currency,
	            total_tickets,
	            sold_tickets
	          ),
	          my_tickets:tickets!tickets_lottery_id_fkey (
	            ticket_number,
	            user_id
	          )
        `
      )
      .eq('lottery_id', lotteryId) // 修正：应使用 lottery_id
      .single()

    if (error) {
      throw new Error(error.message)
    }

	    // 确保 winner 字段是一个对象而不是数组
	    const result = {
	      ...data,
	      winner: data.winner[0]
	    }

    return result
	  },

  async getUserOrders(userId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, lotteries(title, image_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch user orders:', error);
      throw new Error(`获取订单记录失败: ${error.message}`);
    }
    // 这里的类型需要手动处理一下，因为 select 包含了 join
    return data as any as Order[];
  }
};

/**
 * 钱包服务
 */
export const walletService = {
  /**
   * 获取用户所有钱包余额
   * @param userId 用户 ID
   */
  async getWallets(userId: string): Promise<Wallet[]> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Failed to fetch wallets:', error);
      throw new Error(`获取钱包失败: ${error.message}`);
    }
    return data;
  },

  /**
   * 获取特定货币的钱包余额
   * @param currency 货币类型
   */
  async getBalance(currency: Currency): Promise<number> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    // 调用 Supabase 存储过程 get_user_wallet_balance
               const { data, error } = await supabase.rpc("get_user_wallet_balance" as any, {
      p_user_id: user.id,
      p_currency: currency
    });

    if (error) {
      console.error('Failed to fetch balance:', error);
      throw new Error(`获取余额失败: ${error.message}`);
    }
    // 存储过程返回的是数字
                return parseFloat(data as any) || 0;
  },

  /**
   * 余额兑换（例如：佣金兑换为余额）
   * @param sourceWalletId 源钱包 ID
   * @param targetWalletId 目标钱包 ID
   * @param amount 兑换金额
   */
      async exchangeCoins(_sourceWalletType: string, _targetWalletType: string, _amount: number): Promise<{ success: boolean; error: any | null }> {
    // 这里的逻辑应该在后端实现，但根据数据库结构，我们可能需要一个 RPC 或 Edge Function 来处理
    // 假设有一个名为 'exchange_wallet_balance' 的 RPC
    // 由于没有找到对应的 RPC，我们暂时跳过或使用一个模拟的函数
        console.warn('ExchangeCoins function is a placeholder. Needs a backend RPC/Edge Function.');
    // 模拟一个成功的返回
    return { success: true, error: null };
    // throw new Error('兑换功能尚未实现后端接口');
  }
};

/**
 * 佣金服务
 */
export const commissionService = {
  /**
   * 获取用户的佣金记录
   * @param userId 用户 ID
   */
  async getCommissions(userId: string): Promise<Commission[]> {
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch commissions:', error);
      throw new Error(`获取佣金记录失败: ${error.message}`);
    }
    return data;
  }
};

/**
 * 邀请/推荐服务
 */
export const referralService = {
  /**
   * 获取用户的推荐统计数据
   * @param userId 用户 ID
   */
    async getInviteStats(userId: string): Promise<InviteStats | null> {
    const { data, error } = await supabase.rpc('get_user_referral_stats', {
      p_user_id: userId
    });

    if (error) {
      console.error('Failed to fetch referral stats:', error);
      throw new Error(`获取推荐统计失败: ${error.message}`);
    }
    // 存储过程返回的是一个包含统计信息的数组
        return data?.[0] || null;
  },

  /**
   * 获取用户邀请的用户列表
   * @param userId 用户 ID
   */
  async getInvitedUsers(_userId: string): Promise<InvitedUser[]> {
    // 这是一个模拟数据，因为没有找到对应的 RPC 或表结构
    // 实际应用中需要实现一个 Edge Function 或 RPC 来获取这些数据
    console.warn('getInvitedUsers is a placeholder and returns mock data.');
    return [
      // Mock data structure based on InvitePage.tsx usage
      {
        id: 'mock-1',
        username: 'InvitedUser1',
        avatar_url: 'https://i.pravatar.cc/150?img=1',
        created_at: new Date().toISOString(),
        level: 1,
        commission_earned: 15.50,
        total_spent: 155.00,
      },
      {
        id: 'mock-2',
        username: 'InvitedUser2',
        avatar_url: 'https://i.pravatar.cc/150?img=2',
        created_at: new Date().toISOString(),
        level: 2,
        commission_earned: 5.00,
        total_spent: 100.00,
      },
    ];
  }
};

/**
	 * 晒单服务 (Showoffs)
 */
	export const showoffService = {
  /**
	   * 获取已审核的晒单列表
   */
	  async getApprovedShowoffs(_filter: 'all' | 'following' | 'popular'): Promise<Showoff[]> {
	    // 暂时忽略 filter 逻辑，直接获取所有已审核晒单
	    // TODO: 实现 filter 逻辑
    const { data, error } = await supabase
	      .from('showoffs')
	      .select(
	        `
	          *,
	          lottery:lotteries (title, image_url, ticket_price, currency),
	          user_profile:user_profiles (username, avatar_url)
	        `
	      )
	      .eq('status', 'APPROVED' as ShowoffStatus)
      .order('created_at', { ascending: false });

    if (error) {
	      console.error('Failed to fetch showoffs:', error);
      throw new Error(`获取晒单列表失败: ${error.message}`);
    }
    // 这里的类型需要手动处理一下，因为 select 包含了 join
	    return data as any as Showoff[];
  },

  /**
   * 点赞/取消点赞
	   * @param showoffId 晒单 ID
   * @param userId 用户 ID
   */
	  async likeShowoff(showoffId: string): Promise<void> {
	    const user = await authService.getCurrentUser();
	    if (!user) throw new Error('用户未登录');
	    const userId = user.id;
	
	    const { error } = await supabase
	      .from('likes')
	      .insert({ post_id: showoffId, user_id: userId });
	
	    if (error) {
	      console.error('Failed to like showoff:', error);
	      throw new Error(`点赞失败: ${error.message}`);
	    }
	  },
	
	  async unlikeShowoff(showoffId: string): Promise<void> {
	    const user = await authService.getCurrentUser();
	    if (!user) throw new Error('用户未登录');
	    const userId = user.id;
	
	    const { error } = await supabase
	      .from('likes')
	      .delete()
	      .eq('post_id', showoffId)
	      .eq('user_id', userId);
	
	    if (error) {
	      console.error('Failed to unlike showoff:', error);
	      throw new Error(`取消点赞失败: ${error.message}`);
	    }
	  },
	
	  // 原始的 toggleLike 逻辑被拆分为 likeShowoff 和 unlikeShowoff
		  async toggleLike(showoffId: string, userId: string): Promise<boolean> {
		    // 检查是否已点赞
		    const { data: existingLike, error: fetchError } = await supabase
		      .from('likes')
		      .select('id')
		      .eq('post_id', showoffId)
		      .eq('user_id', userId)
		      .single();
		
		    if (fetchError && fetchError.code !== 'PGRST116') {
		      console.error('Failed to check like status:', fetchError);
		      throw new Error(`检查点赞状态失败: ${fetchError.message}`);
		    }
		
		    if (existingLike) {
		      // 取消点赞
		      const { error } = await supabase
		        .from('likes')
		        .delete()
		        .eq('id', existingLike.id);
		
		      if (error) {
		        console.error('Failed to unlike showoff:', error);
		        throw new Error(`取消点赞失败: ${error.message}`);
		      }
		      return false; // 已取消点赞
		    } else {
		      // 点赞
		      const { error } = await supabase
		        .from('likes')
		        .insert({ post_id: showoffId, user_id: userId });
		
		      if (error) {
		        console.error('Failed to like showoff:', error);
		        throw new Error(`点赞失败: ${error.message}`);
		      }
		      return true; // 已点赞
		    }
		  }
		};
