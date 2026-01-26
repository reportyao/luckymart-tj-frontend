import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// 使用环境变量获取Supabase配置
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// CORS headers
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

// 辅助函数：将user_id（可能是telegram_id或UUID）转换为UUID
async function resolveUserIdToUUID(supabase: any, userId: string): Promise<string | null> {
  // 检查是否是UUID格式
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(userId)) {
    // 已经是UUID，验证用户存在
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    return user?.id || null;
  } else {
    // 是telegram_id，查找对应的UUID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', userId)
      .single();
    return user?.id || null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { session_id } = await req.json();

    if (!session_id) {
      return createResponse({ success: false, error: 'Session ID is required' }, 400);
    }

    // 1. Get session information
    const { data: session, error: sessionError } = await supabase
      .from('group_buy_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return createResponse({ success: false, error: 'Session not found' }, 404);
    }

    // Check if already drawn
    if (session.status === 'SUCCESS' || session.drawn_at) {
      return createResponse({ success: false, error: 'Session already drawn' }, 400);
    }

    // 2. Get all orders
    const { data: orders, error: ordersError } = await supabase
      .from('group_buy_orders')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (ordersError || !orders || orders.length === 0) {
      return createResponse({ success: false, error: 'No orders found' }, 404);
    }

    // 3. 计算时间戳总和（处理order_timestamp为null的情况）
    const timestampSum = orders.reduce((sum, order) => {
      // 如果order_timestamp为null，使用created_at的时间戳
      const timestamp = order.order_timestamp || new Date(order.created_at).getTime();
      return sum + BigInt(timestamp);
    }, BigInt(0));
    const totalParticipants = orders.length;

    // 4. 使用时间戳算法确定中奖索引
    const winningIndex = Number(timestampSum % BigInt(totalParticipants));
    const winnerOrder = orders[winningIndex];

    // 4.1 解析中奖者的UUID
    const winnerUUID = await resolveUserIdToUUID(supabase, winnerOrder.user_id);
    if (!winnerUUID) {
      console.error('Failed to resolve winner UUID for user_id:', winnerOrder.user_id);
      return createResponse({ success: false, error: 'Failed to resolve winner user' }, 500);
    }

    // 5. 更新拼团会话状态（使用UUID）
    const { error: updateSessionError } = await supabase
      .from('group_buy_sessions')
      .update({
        status: 'SUCCESS',
        completed_at: new Date().toISOString(),
        drawn_at: new Date().toISOString(),
        winner_id: winnerUUID,
        winning_timestamp_sum: timestampSum.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    if (updateSessionError) {
      console.error('Failed to update session:', updateSessionError);
      return createResponse({ success: false, error: 'Failed to update session status' }, 500);
    }

    // 6. 更新中奖订单状态
    await supabase
      .from('group_buy_orders')
      .update({ 
        status: 'WON',
        updated_at: new Date().toISOString()
      })
      .eq('id', winnerOrder.id);

    // 7. 创建开奖结果记录
    const claimExpiresAt = new Date();
    claimExpiresAt.setDate(claimExpiresAt.getDate() + 30);
    
    // 【关键】使用正确的user_id字段（group_buy_results表需要user_id字段）
    const { data: result, error: resultError } = await supabase
      .from('group_buy_results')
      .insert({
        session_id: session_id,
        product_id: session.product_id,
        user_id: winnerUUID, // 添加user_id字段
        winner_id: winnerUUID,
        winner_order_id: winnerOrder.id,
        total_participants: totalParticipants,
        timestamp_sum: timestampSum.toString(),
        winning_index: winningIndex,
        pickup_status: 'PENDING_CLAIM',
        status: 'PENDING', // 添加status字段
        expires_at: claimExpiresAt.toISOString(),
        algorithm_data: {
          orders: orders.map((o) => ({
            user_id: o.user_id,
            order_number: o.order_number,
            timestamp: o.order_timestamp || new Date(o.created_at).getTime(),
          })),
          calculation: {
            timestamp_sum: timestampSum.toString(),
            total_participants: totalParticipants,
            winning_index: winningIndex,
            formula: 'winning_index = timestamp_sum % total_participants',
          },
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (resultError) {
      console.error('Failed to create result:', resultError);
      // 继续处理，但记录错误
    } else {
      console.log('Created group_buy_result:', result?.id);
    }

    // 8. 【关键逻辑】处理中奖者 - 中奖者的余额已经在参与时扣除，现在执行发货流程
    // 中奖者不需要额外扣款，因为参与时已经扣除了TJS余额
    // 只需要更新订单状态为等待发货
    console.log(`Winner ${winnerUUID} - balance already deducted during participation, ready for delivery`);

    // 9. 【关键逻辑】处理未中奖者 - 退回到余额（TJS）
    for (const order of orders) {
      if (order.id !== winnerOrder.id) {
        // 解析用户UUID
        const userUUID = await resolveUserIdToUUID(supabase, order.user_id);
        
        if (userUUID) {
          const refundAmount = Number(order.amount);
          
          // 获取用户的TJS余额钱包
          let { data: tjsWallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userUUID)
            .eq('type', 'TJS')
            .single();

          // 如果TJS钱包不存在，创建一个
          if (!tjsWallet) {
            const { data: newWallet, error: createWalletError } = await supabase
              .from('wallets')
              .insert({
                user_id: userUUID,
                type: 'TJS',
                currency: 'TJS',
                balance: 0,
                version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (createWalletError) {
              console.error(`Failed to create TJS wallet for user ${userUUID}:`, createWalletError);
              continue;
            }
            tjsWallet = newWallet;
          }

          if (tjsWallet) {
            // 更新TJS钱包余额
            const newBalance = Number(tjsWallet.balance) + refundAmount;
            
            const { error: updateWalletError } = await supabase
              .from('wallets')
              .update({ 
                balance: newBalance,
                updated_at: new Date().toISOString(),
                version: tjsWallet.version + 1
              })
              .eq('id', tjsWallet.id)
              .eq('version', tjsWallet.version);

            if (updateWalletError) {
              console.error(`Failed to update TJS wallet for user ${userUUID}:`, updateWalletError);
              continue;
            }

            // 创建钱包交易记录
            // 移除手动指定的 ID，让数据库自动生成 UUID
            const { error: insertError } = await supabase.from('wallet_transactions').insert({
              wallet_id: tjsWallet.id,
              type: 'GROUP_BUY_REFUND',
              amount: refundAmount,
              balance_before: Number(tjsWallet.balance),
              balance_after: newBalance,
              status: 'COMPLETED',
              description: `拼团未中奖，退回余额`,
              reference_id: order.id,
              processed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });

            if (insertError) {
              console.error(`Failed to create transaction record for user ${userUUID}:`, insertError);
              // 回滚钱包余额
              await supabase
                .from('wallets')
                .update({ 
                  balance: Number(tjsWallet.balance),
                  updated_at: new Date().toISOString(),
                  version: tjsWallet.version + 1
                })
                .eq('id', tjsWallet.id);
              continue;
            }

            console.log(`Refunded ${refundAmount} TJS to balance for user ${userUUID}`);
            
            // 更新订单退款信息（只有在交易记录创建成功后才更新）
            await supabase
              .from('group_buy_orders')
              .update({
                status: 'REFUNDED',
                refund_lucky_coins: refundAmount,
                refunded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', order.id);
          } else {
            console.error(`TJS wallet not found for user ${userUUID}`);
            continue;
          }

          // 发送Telegram通知（未中奖，退回余额）
          try {
            const { data: product } = await supabase
              .from('group_buy_products')
              .select('name, image_url')
              .eq('id', session.product_id)
              .single();

            const { data: updatedWallet } = await supabase
              .from('wallets')
              .select('balance')
              .eq('user_id', userUUID)
              .eq('type', 'TJS')
              .single();

            // 插入通知队列
            await supabase.from('notification_queue').insert({
              user_id: userUUID,
              type: 'group_buy_refund',
              payload: {
                product_name: product?.name || 'Unknown Product',
                session_code: session.session_code,
                refund_amount: refundAmount,
                balance: Number(updatedWallet?.balance || 0),
              },
              telegram_chat_id: null,
              notification_type: 'group_buy_refund',
              title: '拼团退款通知',
              message: '',
              data: {
                product_name: product?.name || 'Unknown Product',
                session_code: session.session_code,
                refund_amount: refundAmount,
                balance: Number(updatedWallet?.balance || 0),
              },
              priority: 2,
              status: 'pending',
              scheduled_at: new Date().toISOString(),
              retry_count: 0,
              max_retries: 3,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } catch (error) {
            console.error('Failed to queue notification:', error);
          }
        }
      }
    }

    // 10. 发送中奖通知
    try {
      const { data: product } = await supabase
        .from('group_buy_products')
        .select('name, image_url')
        .eq('id', session.product_id)
        .single();

      // 插入通知队列
      await supabase.from('notification_queue').insert({
        user_id: winnerUUID,
        type: 'group_buy_win',
        payload: {
          product_name: product?.name || 'Unknown Product',
          session_code: session.session_code,
          won_at: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Dushanbe' }),
        },
        telegram_chat_id: null,
        notification_type: 'group_buy_win',
        title: '拼团成功通知',
        message: '',
        data: {
          product_name: product?.name || 'Unknown Product',
          session_code: session.session_code,
          won_at: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Dushanbe' }),
        },
        priority: 1,
        status: 'pending',
        scheduled_at: new Date().toISOString(),
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to queue win notification:', error);
    }

    // 11. Update product sold quantity
    try {
      const { error: incrementError } = await supabase.rpc('increment_sold_quantity', {
        product_id: session.product_id,
        amount: 1
      });
      
      if (incrementError) {
        console.error('Failed to increment sold_quantity:', incrementError);
      }
    } catch (error) {
      console.error('Failed to call increment_sold_quantity:', error);
    }

    return createResponse({
      success: true,
      data: {
        winner_id: winnerUUID,
        winning_index: winningIndex,
        total_participants: totalParticipants,
        timestamp_sum: timestampSum.toString(),
        result_id: result?.id,
        result,
      },
    });
  } catch (error) {
    console.error('Group buy draw error:', error);
    return createResponse({ success: false, error: error.message }, 500);
  }
});
