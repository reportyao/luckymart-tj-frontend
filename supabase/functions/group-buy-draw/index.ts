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

    // 7. 创建开奖结果记录
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

    // 8. Refund non-winners (convert to Lucky Coins)
    for (const order of orders) {
      if (order.id !== winnerOrder.id) {
        // Update user's lucky_coins balance
        const { data: user } = await supabase
          .from('users')
          .select('lucky_coins')
          .eq('telegram_id', order.user_id)
          .single();

        if (user) {
          const refundAmount = Number(order.amount);
          const newLuckyCoins = (Number(user.lucky_coins) || 0) + refundAmount;
          
          await supabase
            .from('users')
            .update({ lucky_coins: newLuckyCoins })
            .eq('telegram_id', order.user_id);

          // Get user's wallet for transaction record
          const { data: wallet } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', order.user_id)
            .eq('currency', 'TJS')
            .single();

          if (wallet) {
            // Create wallet transaction record
            const transactionId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            await supabase.from('wallet_transactions').insert({
              id: transactionId,
              wallet_id: wallet.id,
              type: 'GROUP_BUY_REFUND',
              amount: refundAmount,
              balance_before: 0, // Lucky coins, not wallet balance
              balance_after: newLuckyCoins,
              status: 'COMPLETED',
              description: `拼团未中奖退款（转为幸运币）`,
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
          await supabase.functions.invoke('send-telegram-notification', {
            body: {
              user_id: order.user_id,
              type: 'GROUP_BUY_REFUND',
              data: {
                session_code: session.session_code,
                amount: Number(order.amount),
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
      await supabase.functions.invoke('send-telegram-notification', {
        body: {
          user_id: winnerOrder.user_id,
          type: 'GROUP_BUY_WIN',
          data: {
            session_code: session.session_code,
            product_id: session.product_id,
          },
        },
      });
    } catch (error) {
      console.error('Failed to send win notification:', error);
    }

    // 10. Update product sold quantity
    await supabase
      .from('group_buy_products')
      .update({ 
        sold_quantity: session.product_id ? 1 : 0 // Increment by 1 for each successful draw
      })
      .eq('id', session.product_id);

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
