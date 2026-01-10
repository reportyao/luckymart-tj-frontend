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

    // 1. Get product information
    const { data: product, error: productError } = await supabase
      .from('group_buy_products')
      .select('*')
      .eq('id', product_id)
      .eq('status', 'ACTIVE')
      .single();

    if (productError || !product) {
      return createResponse({ success: false, error: 'Product not found or inactive' }, 404);
    }

    // Check stock
    if (product.stock_quantity <= product.sold_quantity) {
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

    // 3. Get user's BALANCE wallet (type='BALANCE')
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .eq('type', 'BALANCE')
      .single();

    if (walletError || !wallet) {
      console.error('Wallet query error:', walletError, 'user_id:', user_id);
      return createResponse({ success: false, error: 'Wallet not found' }, 404);
    }

    // Check balance
    const pricePerPerson = Number(product.price_per_person);
    if (Number(wallet.balance) < pricePerPerson) {
      return createResponse({ 
        success: false, 
        error: 'Insufficient balance',
        required: pricePerPerson,
        current: Number(wallet.balance)
      }, 400);
    }

    let targetSession = null;

    // 4. If session_id or session_code is provided, try to join existing session
    if (session_id || session_code) {
      let sessionQuery = supabase
        .from('group_buy_sessions')
        .select('*')
        .eq('status', 'ACTIVE')
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

      // Check if session is full
      if (existingSession.current_participants >= existingSession.max_participants) {
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
      const sessionCode = generateSessionCode();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + product.timeout_hours);

      const { data: newSession, error: createSessionError } = await supabase
        .from('group_buy_sessions')
        .insert({
          product_id: product.id,
          session_code: sessionCode,
          status: 'ACTIVE',
          current_participants: 0,
          max_participants: product.group_size,
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

    // 6. Deduct balance from wallet
    const newBalance = Number(wallet.balance) - pricePerPerson;
    const { error: updateWalletError } = await supabase
      .from('wallets')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString(),
        version: wallet.version + 1
      })
      .eq('id', wallet.id)
      .eq('version', wallet.version); // Optimistic locking

    if (updateWalletError) {
      console.error('Failed to update wallet:', updateWalletError);
      return createResponse({ success: false, error: 'Failed to deduct balance, please try again' }, 500);
    }

    // 7. Create wallet transaction record
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await supabase
      .from('wallet_transactions')
      .insert({
        id: transactionId,
        wallet_id: wallet.id,
        type: 'GROUP_BUY_PURCHASE',
        amount: -pricePerPerson,
        balance_before: Number(wallet.balance),
        balance_after: newBalance,
        status: 'COMPLETED',
        description: `拼团参与 - ${product.title?.zh || 'Group Buy'}`,
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

    // 8. Create order
    const orderNumber = generateOrderNumber();
    const orderTimestamp = Date.now();

    const { data: order, error: createOrderError } = await supabase
      .from('group_buy_orders')
      .insert({
        session_id: targetSession.id,
        product_id: product.id,
        user_id: user.telegram_id, // 使用 telegram_id 因为外键约束指向 users.telegram_id
        order_number: orderNumber,
        amount: pricePerPerson,
        payment_method: 'WALLET',
        status: 'PAID',
        order_timestamp: orderTimestamp,
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
    if (newParticipantCount >= targetSession.max_participants) {
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
      const rewardResponse = await supabase.functions.invoke('handle-first-group-buy-reward', {
        body: { 
          user_id: user.id,  // 使用 UUID 而不是 telegram_id
          order_id: order.id 
        }
      });
      
      if (rewardResponse.data?.success && rewardResponse.data?.inviter_rewarded) {
        console.log(`[First Group Buy] Inviter rewarded for user ${user.id}'s first group buy`);
      }
    } catch (rewardError) {
      console.error('Failed to process first group buy reward:', rewardError);
      // 奖励处理失败不影响主流程
    }
    
    // 12. 【新增】给参与拼团的用户增加10次AI对话次数
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
        max_participants: targetSession.max_participants,
        is_full: newParticipantCount >= targetSession.max_participants,
        draw_result: drawResult,
      }
    });

  } catch (error) {
    console.error('Group buy join error:', error);
    return createResponse({ success: false, error: error.message }, 500);
  }
});
