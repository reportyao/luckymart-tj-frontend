import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://owyitxwxmxwbkqgzffdw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { session_id } = await req.json();

    // 1. 获取拼团会话信息
    const { data: session, error: sessionError } = await supabase
      .from('group_buy_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ success: false, error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 获取所有订单
    const { data: orders, error: ordersError } = await supabase
      .from('group_buy_orders')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (ordersError || !orders || orders.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No orders found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
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

    // 8. 给未中奖用户退款（转为幸运币）
    for (const order of orders) {
      if (order.id !== winnerOrder.id) {
        // 更新用户幸运币余额
        const { data: user } = await supabase
          .from('users')
          .select('lucky_coins')
          .eq('telegram_id', order.user_id)
          .single();

        if (user) {
          const newLuckyCoins = (user.lucky_coins || 0) + order.amount;
          await supabase
            .from('users')
            .update({ lucky_coins: newLuckyCoins })
            .eq('telegram_id', order.user_id);

          // 记录钱包交易
          await supabase.from('wallet_transactions').insert({
            user_id: order.user_id,
            type: 'GROUP_BUY_REFUND_LUCKY_COINS',
            amount: order.amount,
            balance_after: newLuckyCoins,
            description: `拼团未中奖退款（幸运币）`,
            reference_id: order.id,
          });

          // 更新订单退款信息
          await supabase
            .from('group_buy_orders')
            .update({
              refund_lucky_coins: order.amount,
              refunded_at: new Date().toISOString(),
            })
            .eq('id', order.id);
        }

        // 发送Telegram通知（未中奖）
        try {
          await supabase.functions.invoke('send-telegram-notification', {
            body: {
              user_id: order.user_id,
              type: 'GROUP_BUY_REFUND',
              data: {
                session_code: session.session_code,
                amount: order.amount,
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

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          winner_id: winnerOrder.user_id,
          winning_index: winningIndex,
          total_participants: totalParticipants,
          result,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Group buy draw error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
