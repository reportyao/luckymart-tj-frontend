import { createClient } from '@supabase/supabase-js';
import { Database, Tables } from '../types/supabase';

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

// Helper 函数：获取带有自定义 session token 的请求选项
function getAuthHeaders() {
  const sessionToken = localStorage.getItem('custom_session_token');
  if (sessionToken) {
    return {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      }
    };
  }
  return {};
}

// 导出常用的类型

export type UserProfile = Tables<'users'>;
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
  lottery_title?: string;
  reward_coins?: number;
};



// 邀请/推荐相关类型
export interface InviteStats {
  total_invites: number;
  total_referrals: number;
  level1_referrals: number;
  level2_referrals: number;
  level3_referrals: number;
  total_commission: number;
  pending_commission: number;
  paid_commission: number;
  bonus_balance: number;
  first_deposit_bonus_status?: string;
  first_deposit_bonus_amount?: number;
  first_deposit_bonus_expire_at?: string | null;
  activation_share_count?: number;
  activation_invite_count?: number;
}
export interface InvitedUser {
  id: string;
  telegram_username: string | null;
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
      .eq('post_id', showoffId)
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
      .insert({ user_id: user.id, post_id: showoffId });

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
      .eq('post_id', showoffId);

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
      
      // 添加字段映射：referral_code -> invite_code
      const user = {
        ...data.data.user,
        invite_code: data.data.user.referral_code // 映射字段
      };
      
      return {
        user,
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
	      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to fetch user profile:', error);
      throw new Error(`获取用户资料失败: ${error.message}`);
    }

    // 添加字段映射：referral_code -> invite_code
    return { 
      ...user, 
      ...profile,
      invite_code: profile.referral_code // 映射字段
    };
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
 * 积分商城/产品服务
 */
export const lotteryService: any = {
  /**
   * 获取所有积分商城列表
   */
  async getAllLotteries(): Promise<Lottery[]> {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to fetch all lotteries:', error);
      throw new Error(`获取所有积分商城列表失败: ${error.message}`);
    }
    return data;
  },

  /**
   * 根据状态获取积分商城列表
   * @param status 积分商城状态 (ACTIVE, DRAWN, CANCELLED)
   */
  async getLotteriesByStatus(status: string): Promise<Lottery[]> {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .eq('status', status as LotteryStatus)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(`Failed to fetch lotteries with status ${status}:`, error);
      throw new Error(`获取积分商城列表失败: ${error.message}`);
    }
    return data;
  },

  /**
   * 获取所有活跃的积分商城列表
   */
  async getActiveLotteries(): Promise<Lottery[]> {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .in('status', ['ACTIVE' as LotteryStatus]) // 仅获取 ACTIVE 状态的
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to fetch lotteries:', error);
      throw new Error(`获取积分商城列表失败: ${error.message}`);
    }
    return data;
  },

  /**
   * 获取单个积分商城详情
   * @param lotteryId 积分商城 ID
   */
  async getLotteryDetails(lotteryId: string): Promise<Lottery | null> {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', lotteryId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
      console.error('Failed to fetch lottery details:', error);
      throw new Error(`获取积分商城详情失败: ${error.message}`);
    }
    return data;
  },

  /**
   * 购买积分商城门票
   * @param lotteryId 积分商城 ID
   * @param ticketCount 购买数量
   */
  async purchaseTickets(lotteryId: string, ticketCount: number, userId?: string): Promise<Order> {
    // 从 localStorage 获取 session token
    const sessionToken = localStorage.getItem('custom_session_token');
    if (!sessionToken) {
      throw new Error('用户未登录');
    }

    // 调用 lottery-purchase Edge Function
    const { data, error } = await supabase.functions.invoke('lottery-purchase', {
      body: {
        lotteryId,
        quantity: ticketCount,
        paymentMethod: 'LUCKY_COIN_WALLET', // 默认使用积分支付
        session_token: sessionToken
      }
    });

    if (error) {
      console.error('Lottery purchase failed:', error);
      throw new Error(`购买失败: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(`购买失败: ${data.error}`);
    }

    return data?.order || data;
  },

  /**
   * 获取用户的积分商城订单记录
   * @param userId 用户 ID
   */
    async getLotteryResult(lotteryId: string): Promise<any> {
    const { data, error } = await supabase
      .from('lottery_results')
      .select(
        `
          *,
          lottery:lotteries (
            title,
            image_url,
            ticket_price,
            currency,
            total_tickets,
            sold_tickets
          )
        `
      )
      .eq('lottery_id', lotteryId)
      .single()
    if (error) {
      throw new Error(error.message)
    }
    return data
  },

  /**
   * 执行开奖
   * @param lotteryId 积分商城 ID
   */
  async drawLottery(lotteryId: string): Promise<any> {
    const { data, error } = await supabase.rpc('draw_lottery' as any, {
      p_lottery_id: lotteryId
    });

    if (error) {
      console.error('Draw lottery failed:', error);
      throw new Error(`开奖失败: ${error.message}`);
    }

    return data;
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
   * 余额兑换（单向：余额 -> 积分商城币）
   * @param amount 兑换金额
   */
  async exchangeRealToBonus(amount: number): Promise<{ success: boolean; new_balance?: number }> {
    // 从 localStorage 获取 session token
    const sessionToken = localStorage.getItem('custom_session_token');
    console.log('[Debug] exchangeRealToBonus called');
    console.log('[Debug] Session token:', sessionToken ? `${sessionToken.substring(0, 8)}...` : 'null');
    console.log('[Debug] Amount:', amount);
    
    if (!sessionToken) {
      console.error('[Debug] No session token found in localStorage');
      throw new Error('用户未登录');
    }

    const requestBody = { 
      session_token: sessionToken,
      amount 
    };
    console.log('[Debug] Request body:', requestBody);

    const { data, error } = await supabase.functions.invoke('exchange-balance', {
      body: requestBody
    });
    
    console.log('[Debug] Response data:', data);
    console.log('[Debug] Response error:', error);

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

    const sessionToken = localStorage.getItem('custom_session_token');
    if (!sessionToken) throw new Error('未授权：缺少 session_token');

    const { data, error } = await supabase.functions.invoke('get-user-referral-stats', {
      body: { session_token: sessionToken }
    });

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

    const sessionToken = localStorage.getItem('custom_session_token');
    if (!sessionToken) throw new Error('未授权：缺少 session_token');

    const { data, error } = await supabase.functions.invoke('get-invited-users', {
      body: { session_token: sessionToken }
    });

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
  async getApprovedShowoffs(_filter: 'all' | 'following' | 'popular', userId?: string): Promise<Showoff[]> {
    // 暂时忽略 filter 逻辑，直接获取所有已审核晒单
    // TODO: 实现 filter 逻辑
    
    // 1. 查询晒单列表
    const { data: showoffs, error } = await supabase
      .from('showoffs')
      .select('*')
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch showoffs:', error);
      throw new Error(`获取晒单列表失败: ${error.message}`);
    }

    if (!showoffs || showoffs.length === 0) {
      return [];
    }

    // 2. 批量查询用户信息
    const userIds = [...new Set(showoffs.map(s => s.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, telegram_username, avatar_url')
      .in('id', userIds);
    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // 3. 批量查询积分商城信息
    const lotteryIds = [...new Set(showoffs.map(s => s.lottery_id).filter(Boolean))];
    const { data: lotteries } = await supabase
      .from('lotteries')
      .select('id, title')
      .in('id', lotteryIds);
    const lotteryMap = new Map(lotteries?.map(l => [l.id, l]) || []);

    // 4. 如果有 userId，查询用户的点赞状态
    let likedIds = new Set<string>();
    if (userId) {
      const showoffIds = showoffs.map(s => s.id);
      const { data: likes } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', showoffIds);
      likedIds = new Set(likes?.map(l => l.post_id) || []);
    }

    // 5. 组装数据
    return showoffs.map(showoff => {
      const user = userMap.get(showoff.user_id);
      const lottery = lotteryMap.get(showoff.lottery_id);
      return {
        ...showoff,
        user: user || null,
        lottery: lottery || null,
        is_liked: likedIds.has(showoff.id),
        lottery_title: lottery?.title || ''
      };
    }) as any as Showoff[];
  },

  /**
   * 点赞/取消点赞
	   * @param showoffId 晒单 ID
   * @param userId 用户 ID
   */
  async likeShowoff(showoffId: string, userId?: string): Promise<void> {
    let uid = userId;
    if (!uid) {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('用户未登录');
      uid = user.id;
    }

    const { error } = await supabase
      .from('likes')
      .insert({ post_id: showoffId, user_id: uid });

    // 如果是重复点赞错误，忽略它（用户已经点赞过）
    if (error && error.code !== '23505') {
      console.error('Failed to like showoff:', error);
      throw new Error(`点赞失败: ${error.message}`);
    }

    // 如果不是重复点赞，更新 likes_count
    if (!error) {
      const { error: updateError } = await supabase.rpc('increment_likes_count', { showoff_id: showoffId });
      if (updateError) {
        console.error('Failed to update likes_count:', updateError);
      }
    }
  },
	
  async unlikeShowoff(showoffId: string, userId?: string): Promise<void> {
    let uid = userId;
    if (!uid) {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('用户未登录');
      uid = user.id;
    }

    const { error } = (await supabase
      .from('likes')
      .delete()
      .eq('post_id', showoffId)
      .eq('user_id', uid)) as any;
	
	    if (error) {
	      console.error('Failed to unlike showoff:', error);
	      throw new Error(`取消点赞失败: ${error.message}`);
	    }

      // 更新 likes_count
      const { error: updateError } = await supabase.rpc('decrement_likes_count', { showoff_id: showoffId });
      if (updateError) {
        console.error('Failed to update likes_count:', updateError);
      }
	  },
	
	  // 原始的 toggleLike 逻辑被拆分为 likeShowoff 和 unlikeShowoff
		  async toggleLike(showoffId: string): Promise<void> {
		    const user = await authService.getCurrentUser();
		    if (!user) throw new Error('用户未登录');

    const { data: existingLike, error: selectError } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', showoffId)
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
        .eq('post_id', showoffId)
        .eq('user_id', user.id);
			
			      if (error) {
			        console.error('Failed to unlike showoff:', error);
			        throw new Error(`取消点赞失败: ${error.message}`);
			      }
			    } else {
			      // 点赞
      const { error } = await supabase
        .from('likes')
        .insert({ post_id: showoffId, user_id: user.id });
			
			      if (error) {
			        console.error('Failed to like showoff:', error);
				        throw new Error(`点赞失败: ${error.message}`);
				      }
				    }
			  },

  /**
   * 创建晒单
   */
  async createShowoff(params: {
    prize_id?: string;
    lottery_id: string;
    content: string;
    images: string[];
    user_id?: string;
  }): Promise<Showoff> {
    let userId = params.user_id;
    if (!userId) {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('用户未登录');
      userId = user.id;
    }

    const { data, error } = await supabase
      .from('showoffs')
      .insert({
        user_id: userId,
        prize_id: params.prize_id,
        lottery_id: params.lottery_id,
        content: params.content,
        images: params.images,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create showoff:', error);
      throw new Error(`创建晒单失败: ${error.message}`);
    }

    return data as Showoff;
  }
		};
