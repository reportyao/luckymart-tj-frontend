import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// 使用环境变量获取Supabase配置
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// CORS headers（与 group-buy-join 保持一致）
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Helper function to create response with CORS headers
function createResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Generate unique order number（与 group-buy-join 保持一致）
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SB${timestamp}${random}`; // SB = Squad Buy，区分于普通拼团的 GB 前缀
}

// Generate session code（与 group-buy-join 保持一致）
function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// 机器人账号配置
// 在 users 表中需要预先创建这些机器人账号
// ============================================
const BOT_TELEGRAM_IDS = ['bot_squad_1', 'bot_squad_2'];

/**
 * 获取或创建机器人账号
 * 如果机器人账号不存在，自动创建
 */
async function ensureBotAccounts(supabase: any): Promise<string[]> {
  const botUUIDs: string[] = [];

  for (const botTelegramId of BOT_TELEGRAM_IDS) {
    // 先查找是否已存在
    let { data: botUser } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', botTelegramId)
      .single();

    if (!botUser) {
      // 创建机器人账号
      // 注意：users表的必填字段：telegram_id, referral_code, updated_at
      const botReferralCode = `BOT${botTelegramId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
      const { data: newBot, error: createError } = await supabase
        .from('users')
        .insert({
          telegram_id: botTelegramId,
          telegram_username: botTelegramId,
          first_name: 'Lucky',
          last_name: 'User',
          referral_code: botReferralCode,
          language_code: 'zh',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createError) {
        console.error(`Failed to create bot account ${botTelegramId}:`, createError);
        throw new Error(`Failed to create bot account: ${createError.message}`);
      }
      botUser = newBot;
      console.log(`[SquadBuy] Created bot account: ${botTelegramId} -> ${botUser.id}`);
    }

    botUUIDs.push(botUser.id);
  }

  return botUUIDs;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { product_id, user_id } = await req.json();

    // ============================================
    // 步骤 0: 参数校验
    // ============================================
    if (!product_id || !user_id) {
      return createResponse({ success: false, error: 'Product ID and User ID are required' }, 400);
    }

    console.log(`[SquadBuy] Starting squad buy: product=${product_id}, user=${user_id}`);

    // ============================================
    // 步骤 1: 获取商品信息并校验
    // ============================================
    const { data: product, error: productError } = await supabase
      .from('group_buy_products')
      .select('*')
      .eq('id', product_id)
      .in('status', ['ACTIVE', 'active'])
      .single();

    if (productError || !product) {
      console.error('Product query error:', productError);
      return createResponse({ success: false, error: 'Product not found or inactive' }, 404);
    }

    // 兼容不同的字段名（与 group-buy-join 保持一致）
    const stockQuantity = product.stock ?? product.stock_quantity ?? 0;
    const soldQuantity = product.sold_quantity ?? 0;
    const pricePerPerson = Number(product.price_per_person) || Number(product.group_price) || 0;
    const timeoutHours = product.timeout_hours ?? product.duration_hours ?? 24;
    const groupSize = product.group_size ?? product.max_participants ?? 3;
    const productTitle = product.title ?? product.name_i18n ?? { zh: product.name };

    // 校验库存
    if (stockQuantity <= soldQuantity) {
      return createResponse({ success: false, error: 'out_of_stock' }, 400);
    }

    // 校验价格合理性
    if (pricePerPerson <= 0) {
      return createResponse({ success: false, error: 'Invalid product price' }, 400);
    }

    const totalCost = pricePerPerson * groupSize; // 包团总价
    const refundPoints = pricePerPerson * (groupSize - 1); // 退还积分

    console.log(`[SquadBuy] Product: price=${pricePerPerson}, groupSize=${groupSize}, total=${totalCost}, refund=${refundPoints}`);

    // ============================================
    // 步骤 2: 获取用户信息
    // ============================================
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, telegram_id')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('User query error:', userError, 'user_id:', user_id);
      return createResponse({ success: false, error: 'User not found' }, 404);
    }

    // ============================================
    // 步骤 3: 检查用户是否已在进行中的session中（防重复）
    // ============================================
    const { data: activeOrders } = await supabase
      .from('group_buy_orders')
      .select('id, session_id, group_buy_sessions!inner(status)')
      .eq('user_id', user.id)
      .eq('group_buy_sessions.product_id', product_id)
      .in('group_buy_sessions.status', ['ACTIVE', 'active']);

    if (activeOrders && activeOrders.length > 0) {
      return createResponse({ success: false, error: 'already_in_active_session' }, 400);
    }

    // ============================================
    // 步骤 4: 获取用户TJS钱包并校验余额
    // ============================================
    const { data: tjsWallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .eq('type', 'TJS')
      .single();

    if (walletError || !tjsWallet) {
      console.error('Wallet query error:', walletError, 'user_id:', user_id);
      return createResponse({ success: false, error: 'Wallet not found' }, 404);
    }

    // 检查可用余额（balance - frozen_balance）
    const availableBalance = Number(tjsWallet.balance) - Number(tjsWallet.frozen_balance || 0);
    if (availableBalance < totalCost) {
      return createResponse({
        success: false,
        error: 'insufficient_balance',
        required: totalCost,
        current: availableBalance,
      }, 400);
    }

    // ============================================
    // 步骤 5: 确保机器人账号存在
    // ============================================
    const botUUIDs = await ensureBotAccounts(supabase);
    // 只取 groupSize - 1 个机器人
    const requiredBots = botUUIDs.slice(0, groupSize - 1);

    if (requiredBots.length < groupSize - 1) {
      console.error(`[SquadBuy] Not enough bot accounts: need ${groupSize - 1}, got ${requiredBots.length}`);
      return createResponse({ success: false, error: 'System configuration error' }, 500);
    }

    console.log(`[SquadBuy] Bot accounts ready: ${requiredBots.join(', ')}`);

    // ============================================
    // 步骤 6: 扣款（使用乐观锁，与 group-buy-join 一致）
    // ============================================
    const newBalance = Number(tjsWallet.balance) - totalCost;
    const { error: updateWalletError, data: updatedWallet } = await supabase
      .from('wallets')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
        version: tjsWallet.version + 1,
      })
      .eq('id', tjsWallet.id)
      .eq('version', tjsWallet.version) // 乐观锁
      .select()
      .single();

    if (updateWalletError || !updatedWallet) {
      console.error('Failed to update wallet:', updateWalletError);
      return createResponse({
        success: false,
        error: 'Failed to deduct balance, please try again (concurrent modification detected)',
      }, 500);
    }

    console.log(`[SquadBuy] Deducted ${totalCost} TJS from wallet. New balance: ${newBalance}`);

    // ============================================
    // 步骤 7: 创建支出流水记录
    // ============================================
    await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: tjsWallet.id,
        type: 'GROUP_BUY_PURCHASE',
        amount: -totalCost,
        balance_before: Number(tjsWallet.balance),
        balance_after: newBalance,
        status: 'COMPLETED',
        description: `一键包团 - ${productTitle?.zh || productTitle?.en || 'Squad Buy'}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    // ============================================
    // 步骤 8: 创建拼团会话（直接设为 SUCCESS）
    // ============================================
    const sessionCode = generateSessionCode();
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + timeoutHours);

    const { data: newSession, error: createSessionError } = await supabase
      .from('group_buy_sessions')
      .insert({
        product_id: product.id,
        session_code: sessionCode,
        status: 'SUCCESS',
        current_participants: groupSize,
        group_size: groupSize,
        max_participants: groupSize,
        required_participants: groupSize,
        initiator_id: user.id,
        winner_id: user.id, // 包团用户就是中奖者
        started_at: now.toISOString(),
        completed_at: now.toISOString(),
        drawn_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        winning_timestamp_sum: (BigInt(Date.now()) * BigInt(groupSize)).toString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (createSessionError) {
      console.error('Failed to create session:', createSessionError);
      // 回滚钱包余额
      await supabase
        .from('wallets')
        .update({
          balance: Number(tjsWallet.balance),
          version: tjsWallet.version + 2,
        })
        .eq('id', tjsWallet.id);
      return createResponse({ success: false, error: 'Failed to create session: ' + createSessionError.message }, 500);
    }

    console.log(`[SquadBuy] Session created: ${newSession.id} (code: ${sessionCode})`);

    // ============================================
    // 步骤 9: 创建订单（1个真实 + N-1个机器人）
    // ============================================
    const orderTimestamp = Date.now();

    // 9.1 创建用户的真实订单（状态为 WON）
    const userOrderNumber = generateOrderNumber();
    const { data: userOrder, error: userOrderError } = await supabase
      .from('group_buy_orders')
      .insert({
        session_id: newSession.id,
        user_id: user.id,
        product_id: product.id,
        order_number: userOrderNumber,
        order_timestamp: orderTimestamp,
        amount: pricePerPerson,
        status: 'WON',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (userOrderError) {
      console.error('Failed to create user order:', userOrderError);
      // 回滚：删除session，恢复钱包
      await supabase.from('group_buy_sessions').delete().eq('id', newSession.id);
      await supabase
        .from('wallets')
        .update({ balance: Number(tjsWallet.balance), version: tjsWallet.version + 2 })
        .eq('id', tjsWallet.id);
      return createResponse({ success: false, error: 'Failed to create order: ' + userOrderError.message }, 500);
    }

    console.log(`[SquadBuy] User order created: ${userOrder.id} (${userOrderNumber})`);

    // 9.2 创建机器人订单（状态为 REFUNDED）
    const botOrders = [];
    for (let i = 0; i < requiredBots.length; i++) {
      const botOrderNumber = generateOrderNumber();
      const botTimestamp = orderTimestamp + i + 1; // 稍微错开时间戳

      const { data: botOrder, error: botOrderError } = await supabase
        .from('group_buy_orders')
        .insert({
          session_id: newSession.id,
          user_id: requiredBots[i],
          product_id: product.id,
          order_number: botOrderNumber,
          order_timestamp: botTimestamp,
          amount: pricePerPerson,
          status: 'REFUNDED', // 机器人订单直接标记为已退款
          refund_lucky_coins: pricePerPerson,
          refunded_at: now.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single();

      if (botOrderError) {
        console.error(`Failed to create bot order ${i}:`, botOrderError);
        // 继续创建其他机器人订单，不中断流程
      } else {
        botOrders.push(botOrder);
        console.log(`[SquadBuy] Bot order ${i + 1} created: ${botOrder.id} (${botOrderNumber})`);
      }
    }

    // ============================================
    // 步骤 10: 创建开奖结果记录
    // ============================================
    const claimExpiresAt = new Date();
    claimExpiresAt.setDate(claimExpiresAt.getDate() + 30);

    const timestampSum = BigInt(orderTimestamp) * BigInt(groupSize);
    const allOrders = [userOrder, ...botOrders];

    const { data: result, error: resultError } = await supabase
      .from('group_buy_results')
      .insert({
        session_id: newSession.id,
        product_id: product.id,
        user_id: user.id, // 中奖者UUID
        winner_id: user.id, // 中奖者UUID（与 group-buy-draw 一致）
        winner_order_id: userOrder.id,
        total_participants: groupSize,
        timestamp_sum: timestampSum.toString(),
        winning_index: 0, // 用户是第一个，索引为0
        pickup_status: 'PENDING_CLAIM',
        status: 'PENDING',
        expires_at: claimExpiresAt.toISOString(),
        algorithm_data: {
          type: 'squad_buy', // 标记为包团类型
          orders: allOrders.map((o, idx) => ({
            user_id: o.user_id,
            order_number: o.order_number,
            timestamp: o.order_timestamp || orderTimestamp + idx,
            is_bot: idx > 0,
          })),
          calculation: {
            timestamp_sum: timestampSum.toString(),
            total_participants: groupSize,
            winning_index: 0,
            formula: 'squad_buy - winner is always the buyer',
          },
        },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (resultError) {
      console.error('Failed to create result:', resultError);
      // 不中断流程，但记录错误
    } else {
      console.log(`[SquadBuy] Result created: ${result?.id}`);
    }

    // ============================================
    // 步骤 11: 返还积分到 LUCKY_COIN 钱包
    // ============================================
    try {
      // 获取或创建 LUCKY_COIN 钱包
      let { data: lcWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user_id)
        .eq('type', 'LUCKY_COIN')
        .single();

      if (!lcWallet) {
        // 创建 LUCKY_COIN 钱包
        const { data: newLcWallet, error: createLcError } = await supabase
          .from('wallets')
          .insert({
            user_id: user_id,
            type: 'LUCKY_COIN',
            currency: 'LUCKY_COIN',
            balance: 0,
            version: 1,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .select()
          .single();

        if (createLcError) {
          console.error('Failed to create LUCKY_COIN wallet:', createLcError);
        } else {
          lcWallet = newLcWallet;
        }
      }

      if (lcWallet) {
        const newLcBalance = Number(lcWallet.balance) + refundPoints;
        const { error: updateLcError } = await supabase
          .from('wallets')
          .update({
            balance: newLcBalance,
            updated_at: now.toISOString(),
            version: lcWallet.version + 1,
          })
          .eq('id', lcWallet.id)
          .eq('version', lcWallet.version);

        if (updateLcError) {
          console.error('Failed to update LUCKY_COIN wallet:', updateLcError);
        } else {
          // 创建积分流水记录
          await supabase
            .from('wallet_transactions')
            .insert({
              wallet_id: lcWallet.id,
              type: 'GROUP_BUY_REFUND',
              amount: refundPoints,
              balance_before: Number(lcWallet.balance),
              balance_after: newLcBalance,
              status: 'COMPLETED',
              description: `一键包团积分返还 - ${productTitle?.zh || 'Squad Buy'}`,
              reference_id: userOrder.id,
              processed_at: now.toISOString(),
              created_at: now.toISOString(),
            });

          console.log(`[SquadBuy] Refunded ${refundPoints} LUCKY_COIN to user`);
        }
      }
    } catch (lcError) {
      console.error('[SquadBuy] Failed to process LUCKY_COIN refund:', lcError);
      // 积分返还失败不影响主流程
    }

    // ============================================
    // 步骤 12: 更新库存（调用 increment_sold_quantity RPC）
    // ============================================
    try {
      const { error: incrementError } = await supabase.rpc('increment_sold_quantity', {
        product_id: product.id,
        amount: 1,
      });

      if (incrementError) {
        console.error('Failed to increment sold_quantity:', incrementError);
      } else {
        console.log(`[SquadBuy] Incremented sold_quantity for product ${product.id}`);
      }
    } catch (stockError) {
      console.error('Failed to call increment_sold_quantity:', stockError);
    }

    // ============================================
    // 步骤 13: 触发推荐佣金（为每个订单调用一次）
    // ============================================
    try {
      const { data: userWithReferrer } = await supabase
        .from('users')
        .select('referred_by_id')
        .eq('id', user.id)
        .single();

      if (userWithReferrer?.referred_by_id) {
        // 为每个订单（包括机器人订单）调用佣金处理
        // 因为用户实际支付了 groupSize 份的价格
        for (const order of allOrders) {
          try {
            const commissionResponse = await fetch(`${SUPABASE_URL}/functions/v1/handle-purchase-commission`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                order_id: order.id,
                user_id: user.id,
                order_amount: pricePerPerson,
              }),
            });

            if (!commissionResponse.ok) {
              console.error(`Failed to process commission for order ${order.id}:`, await commissionResponse.text());
            } else {
              console.log(`[SquadBuy] Commission processed for order ${order.id}`);
            }
          } catch (commErr) {
            console.error(`Commission error for order ${order.id}:`, commErr);
          }
        }
      }
    } catch (commissionError) {
      console.error('[SquadBuy] Commission processing error:', commissionError);
      // 佣金处理失败不影响主流程
    }

    // ============================================
    // 步骤 14: 触发AI对话奖励（每个订单10次，共 groupSize * 10 次）
    // ============================================
    try {
      for (let i = 0; i < groupSize; i++) {
        await fetch(`${SUPABASE_URL}/functions/v1/ai-add-bonus`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            amount: 10,
            reason: 'group_buy_participation',
          }),
        });
      }
      console.log(`[SquadBuy] Awarded ${groupSize * 10} AI chats to user ${user.id}`);
    } catch (aiRewardError) {
      console.error('[SquadBuy] Failed to process AI reward:', aiRewardError);
    }

    // ============================================
    // 步骤 15: 触发首次拼团奖励（只调用1次）
    // ============================================
    try {
      const rewardResponse = await supabase.functions.invoke('handle-first-group-buy-reward', {
        body: {
          user_id: user.id,
          order_id: userOrder.id,
        },
      });

      if (rewardResponse.data?.success && rewardResponse.data?.inviter_rewarded) {
        console.log(`[SquadBuy] Inviter rewarded for user ${user.id}'s first group buy`);
      }
    } catch (rewardError) {
      console.error('[SquadBuy] Failed to process first group buy reward:', rewardError);
    }

    // ============================================
    // 步骤 16: 发送中奖通知
    // ============================================
    try {
      const productName = productTitle?.zh || productTitle?.en || 'Unknown Product';

      await supabase.from('notification_queue').insert({
        user_id: user.id,
        type: 'group_buy_win',
        payload: {
          product_name: productName,
          session_code: sessionCode,
          won_at: now.toLocaleString('zh-CN', { timeZone: 'Asia/Dushanbe' }),
          is_squad_buy: true,
        },
        telegram_chat_id: null,
        notification_type: 'group_buy_win',
        title: '包团成功通知',
        message: '',
        data: {
          product_name: productName,
          session_code: sessionCode,
          won_at: now.toLocaleString('zh-CN', { timeZone: 'Asia/Dushanbe' }),
          is_squad_buy: true,
        },
        priority: 1,
        status: 'pending',
        scheduled_at: now.toISOString(),
        retry_count: 0,
        max_retries: 3,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      console.log(`[SquadBuy] Win notification queued for user ${user.id}`);
    } catch (notifyError) {
      console.error('[SquadBuy] Failed to queue notification:', notifyError);
    }

    // ============================================
    // 步骤 17: 返回成功结果
    // ============================================
    console.log(`[SquadBuy] ✅ Squad buy completed successfully! Session: ${newSession.id}`);

    return createResponse({
      success: true,
      data: {
        session_id: newSession.id,
        session_code: sessionCode,
        order_id: userOrder.id,
        order_number: userOrderNumber,
        total_paid: totalCost,
        refund_points: refundPoints,
        result_id: result?.id,
      },
    });
  } catch (error) {
    console.error('[SquadBuy] Unexpected error:', error);
    return createResponse({ success: false, error: error.message }, 500);
  }
});
