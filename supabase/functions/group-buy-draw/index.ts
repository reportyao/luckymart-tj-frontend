import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://owyitxwxmxwbkqgzffdw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Helper function to create response with CORS headers
function createResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
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

    // 3. 计算时间戳总和
    const timestampSum = orders.reduce((sum, order) => sum + BigInt(order.order_timestamp), BigInt(0));
    const totalParticipants = orders.length;

    // 4. 使用时间戳算法确定中奖索引
    const winningIndex = Number(timestampSum % BigInt(totalParticipants));
    const winnerOrder = orders[winningIndex];

    // 5. 更新拼团会话状态
    await supabase
      .from('group_buy_sessions')
      .update({
        status: 'SUCCESS',
        completed_at: new Date().toISOString(),
        drawn_at: new Date().toISOString(),
        winner_id: winnerOrder.user_id,
        winning_timestamp_sum: timestampSum.toString(),
      })
      .eq('id', session_id);

    // 6. 更新中奖订单状态
    await supabase
      .from('group_buy_orders')
      .update({ status: 'WON' })
      .eq('id', winnerOrder.id);

    // 7. 创建开奖结果记录（包含 pickup_status 字段，初始状态为 PENDING_CLAIM）
    // 设置领取过期时间为30天后
    const claimExpiresAt = new Date();
    claimExpiresAt.setDate(claimExpiresAt.getDate() + 30);
    
    const { data: result, error: resultError } = await supabase
      .from('group_buy_results')
      .insert({
        session_id: session_id,
        product_id: session.product_id,
        winner_id: winnerOrder.user_id,
        winner_order_id: winnerOrder.id,
        total_participants: totalParticipants,
        timestamp_sum: timestampSum.toString(),
        winning_index: winningIndex,
        pickup_status: 'PENDING_CLAIM',  // 初始状态：待确认领取
        expires_at: claimExpiresAt.toISOString(),  // 领取过期时间
        algorithm_data: {
          orders: orders.map((o) => ({
            user_id: o.user_id,
            timestamp: o.order_timestamp,
          })),
          calculation: {
            timestamp_sum: timestampSum.toString(),
            total_participants: totalParticipants,
            winning_index: winningIndex,
            formula: 'winning_index = timestamp_sum % total_participants',
          },
        },
      })
      .select()
      .single();

    if (resultError || !result) {
      console.error('Failed to create result:', resultError);
    }

    // 8. Refund non-winners (convert to Points/Lucky Coins)
    for (const order of orders) {
      if (order.id !== winnerOrder.id) {
        // Get user info - 同时支持 id 和 telegram_id
        let userId = order.user_id;
        
        // 先尝试用 id 查询（UUID）
        const { data: userById } = await supabase
          .from('users')
          .select('id')
          .eq('id', order.user_id)
          .single();
        
        if (userById) {
          userId = userById.id;
        } else {
          // 再尝试用 telegram_id 查询
          const { data: userByTelegramId } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', order.user_id)
            .single();
          if (userByTelegramId) {
            userId = userByTelegramId.id;
          }
        }

        if (userId) {
          const refundAmount = Number(order.amount);
          
          // Get user's LUCKY_COIN wallet (积分钱包)
          const { data: luckyWallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'LUCKY_COIN')
            .single();

          if (luckyWallet) {
            // Update LUCKY_COIN wallet balance (退积分)
            const newBalance = Number(luckyWallet.balance) + refundAmount;
            
            await supabase
              .from('wallets')
              .update({ 
                balance: newBalance,
                updated_at: new Date().toISOString(),
                version: luckyWallet.version + 1
              })
              .eq('id', luckyWallet.id)
              .eq('version', luckyWallet.version);

            // Create wallet transaction record
            const transactionId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            await supabase.from('wallet_transactions').insert({
              id: transactionId,
              wallet_id: luckyWallet.id,
              type: 'GROUP_BUY_REFUND_TO_POINTS',
              amount: refundAmount,
              balance_before: Number(luckyWallet.balance),
              balance_after: newBalance,
              status: 'COMPLETED',
              description: `拼团未中奖退积分`,
              reference_id: order.id,
              processed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
          }

          // Update order refund info
          await supabase
            .from('group_buy_orders')
            .update({
              status: 'REFUNDED',
              refund_lucky_coins: refundAmount,
              refunded_at: new Date().toISOString(),
            })
            .eq('id', order.id);
        }

        // Send Telegram notification (non-winner)
        try {
          // Get product info for notification
          const { data: product } = await supabase
            .from('group_buy_products')
            .select('name, image_url')
            .eq('id', session.product_id)
            .single();

          // Get updated lucky coins balance from wallet
          const { data: updatedWallet } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .eq('type', 'LUCKY_COIN')
            .single();

          await supabase.functions.invoke('send-telegram-notification', {
            body: {
              user_id: userId,
              type: 'group_buy_refund',
              data: {
                product_name: product?.name || 'Unknown Product',
                product_image: product?.image_url || '',
                session_code: session.session_code,
                refund_amount: Number(order.amount),
                lucky_coins_balance: Number(updatedWallet?.balance || 0),
              },
            },
          });
        } catch (error) {
          console.error('Failed to send notification:', error);
        }
      }
    }

    // 9. 发送中奖通知
    try {
      // Get product info for notification
      const { data: product } = await supabase
        .from('group_buy_products')
        .select('name, image_url')
        .eq('id', session.product_id)
        .single();

      await supabase.functions.invoke('send-telegram-notification', {
        body: {
          user_id: winnerOrder.user_id,
          type: 'group_buy_win',
          data: {
            product_name: product?.name || 'Unknown Product',
            product_image: product?.image_url || '',
            session_code: session.session_code,
            won_at: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Dushanbe' }),
          },
        },
      });
    } catch (error) {
      console.error('Failed to send win notification:', error);
    }

    // 10. Update product sold quantity (increment by 1)
    const { error: incrementError } = await supabase.rpc('increment_sold_quantity', {
      product_id: session.product_id,
      amount: 1
    });
    
    if (incrementError) {
      console.error('Failed to increment sold_quantity:', incrementError);
      // Don't fail the whole draw, just log the error
    }

    return createResponse({
      success: true,
      data: {
        winner_id: winnerOrder.user_id,
        winning_index: winningIndex,
        total_participants: totalParticipants,
        timestamp_sum: timestampSum.toString(),
        result,
      },
    });
  } catch (error) {
    console.error('Group buy draw error:', error);
    return createResponse({ success: false, error: error.message }, 500);
  }
});
