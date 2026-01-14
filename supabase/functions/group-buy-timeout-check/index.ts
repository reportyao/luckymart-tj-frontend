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
    const refundResults: any[] = [];

    // 2. 处理每个超时的会话
    for (const session of timeoutSessions) {
      try {
        // 更新会话状态为TIMEOUT
        await supabase
          .from('group_buy_sessions')
          .update({ 
            status: 'TIMEOUT',
            updated_at: new Date().toISOString()
          })
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

        // 【关键修复】超时退款：退回到TJS余额钱包（原路退回）
        for (const order of orders) {
          // 解析用户UUID
          const userUUID = await resolveUserIdToUUID(supabase, order.user_id);
          
          if (!userUUID) {
            console.error(`Failed to resolve user UUID for user_id: ${order.user_id}`);
            continue;
          }

          // 【修复】获取用户的TJS钱包（使用正确的type='TJS'）
          const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userUUID)
            .eq('type', 'TJS')
            .single();

          if (wallet) {
            const refundAmount = Number(order.amount);
            const newBalance = Number(wallet.balance) + refundAmount;

            // 更新钱包余额
            const { error: updateError } = await supabase
              .from('wallets')
              .update({ 
                balance: newBalance,
                updated_at: new Date().toISOString(),
                version: wallet.version + 1
              })
              .eq('id', wallet.id)
              .eq('version', wallet.version);

            if (updateError) {
              console.error(`Failed to update wallet for user ${userUUID}:`, updateError);
              continue;
            }

            // 创建钱包交易记录
            const transactionId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            await supabase.from('wallet_transactions').insert({
              id: transactionId,
              wallet_id: wallet.id,
              type: 'GROUP_BUY_REFUND_TO_BALANCE',
              amount: refundAmount,
              balance_before: Number(wallet.balance),
              balance_after: newBalance,
              status: 'COMPLETED',
              description: `拼团未成功退款（退回余额）- ${session.session_code}`,
              reference_id: order.id,
              processed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });

            // 更新订单状态
            await supabase
              .from('group_buy_orders')
              .update({
                status: 'TIMEOUT_REFUNDED',
                refund_amount: refundAmount,
                refunded_at: new Date().toISOString(),
              })
              .eq('id', order.id);

            refundResults.push({
              user_id: userUUID,
              order_id: order.id,
              refund_amount: refundAmount,
              refund_type: 'TJS_BALANCE'
            });

            // 发送Telegram通知
            try {
              const { data: product } = await supabase
                .from('group_buy_products')
                .select('name, image_url')
                .eq('id', session.product_id)
                .single();

              // 获取更新后的钱包余额
              const { data: updatedWallet } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', userUUID)
                .eq('type', 'TJS')
                .single();

              await supabase.functions.invoke('send-telegram-notification', {
                body: {
                  user_id: userUUID,
                  type: 'group_buy_timeout',
                  data: {
                    product_name: product?.name || 'Unknown Product',
                    product_image: product?.image_url || '',
                    session_code: session.session_code,
                    refund_amount: refundAmount,
                    wallet_balance: Number(updatedWallet?.balance || 0),
                    refund_type: 'balance', // 标识退回到余额
                  },
                },
              });
            } catch (error) {
              console.error('Failed to send notification:', error);
            }
          } else {
            console.error(`TJS wallet not found for user ${userUUID}`);
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
      refund_results: refundResults,
    });
  } catch (error) {
    console.error('Group buy timeout check error:', error);
    return createResponse({ success: false, error: error.message }, 500);
  }
});
