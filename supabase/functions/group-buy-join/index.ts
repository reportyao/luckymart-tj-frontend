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

// Generate unique order number
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `GB${timestamp}${random}`;
}

// Generate session code
function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { product_id, session_id, session_code, user_id } = await req.json();

    // Validate required parameters
    if (!product_id || !user_id) {
      return createResponse({ success: false, error: 'Product ID and User ID are required' }, 400);
    }

    // 1. Get product information - 使用兼容的字段名
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

    // 兼容不同的字段名 - 优先使用stock字段，因为stock_quantity可能为0但stock有值
    const stockQuantity = product.stock ?? product.stock_quantity ?? 0;
    const soldQuantity = product.sold_quantity ?? 0;
    const pricePerPerson = Number(product.price_per_person) || Number(product.group_price) || 0;
    const timeoutHours = product.timeout_hours ?? product.duration_hours ?? 24;
    const groupSize = product.group_size ?? product.max_participants ?? 3;
    const productTitle = product.title ?? product.name_i18n ?? { zh: product.name };

    // Check stock
    if (stockQuantity <= soldQuantity) {
      return createResponse({ success: false, error: 'Product out of stock' }, 400);
    }

    // 2. Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, telegram_id')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('User query error:', userError, 'user_id:', user_id);
      return createResponse({ success: false, error: 'User not found' }, 404);
    }

    // 3. Get user's TJS wallet (type='TJS')
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .eq('type', 'TJS')
      .single();

    if (walletError || !wallet) {
      console.error('Wallet query error:', walletError, 'user_id:', user_id);
      return createResponse({ success: false, error: 'Wallet not found' }, 404);
    }

    // Check available balance (balance - frozen_balance)
    const availableBalance = Number(wallet.balance) - Number(wallet.frozen_balance || 0);
    if (availableBalance < pricePerPerson) {
      return createResponse({ 
        success: false, 
        error: 'Insufficient balance',
        required: pricePerPerson,
        current: availableBalance
      }, 400);
    }

    let targetSession = null;

    // 4. If session_id or session_code is provided, try to join existing session
    if (session_id || session_code) {
      let sessionQuery = supabase
        .from('group_buy_sessions')
        .select('*')
        .in('status', ['ACTIVE', 'active'])
        .gt('expires_at', new Date().toISOString());
      
      if (session_id) {
        sessionQuery = sessionQuery.eq('id', session_id);
      } else if (session_code) {
        sessionQuery = sessionQuery.eq('session_code', session_code);
      }
      
      const { data: existingSession, error: sessionError } = await sessionQuery.single();

      if (sessionError || !existingSession) {
        return createResponse({ success: false, error: 'Session not found or expired' }, 404);
      }

      // 兼容不同的字段名
      const maxParticipants = existingSession.max_participants ?? existingSession.required_participants ?? groupSize;

      // Check if session is full
      if (existingSession.current_participants >= maxParticipants) {
        return createResponse({ success: false, error: 'Session is full' }, 400);
      }

      // Check if user already joined this session
      const { data: existingOrder } = await supabase
        .from('group_buy_orders')
        .select('id')
        .eq('session_id', existingSession.id)
        .eq('user_id', user.telegram_id) // 使用 telegram_id 因为外键约束指向 users.telegram_id
        .single();

      if (existingOrder) {
        return createResponse({ success: false, error: 'You have already joined this session' }, 400);
      }

      targetSession = existingSession;
    } else {
      // 5. Create new session
      const newSessionCode = generateSessionCode();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + timeoutHours);

      const { data: newSession, error: createSessionError } = await supabase
        .from('group_buy_sessions')
        .insert({
          product_id: product.id,
          session_code: newSessionCode,
          status: 'ACTIVE',
          current_participants: 0,
          group_size: groupSize,
          max_participants: groupSize,
          required_participants: groupSize,
          initiator_id: user.telegram_id,
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (createSessionError) {
        console.error('Failed to create session:', createSessionError);
        return createResponse({ success: false, error: 'Failed to create session: ' + createSessionError.message }, 500);
      }

      targetSession = newSession;
    }

    // 生成订单号
    const orderNumber = generateOrderNumber();

    // 6. Deduct balance from wallet using optimistic locking
    const newBalance = Number(wallet.balance) - pricePerPerson;
    const { error: updateWalletError, data: updatedWallet } = await supabase
      .from('wallets')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString(),
        version: wallet.version + 1
      })
      .eq('id', wallet.id)
      .eq('version', wallet.version) // Optimistic locking
      .select()
      .single();

    if (updateWalletError || !updatedWallet) {
      console.error('Failed to update wallet:', updateWalletError);
      return createResponse({ success: false, error: 'Failed to deduct balance, please try again (concurrent modification detected)' }, 500);
    }

    // 7. Create wallet transaction record
    // 移除手动指定的 ID，让数据库自动生成 UUID
    await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'GROUP_BUY_PURCHASE',
        amount: -pricePerPerson,
        balance_before: Number(wallet.balance),
        balance_after: newBalance,
        status: 'COMPLETED',
        description: `拼团参与 - ${productTitle?.zh || productTitle?.en || 'Group Buy'}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    // 8. Create order
    const { data: order, error: createOrderError } = await supabase
      .from('group_buy_orders')
      .insert({
        session_id: targetSession.id,
        user_id: user.id, // 使用 UUID，已删除外键约束
        product_id: product.id,
        order_number: orderNumber,
        order_timestamp: Date.now(),
        amount: pricePerPerson,
        status: 'PAID',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createOrderError) {
      console.error('Failed to create order:', createOrderError);
      // Rollback wallet balance
      await supabase
        .from('wallets')
        .update({ 
          balance: Number(wallet.balance),
          version: wallet.version + 2
        })
        .eq('id', wallet.id);
      return createResponse({ success: false, error: 'Failed to create order: ' + createOrderError.message }, 500);
    }

    // 9. Update session participant count
    const maxParticipants = targetSession.max_participants ?? targetSession.required_participants ?? groupSize;
    const newParticipantCount = targetSession.current_participants + 1;
    const { error: updateSessionError } = await supabase
      .from('group_buy_sessions')
      .update({ 
        current_participants: newParticipantCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetSession.id);

    if (updateSessionError) {
      console.error('Failed to update session:', updateSessionError);
    }

    // 10. Check if session is now full, trigger draw
    let drawResult = null;
    if (newParticipantCount >= maxParticipants) {
      // Call draw function
      try {
        const drawResponse = await supabase.functions.invoke('group-buy-draw', {
          body: { session_id: targetSession.id }
        });
        
        if (drawResponse.data?.success) {
          drawResult = drawResponse.data;
        }
      } catch (drawError) {
        console.error('Failed to trigger draw:', drawError);
        // Draw will be handled by timeout check or manual trigger
      }
    }

    // 11. 【新增】处理首次拼团奖励（给邀请人增加2次抽奖机会）
    try {
      console.log(`[First Group Buy] Checking reward for user ${user.id}, order ${order.id}`);
      const rewardResponse = await supabase.functions.invoke('handle-first-group-buy-reward', {
        body: { 
          user_id: user.id,  // 使用 UUID 而不是 telegram_id
          order_id: order.id 
        }
      });
      
      console.log(`[First Group Buy] Reward response:`, rewardResponse.data);
      
      if (rewardResponse.data?.success && rewardResponse.data?.inviter_rewarded) {
        console.log(`[First Group Buy] ✅ Inviter rewarded for user ${user.id}'s first group buy`);
      } else if (rewardResponse.data?.success && !rewardResponse.data?.inviter_rewarded) {
        console.log(`[First Group Buy] ℹ️ No inviter reward: ${rewardResponse.data?.message}`);
      }
    } catch (rewardError) {
      console.error('[First Group Buy] ❌ Failed to process reward:', rewardError);
      // 奖励处理失败不影响主流程
    }
    
    // 12. 【新增】处理推荐佣金
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      // 获取用户的推荐关系
      const { data: userWithReferrer } = await supabase
        .from('users')
        .select('referred_by_id')
        .eq('id', user.id)
        .single();
      
      if (userWithReferrer?.referred_by_id) {
        const commissionResponse = await fetch(`${supabaseUrl}/functions/v1/handle-purchase-commission`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: order.id,
            user_id: user.id,
            order_amount: pricePerPerson
          }),
        });
        
        if (!commissionResponse.ok) {
          console.error('Failed to process commission:', await commissionResponse.text());
        } else {
          console.log(`[Commission] Successfully processed commission for order ${order.id}`);
        }
      }
    } catch (commissionError) {
      console.error('Commission processing error:', commissionError);
      // 佣金处理失败不影响主流程
    }
    
    // 13. 【新增】给参与拼团的用户增加10次AI对话次数
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      await fetch(`${supabaseUrl}/functions/v1/ai-add-bonus`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          amount: 10,
          reason: 'group_buy_participation'
        })
      });
      
      console.log(`[Group Buy] Awarded 10 AI chats to user ${user.id} for participating`);
    } catch (aiRewardError) {
      console.error('Failed to process AI group buy reward:', aiRewardError);
      // AI奖励失败不影响主流程
    }

    return createResponse({
      success: true,
      data: {
        order_id: order.id,
        order_number: orderNumber,
        session_id: targetSession.id,
        session_code: targetSession.session_code,
        current_participants: newParticipantCount,
        max_participants: maxParticipants,
        is_full: newParticipantCount >= maxParticipants,
        draw_result: drawResult,
      }
    });

  } catch (error) {
    console.error('Group buy join error:', error);
    return createResponse({ success: false, error: error.message }, 500);
  }
});
