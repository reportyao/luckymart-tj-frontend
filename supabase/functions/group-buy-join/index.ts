import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://owyitxwxmxwbkqgzffdw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { product_id, session_id, user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. 获取商品信息
    const { data: product, error: productError } = await supabase
      .from('group_buy_products')
      .select('*')
      .eq('id', product_id)
      .eq('status', 'ACTIVE')
      .single();

    if (productError || !product) {
      return new Response(JSON.stringify({ success: false, error: 'Product not found or inactive' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 检查用户余额
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('telegram_id', user_id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (user.balance < product.price_per_person) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient balance' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. 查找或创建拼团会话
    let session;
    if (session_id) {
      // 加入现有拼团
      const { data: existingSession, error: sessionError } = await supabase
        .from('group_buy_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('status', 'ACTIVE')
        .single();

      if (sessionError || !existingSession) {
        return new Response(JSON.stringify({ success: false, error: 'Session not found or expired' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 检查是否已满员
      if (existingSession.current_participants >= existingSession.max_participants) {
        return new Response(JSON.stringify({ success: false, error: 'Session is full' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 检查是否已过期
      if (new Date(existingSession.expires_at) < new Date()) {
        return new Response(JSON.stringify({ success: false, error: 'Session has expired' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      session = existingSession;
    } else {
      // 创建新拼团
      const sessionCode = `GB${Date.now()}`;
      const expiresAt = new Date(Date.now() + product.timeout_hours * 60 * 60 * 1000);

      const { data: newSession, error: createError } = await supabase
        .from('group_buy_sessions')
        .insert({
          product_id: product.id,
          session_code: sessionCode,
          max_participants: product.group_size,
          initiator_id: user_id,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (createError || !newSession) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to create session' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      session = newSession;
    }

    // 4. 检查用户是否已参与此拼团
    const { data: existingOrder } = await supabase
      .from('group_buy_orders')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user_id)
      .single();

    if (existingOrder) {
      return new Response(JSON.stringify({ success: false, error: 'You have already joined this group buy' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. 使用事务创建订单并扣款
    const orderNumber = `GBO${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const orderTimestamp = Date.now();

    // 扣除余额
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: user.balance - product.price_per_person })
      .eq('telegram_id', user_id);

    if (balanceError) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to deduct balance' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 创建订单
    const { data: order, error: orderError } = await supabase
      .from('group_buy_orders')
      .insert({
        session_id: session.id,
        product_id: product.id,
        user_id: user_id,
        order_number: orderNumber,
        amount: product.price_per_person,
        order_timestamp: orderTimestamp,
      })
      .select()
      .single();

    if (orderError || !order) {
      // 回滚余额
      await supabase
        .from('users')
        .update({ balance: user.balance })
        .eq('telegram_id', user_id);

      return new Response(JSON.stringify({ success: false, error: 'Failed to create order' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 记录钱包交易
    await supabase.from('wallet_transactions').insert({
      user_id: user_id,
      type: 'GROUP_BUY_PAYMENT',
      amount: -product.price_per_person,
      balance_after: user.balance - product.price_per_person,
      description: `拼团支付: ${product.title.zh || 'Group Buy'}`,
      reference_id: order.id,
    });

    // 6. 更新拼团会话参与人数
    const { data: updatedSession, error: updateError } = await supabase
      .from('group_buy_sessions')
      .update({ current_participants: session.current_participants + 1 })
      .eq('id', session.id)
      .select()
      .single();

    if (updateError || !updatedSession) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to update session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 7. 检查是否满员，触发开奖
    if (updatedSession.current_participants >= updatedSession.max_participants) {
      // 调用开奖函数
      await supabase.functions.invoke('group-buy-draw', {
        body: { session_id: session.id },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          order,
          session: updatedSession,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Group buy join error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
