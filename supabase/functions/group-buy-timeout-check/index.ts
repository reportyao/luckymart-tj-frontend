import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://owyitxwxmxwbkqgzffdw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. 查找所有超时的拼团会话
    const { data: timeoutSessions, error: sessionsError } = await supabase
      .from('group_buy_sessions')
      .select('*')
      .eq('status', 'ACTIVE')
      .lt('expires_at', new Date().toISOString());

    if (sessionsError) {
      return new Response(JSON.stringify({ success: false, error: sessionsError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!timeoutSessions || timeoutSessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No timeout sessions found', processed: 0 }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let processedCount = 0;

    // 2. 处理每个超时的会话
    for (const session of timeoutSessions) {
      try {
        // 更新会话状态为TIMEOUT
        await supabase
          .from('group_buy_sessions')
          .update({ status: 'TIMEOUT' })
          .eq('id', session.id);

        // 获取该会话的所有订单
        const { data: orders, error: ordersError } = await supabase
          .from('group_buy_orders')
          .select('*')
          .eq('session_id', session.id);

        if (ordersError || !orders) {
          console.error(`Failed to get orders for session ${session.id}:`, ordersError);
          continue;
        }

        // 给所有参与用户退款（退回余额）
        for (const order of orders) {
          // 获取用户当前余额
          const { data: user } = await supabase
            .from('users')
            .select('balance')
            .eq('telegram_id', order.user_id)
            .single();

          if (user) {
            const newBalance = (user.balance || 0) + order.amount;

            // 更新用户余额
            await supabase
              .from('users')
              .update({ balance: newBalance })
              .eq('telegram_id', order.user_id);

            // 记录钱包交易
            await supabase.from('wallet_transactions').insert({
              user_id: order.user_id,
              type: 'GROUP_BUY_REFUND_BALANCE',
              amount: order.amount,
              balance_after: newBalance,
              description: `拼团超时退款`,
              reference_id: order.id,
            });

            // 更新订单状态
            await supabase
              .from('group_buy_orders')
              .update({
                status: 'REFUNDED',
                refund_amount: order.amount,
                refunded_at: new Date().toISOString(),
              })
              .eq('id', order.id);

            // 发送Telegram通知
            try {
              await supabase.functions.invoke('send-telegram-notification', {
                body: {
                  user_id: order.user_id,
                  type: 'GROUP_BUY_TIMEOUT',
                  data: {
                    session_code: session.session_code,
                    refund_amount: order.amount,
                  },
                },
              });
            } catch (error) {
              console.error('Failed to send notification:', error);
            }
          }
        }

        processedCount++;
      } catch (error) {
        console.error(`Failed to process timeout session ${session.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} timeout sessions`,
        processed: processedCount,
        total: timeoutSessions.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Group buy timeout check error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
