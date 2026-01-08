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
 * 
 * 重要逻辑修改（2026-01-08）：
 * - 全款购买从关联的库存商品(inventory_products)扣减库存
 * - 不再修改lotteries表的sold_tickets字段
 * - 一元购物的份数和全款购买的库存独立管理
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

    // 1. 获取商品信息（包含关联的库存商品ID）
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

    // 3. 验证全款购买是否启用
    if (lottery.full_purchase_enabled === false) {
      throw new Error('该商品不支持全款购买');
    }

    // 4. 获取关联的库存商品信息
    let inventoryProduct = null;
    if (lottery.inventory_product_id) {
      const { data: invProduct, error: invError } = await supabase
        .from('inventory_products')
        .select('*')
        .eq('id', lottery.inventory_product_id)
        .single();

      if (invError) {
        console.error('[CreateFullPurchaseOrder] Inventory product error:', invError);
        throw new Error('获取库存商品信息失败');
      }

      inventoryProduct = invProduct;

      // 验证库存商品状态
      if (!inventoryProduct || inventoryProduct.status === 'INACTIVE') {
        throw new Error('关联的库存商品已下架');
      }

      // 验证库存是否充足
      if (inventoryProduct.stock <= 0) {
        throw new Error('库存不足，无法全款购买');
      }
    } else {
      // 如果没有关联库存商品，检查是否还有剩余份数可供全款购买
      // 这是向后兼容的逻辑，对于未关联库存商品的旧数据
      if (lottery.sold_tickets >= lottery.total_tickets) {
        throw new Error('商品已售罄');
      }
    }

    // 5. 计算全款价格
    // 优先使用 full_purchase_price，其次使用库存商品原价，最后使用 ticket_price * total_tickets
    let fullPrice = lottery.full_purchase_price;
    if (!fullPrice && inventoryProduct) {
      fullPrice = inventoryProduct.original_price;
    }
    if (!fullPrice) {
      fullPrice = lottery.original_price || (lottery.ticket_price * lottery.total_tickets);
    }

    console.log('[CreateFullPurchaseOrder] Full price calculated:', { 
      fullPrice,
      full_purchase_price: lottery.full_purchase_price,
      inventory_original_price: inventoryProduct?.original_price,
      lottery_original_price: lottery.original_price
    });

    // 6. 获取用户积分钱包
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

    // 7. 检查余额是否足够
    if (wallet.balance < fullPrice) {
      throw new Error(`积分余额不足，需要 ${fullPrice} 积分，当前余额 ${wallet.balance} 积分`);
    }

    // 8. 验证自提点
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

    // 9. 生成订单号
    const orderNumber = `FP${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // 10. 生成提货码
    const pickupCode = await generatePickupCode(supabase);

    // 11. 设置过期时间（30天后）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 12. 创建全款购买订单
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
          product_image: lottery.image_urls?.[0] || lottery.image_url || null,
          original_price: lottery.original_price,
          ticket_price: lottery.ticket_price,
          total_tickets: lottery.total_tickets,
          inventory_product_id: lottery.inventory_product_id,
          full_purchase_price: fullPrice,
        }
      })
      .select()
      .single();

    if (orderError) {
      console.error('[CreateFullPurchaseOrder] Create order error:', orderError);
      throw new Error('创建订单失败');
    }

    // 13. 扣除用户积分
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

    // 14. 创建钱包交易记录
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

    // 15. 更新库存（关键修改：从库存商品扣减，不影响一元购物份数）
    if (inventoryProduct) {
      // 有关联库存商品：从库存商品扣减库存
      const newStock = inventoryProduct.stock - 1;
      const { error: updateInventoryError } = await supabase
        .from('inventory_products')
        .update({
          stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inventoryProduct.id);

      if (updateInventoryError) {
        console.error('[CreateFullPurchaseOrder] Update inventory error:', updateInventoryError);
        // 不影响主流程，但记录日志
      }

      // 记录库存变动
      const { error: inventoryTransactionError } = await supabase
        .from('inventory_transactions')
        .insert({
          inventory_product_id: inventoryProduct.id,
          transaction_type: 'FULL_PURCHASE',
          quantity: -1,
          stock_before: inventoryProduct.stock,
          stock_after: newStock,
          related_order_id: order.id,
          related_lottery_id: lottery_id,
          notes: `全款购买订单 ${orderNumber}`,
        });

      if (inventoryTransactionError) {
        console.error('[CreateFullPurchaseOrder] Inventory transaction log error:', inventoryTransactionError);
        // 不影响主流程
      }

      console.log('[CreateFullPurchaseOrder] Inventory updated:', {
        inventoryProductId: inventoryProduct.id,
        stockBefore: inventoryProduct.stock,
        stockAfter: newStock,
      });
    } else {
      // 重要修改（2026-01-09）：
      // 全款购买不应该影响 sold_tickets（份数），因为份数只用于一元购物抽奖
      // 全款购买应该扣减库存，但如果没有关联库存商品，则只记录日志，不做任何库存变动
      // 这样可以避免全款购买导致份数被消耗，进而触发不应该发生的开奖
      console.log('[CreateFullPurchaseOrder] No inventory product linked, full purchase completed without stock deduction:', {
        lotteryId: lottery_id,
        soldTickets: lottery.sold_tickets,
        totalTickets: lottery.total_tickets,
        note: 'Full purchase does not affect sold_tickets (lottery tickets). Consider linking an inventory product for proper stock management.'
      });
    }

    // 16. 记录操作日志
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
      totalAmount: fullPrice,
      inventoryProductId: inventoryProduct?.id || null,
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
