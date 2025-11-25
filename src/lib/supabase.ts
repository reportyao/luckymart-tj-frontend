import { createClient } from '@supabase/supabase-js';
import { Database, Tables, Functions } from '../types/supabase';

// 导出常用的类型
export type Lottery = Tables<'lotteries'>;


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
// export type DepositRequest = Tables<'deposit_requests'>; // 暂时注释，避免类型错误

// export type WithdrawalRequest = Tables<'withdrawal_requests'>; // 暂时注释，避免类型错误
export type Showoff = Tables<'showoffs'>;
export type ShowoffWithDetails = Showoff & {
  user: UserProfile | null;
  lottery: Lottery | null;
  is_liked: boolean;
  likes_count: number;
};



// 邀请/推荐相关类型
export type InviteStats = Functions<'get_user_referral_stats'>['Returns'][0] & {
  first_deposit_bonus_status: string;
  first_deposit_bonus_amount: number;
  first_deposit_bonus_expire_at: string | null;
  activation_share_count: number;
  activation_invite_count: number;
};
export interface InvitedUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  level: number; // 1, 2, or 3
  commission_earned: number;
  total_spent: number;
}

export type Currency = Tables<'wallets'>['currency'];
export type LotteryStatus = Tables<'lotteries'>['status'];
export type ShowoffStatus = Tables<'showoffs'>['status'];
export type OrderStatus = Tables<'orders'>['status'];

// --- 数据服务层抽象 ---

/**
 * 点赞服务
 */
export const likeService = {
  /**
   * 检查用户是否点赞了某个晒单
   * @param showoffId 晒单 ID
   */
  async isLiked(showoffId: string): Promise<boolean> {
    const user = await authService.getCurrentUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('showoff_id', showoffId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to check like status:', error);
      throw new Error(`检查点赞状态失败: ${error.message}`);
    }

    return !!data;
  },

  /**
   * 点赞某个晒单
   * @param showoffId 晒单 ID
   */
  async likeShowoff(showoffId: string): Promise<void> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { error } = await supabase
      .from('likes')
      .insert({ user_id: user.id, showoff_id: showoffId });

    if (error) {
      console.error('Failed to like showoff:', error);
      throw new Error(`点赞失败: ${error.message}`);
    }
  },

  /**
   * 取消点赞某个晒单
   * @param showoffId 晒单 ID
   */
  async unlikeShowoff(showoffId: string): Promise<void> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', user.id)
      .eq('showoff_id', showoffId);

    if (error) {
      console.error('Failed to unlike showoff:', error);
      throw new Error(`取消点赞失败: ${error.message}`);
    }
  }
};

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
      
      // Edge Function 返回的数据结构是 { data: { user, wallets, session, ... } }
      if (!data || !data.data) {
        throw new Error('Invalid response from auth-telegram function');
      }
      
      return {
        user: data.data.user,
        session: data.data.session,
        wallets: data.data.wallets,
        is_new_user: data.data.is_new_user
      };
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
    const { data, error } = await supabase.rpc('place_lottery_order' as any, {
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
  async getLotteryResult(lotteryId: string): Promise<any> {
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
		      winner: data.winner ? (data.winner as any)[0] : null
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
   * 余额兑换（单向：余额 -> 夺宝币）
   * @param amount 兑换金额
   */
  async exchangeRealToBonus(amount: number): Promise<{ success: boolean; new_balance?: number }> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await supabase.functions.invoke('exchange-balance', {
      body: { amount }
    });

    if (error) {
      console.error('Failed to exchange balance:', error);
      throw new Error(`兑换失败: ${error.message}`);
    }
    
    return data as { success: boolean; new_balance?: number };
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
    async getInviteStats(): Promise<InviteStats | null> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await supabase.functions.invoke('get-user-referral-stats');

    if (error) {
      console.error('Failed to fetch referral stats:', error);
      throw new Error(`获取推荐统计失败: ${error.message}`);
    }
    
    return data.data as InviteStats;
  },

  /**
   * 获取用户邀请的用户列表
   */
  async getInvitedUsers(): Promise<InvitedUser[]> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await supabase.functions.invoke('get-invited-users');

    if (error) {
      console.error('Failed to fetch invited users:', error);
      throw new Error(`获取邀请用户列表失败: ${error.message}`);
    }
    
    return data.data as InvitedUser[];
  },

  /**
   * 记录分享事件
   * @param shareType 分享类型
   * @param shareTarget 分享目标
   * @param shareData 分享数据
   */
  async logShareEvent(shareType: string, shareTarget: string, shareData: any): Promise<void> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { error } = await supabase.functions.invoke('log-share-event', {
      body: { share_type: shareType, share_target: shareTarget, share_data: shareData }
    });

    if (error) {
      console.error('Failed to log share event:', error);
      throw new Error(`记录分享事件失败: ${error.message}`);
    }
  },

  /**
   * 激活首充奖励
   */
  async activateFirstDepositBonus(): Promise<{ success: boolean; bonus_amount?: number }> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await supabase.functions.invoke('activate-first-deposit-bonus');

    if (error) {
      console.error('Failed to activate bonus:', error);
      throw new Error(`激活奖励失败: ${error.message}`);
    }
    
    return data as { success: boolean; bonus_amount?: number };
  },
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
	    
	
	    const { error } = await supabase
	      .from('likes')
       .insert({ showoff_id: showoffId, user_id: user.id });
	
	    if (error) {
	      console.error('Failed to like showoff:', error);
	      throw new Error(`点赞失败: ${error.message}`);
	    }
	  },
	
	  async unlikeShowoff(showoffId: string): Promise<void> {
	    const user = await authService.getCurrentUser();
	    if (!user) throw new Error('用户未登录');
	    
	
    const { error } = (await supabase
      .from('likes')
      .delete()
      .eq('post_id', showoffId)
      .eq('user_id', user.id)) as any;
	
	    if (error) {
	      console.error('Failed to unlike showoff:', error);
	      throw new Error(`取消点赞失败: ${error.message}`);
	    }
	  },
	
	  // 原始的 toggleLike 逻辑被拆分为 likeShowoff 和 unlikeShowoff
		  async toggleLike(showoffId: string): Promise<void> {
		    const user = await authService.getCurrentUser();
		    if (!user) throw new Error('用户未登录');

			    const { data: existingLike, error: selectError } = await supabase
			      .from('likes')
			      .select('id')
			      .eq('showoff_id', showoffId)
			      .eq('user_id', user.id)
			      .single();
		
			    if (selectError && selectError.code !== 'PGRST116') {
			      console.error('Failed to check like status:', selectError);
			      throw new Error(`检查点赞状态失败: ${selectError.message}`);
		    }
				    if (existingLike) {
			      // 取消点赞
			      const { error } = await supabase
			        .from('likes')
			        .delete()
			        .eq('showoff_id', showoffId)
			        .eq('user_id', user.id);
			
			      if (error) {
			        console.error('Failed to unlike showoff:', error);
			        throw new Error(`取消点赞失败: ${error.message}`);
			      }
			    } else {
			      // 点赞
			      const { error } = await supabase
			        .from('likes')
			        .insert({ showoff_id: showoffId, user_id: user.id });
			
			      if (error) {
			        console.error('Failed to like showoff:', error);
				        throw new Error(`点赞失败: ${error.message}`);
				      }
				    }
			  }
		};
