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
    const { product_id, session_id, user_id } = await req.json();

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

    // 2. Get user's wallet (use wallets table instead of users table)
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .eq('currency', 'TJS')
      .single();

    if (walletError || !wallet) {
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

    // 3. If session_id is provided, try to join existing session
    if (session_id) {
      const { data: existingSession, error: sessionError } = await supabase
        .from('group_buy_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('status', 'ACTIVE')
        .gt('expires_at', new Date().toISOString())
        .single();

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
        .eq('session_id', session_id)
        .eq('user_id', user_id)
        .single();

      if (existingOrder) {
        return createResponse({ success: false, error: 'You have already joined this session' }, 400);
      }

      targetSession = existingSession;
    } else {
      // 4. Create new session
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
          initiator_id: user_id,
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (createSessionError) {
        console.error('Failed to create session:', createSessionError);
        return createResponse({ success: false, error: 'Failed to create session' }, 500);
      }

      targetSession = newSession;
    }

    // 5. Deduct balance from wallet
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

    // 6. Create wallet transaction record
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

    // 7. Create order
    const orderNumber = generateOrderNumber();
    const orderTimestamp = Date.now();

    const { data: order, error: createOrderError } = await supabase
      .from('group_buy_orders')
      .insert({
        session_id: targetSession.id,
        product_id: product.id,
        user_id: user_id,
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
      return createResponse({ success: false, error: 'Failed to create order' }, 500);
    }

    // 8. Update session participant count
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

    // 9. Check if session is now full, trigger draw
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
