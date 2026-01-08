import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false',
}

// 通用的 session 验证函数
async function validateSession(sessionToken: string) {
  if (!sessionToken) {
    throw new Error('未授权：缺少认证令牌');
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('服务器配置错误');
  }

  const sessionResponse = await fetch(
    `${supabaseUrl}/rest/v1/user_sessions?session_token=eq.${sessionToken}&is_active=eq.true&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!sessionResponse.ok) {
    throw new Error('验证会话失败');
  }

  const sessions = await sessionResponse.json();
  
  if (sessions.length === 0) {
    throw new Error('未授权：会话不存在或已失效');
  }

  const session = sessions[0];

  const expiresAt = new Date(session.expires_at);
  const now = new Date();
  
  if (expiresAt < now) {
    throw new Error('未授权：会话已过期');
  }

  const userResponse = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${session.user_id}&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!userResponse.ok) {
    throw new Error('查询用户信息失败');
  }

  const users = await userResponse.json();
  
  if (users.length === 0) {
    throw new Error('未授权：用户不存在');
  }

  return {
    userId: session.user_id,
    telegramId: users[0].telegram_id,
    user: users[0],
    session: session
  };
}

// 生成唯一的6位数字提货码
async function generatePickupCode(supabase: any): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    // 生成6位随机数字
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 检查是否在prizes表中已存在
    const { data: existingPrize } = await supabase
      .from('prizes')
      .select('id')
      .eq('pickup_code', code)
      .single();
    
    // 检查是否在full_purchase_orders表中已存在
    const { data: existingFullPurchase } = await supabase
      .from('full_purchase_orders')
      .select('id')
      .eq('pickup_code', code)
      .single();
    
    if (!existingPrize && !existingFullPurchase) {
      return code;
    }
    
    attempts++;
  }
  
  throw new Error('生成提货码失败，请重试');
}

/**
 * 全款购买积分商城商品
 * 用户直接使用积分购买商品的全款价格，立即获得商品
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { lottery_id, pickup_point_id, user_id, session_token } = body;

    console.log('[CreateFullPurchaseOrder] Received request:', { 
      lottery_id,
      pickup_point_id,
      user_id,
      session_token: session_token ? 'present' : 'missing'
    });

    // 获取 session token（优先从 body，其次从 header）
    let token = session_token;
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
      }
    }

    if (!token) {
      throw new Error('未授权：缺少 session_token');
    }

    if (!lottery_id) {
      throw new Error('缺少商品ID');
    }

    // 验证用户 session
    const { userId, user } = await validateSession(token);
    
    console.log('[CreateFullPurchaseOrder] User validated:', { userId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. 获取商品信息
    const { data: lottery, error: lotteryError } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', lottery_id)
      .single();

    if (lotteryError || !lottery) {
      console.error('[CreateFullPurchaseOrder] Lottery not found:', lotteryError);
      throw new Error('商品不存在');
    }

    // 2. 验证商品状态
    if (lottery.status !== 'ACTIVE') {
      throw new Error('该商品当前不可购买');
    }

    // 3. 计算全款价格（使用 original_price 或 ticket_price * total_tickets）
    const fullPrice = lottery.original_price || (lottery.ticket_price * lottery.total_tickets);

    // 4. 获取用户积分钱包
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'LUCKY_COIN')
      .eq('currency', lottery.currency)
      .single();

    if (walletError || !wallet) {
      console.error('[CreateFullPurchaseOrder] Wallet not found:', walletError);
      throw new Error('钱包不存在');
    }

    // 5. 检查余额是否足够
    if (wallet.balance < fullPrice) {
      throw new Error(`积分余额不足，需要 ${fullPrice} 积分，当前余额 ${wallet.balance} 积分`);
    }

    // 6. 验证自提点
    if (pickup_point_id) {
      const { data: pickupPoint, error: pointError } = await supabase
        .from('pickup_points')
        .select('id, status')
        .eq('id', pickup_point_id)
        .single();

      if (pointError || !pickupPoint) {
        throw new Error('自提点不存在');
      }

      if (pickupPoint.status !== 'ACTIVE') {
        throw new Error('该自提点当前不可用');
      }
    }

    // 7. 生成订单号
    const orderNumber = `FP${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // 8. 生成提货码
    const pickupCode = await generatePickupCode(supabase);

    // 9. 设置过期时间（30天后）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 10. 创建全款购买订单
    const { data: order, error: orderError } = await supabase
      .from('full_purchase_orders')
      .insert({
        user_id: userId,
        lottery_id: lottery_id,
        order_number: orderNumber,
        total_amount: fullPrice,
        currency: lottery.currency,
        status: 'COMPLETED',
        pickup_point_id: pickup_point_id || null,
        pickup_code: pickupCode,
        metadata: {
          product_title: lottery.title,
          product_title_i18n: lottery.title_i18n,
          product_image: lottery.image_urls?.[0] || null,
          original_price: lottery.original_price,
          ticket_price: lottery.ticket_price,
          total_tickets: lottery.total_tickets,
        }
      })
      .select()
      .single();

    if (orderError) {
      console.error('[CreateFullPurchaseOrder] Create order error:', orderError);
      throw new Error('创建订单失败');
    }

    // 11. 扣除用户积分
    const newBalance = wallet.balance - fullPrice;
    const { error: updateWalletError } = await supabase
      .from('wallets')
      .update({
        balance: newBalance,
        version: wallet.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (updateWalletError) {
      console.error('[CreateFullPurchaseOrder] Update wallet error:', updateWalletError);
      // 回滚订单
      await supabase
        .from('full_purchase_orders')
        .delete()
        .eq('id', order.id);
      throw new Error('扣除积分失败');
    }

    // 12. 创建钱包交易记录
    const { error: transactionError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'FULL_PURCHASE',
        amount: -fullPrice,
        balance_before: wallet.balance,
        balance_after: newBalance,
        status: 'COMPLETED',
        description: `全款购买 - 订单 ${orderNumber}`,
        related_order_id: order.id,
        related_lottery_id: lottery_id,
      });

    if (transactionError) {
      console.error('[CreateFullPurchaseOrder] Transaction log error:', transactionError);
      // 不影响主流程
    }

    // 13. 更新商品库存（只减少1份，不影响一元夹宝业务）
    const newSoldTickets = lottery.sold_tickets + 1;
    const updateData: any = {
      sold_tickets: newSoldTickets,
      updated_at: new Date().toISOString(),
    };
    
    // 仅当库存完全卖完时，才将商品状态改为SOLD_OUT
    if (newSoldTickets >= lottery.total_tickets) {
      updateData.status = 'SOLD_OUT';
    }
    
    const { error: updateLotteryError } = await supabase
      .from('lotteries')
      .update(updateData)
      .eq('id', lottery_id);

    if (updateLotteryError) {
      console.error('[CreateFullPurchaseOrder] Update lottery error:', updateLotteryError);
      // 不影响主流程，但记录日志
    }

    // 14. 记录操作日志
    await supabase
      .from('pickup_logs')
      .insert({
        prize_id: order.id,
        pickup_code: pickupCode,
        pickup_point_id: pickup_point_id || null,
        operation_type: 'FULL_PURCHASE',
        notes: `用户全款购买商品，生成提货码`,
      });

    console.log('[CreateFullPurchaseOrder] Success:', { 
      orderId: order.id, 
      orderNumber, 
      pickupCode,
      totalAmount: fullPrice
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          order_id: order.id,
          order_number: orderNumber,
          pickup_code: pickupCode,
          expires_at: expiresAt.toISOString(),
          total_amount: fullPrice,
          new_balance: newBalance,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[CreateFullPurchaseOrder] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
