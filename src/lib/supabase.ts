import { createClient } from '@supabase/supabase-js';
import { Database, Tables, Enums, Functions } from '../types/supabase';

// 检查环境变量，优先使用 NEXT_PUBLIC_ (Next.js 风格) 或 VITE_ (Vite 风格)
const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key. Please check your .env.local file.');
}

// 创建 Supabase 客户端实例
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// 导出常用的类型
export type Lottery = Tables<'lotteries'>;
export type UserProfile = Tables<'profiles'>;
export type Wallet = Tables<'wallets'>;
export type Order = Tables<'orders'>;
export type Commission = Tables<'commissions'>;
export type DepositRequest = Tables<'deposit_requests'>;
export type WithdrawalRequest = Tables<'withdrawal_requests'>;
export type Currency = Enums<'Currency'>;
export type LotteryStatus = Enums<'LotteryStatus'>;
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
      .from('profiles')
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
export const lotteryService = {
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
    const { data, error } = await supabase.rpc('get_user_wallet_balance', {
      p_user_id: user.id,
      p_currency: currency
    });

    if (error) {
      console.error('Failed to fetch balance:', error);
      throw new Error(`获取余额失败: ${error.message}`);
    }
    // 存储过程返回的是数字
    return data as number;
  },

  /**
   * 余额兑换（例如：佣金兑换为余额）
   * @param sourceWalletId 源钱包 ID
   * @param targetWalletId 目标钱包 ID
   * @param amount 兑换金额
   */
  async exchangeCoins(sourceWalletId: string, targetWalletId: string, amount: number): Promise<void> {
    // 这里的逻辑应该在后端实现，但根据数据库结构，我们可能需要一个 RPC 或 Edge Function 来处理
    // 假设有一个名为 'exchange_wallet_balance' 的 RPC
    // 由于没有找到对应的 RPC，我们暂时跳过或使用一个模拟的函数
    console.warn('ExchangeCoins function is a placeholder. Needs a backend RPC/Edge Function.');
    // throw new Error('兑换功能尚未实现后端接口');
  }
};

/**
 * 佣金服务
 */
export const commissionService = {
  /**
   * 获取用户的推荐统计数据
   * @param userId 用户 ID
   */
  async getReferralStats(userId: string): Promise<Functions<'get_user_referral_stats'>['Returns'][0]> {
    const { data, error } = await supabase.rpc('get_user_referral_stats', {
      p_user_id: userId
    });

    if (error) {
      console.error('Failed to fetch referral stats:', error);
      throw new Error(`获取推荐统计失败: ${error.message}`);
    }
    // 存储过程返回的是一个包含统计信息的数组
    return data[0];
  },

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
 * 晒单服务 (Posts)
 */
export const postService = {
  /**
   * 获取晒单列表
   */
  async getPosts(): Promise<Tables<'posts'>[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(full_name, avatar_url)')
      .eq('status', 'APPROVED' as Enums<'PostStatus'>)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch posts:', error);
      throw new Error(`获取晒单列表失败: ${error.message}`);
    }
    // 这里的类型需要手动处理一下，因为 select 包含了 join
    return data as any as Tables<'posts'>[];
  },

  /**
   * 点赞/取消点赞
   * @param postId 晒单 ID
   * @param userId 用户 ID
   */
  async toggleLike(postId: string, userId: string): Promise<boolean> {
    // 检查是否已点赞
    const { data: existingLike, error: fetchError } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
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
        console.error('Failed to unlike post:', error);
        throw new Error(`取消点赞失败: ${error.message}`);
      }
      return false; // 已取消点赞
    } else {
      // 点赞
      const { error } = await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: userId });

      if (error) {
        console.error('Failed to like post:', error);
        throw new Error(`点赞失败: ${error.message}`);
      }
      return true; // 已点赞
    }
  }
};
