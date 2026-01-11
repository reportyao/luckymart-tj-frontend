import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// 使用环境变量获取Supabase配置（移除硬编码fallback以避免连接到错误的数据库）
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

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

    // 1. 查找所有超时的拼团会话
    const { data: timeoutSessions, error: sessionsError } = await supabase
      .from('group_buy_sessions')
      .select('*')
      .eq('status', 'ACTIVE')
      .lt('expires_at', new Date().toISOString());

    if (sessionsError) {
      return createResponse({ success: false, error: sessionsError.message }, 500);
    }

    if (!timeoutSessions || timeoutSessions.length === 0) {
      return createResponse({ success: true, message: 'No timeout sessions found', processed: 0 });
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

        // Refund all participants (return to wallet balance)
        for (const order of orders) {
          // 先获取用户信息（同时支持 id 和 telegram_id）
          let userId = order.user_id;
          const { data: userById } = await supabase
            .from('users')
            .select('id')
            .eq('id', order.user_id)
            .single();
          
          if (!userById) {
            const { data: userByTelegramId } = await supabase
              .from('users')
              .select('id')
              .eq('telegram_id', order.user_id)
              .single();
            if (userByTelegramId) {
              userId = userByTelegramId.id;
            }
          }

          // Get user's wallet - 使用 type='TJS'
          const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'BALANCE')
            .single();

          if (wallet) {
            const refundAmount = Number(order.amount);
            const newBalance = Number(wallet.balance) + refundAmount;

            // Update wallet balance
            await supabase
              .from('wallets')
              .update({ 
                balance: newBalance,
                updated_at: new Date().toISOString(),
                version: wallet.version + 1
              })
              .eq('id', wallet.id)
              .eq('version', wallet.version);

            // Create wallet transaction record
            const transactionId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            await supabase.from('wallet_transactions').insert({
              id: transactionId,
              wallet_id: wallet.id,
              type: 'GROUP_BUY_TIMEOUT_REFUND',
              amount: refundAmount,
              balance_before: Number(wallet.balance),
              balance_after: newBalance,
              status: 'COMPLETED',
              description: `拼团超时退款 - ${session.session_code}`,
              reference_id: order.id,
              processed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });

            // Update order status
            await supabase
              .from('group_buy_orders')
              .update({
                status: 'REFUNDED',
                refund_amount: refundAmount,
                refunded_at: new Date().toISOString(),
              })
              .eq('id', order.id);

            // Send Telegram notification
            try {
              // Get product info and user's lucky coins balance
              const { data: product } = await supabase
                .from('group_buy_products')
                .select('name, image_url')
                .eq('id', session.product_id)
                .single();

              const { data: user } = await supabase
                .from('users')
                .select('lucky_coins')
                .eq('telegram_id', order.user_id)
                .single();

              await supabase.functions.invoke('send-telegram-notification', {
                body: {
                  user_id: order.user_id,
                  type: 'group_buy_timeout',
                  data: {
                    product_name: product?.name || 'Unknown Product',
                    product_image: product?.image_url || '',
                    session_code: session.session_code,
                    refund_amount: refundAmount,
                    lucky_coins_balance: Number(user?.lucky_coins || 0),
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

    return createResponse({
      success: true,
      message: `Processed ${processedCount} timeout sessions`,
      processed: processedCount,
      total: timeoutSessions.length,
    });
  } catch (error) {
    console.error('Group buy timeout check error:', error);
    return createResponse({ success: false, error: error.message }, 500);
  }
});
