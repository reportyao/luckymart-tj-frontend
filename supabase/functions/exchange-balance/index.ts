import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 通用的 session 验证函数
async function validateSession(sessionToken: string) {
  if (!sessionToken) {
    throw new Error('未授权：缺少认证令牌');
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('服务器配置错误');
  }

  // 查询 user_sessions 表验证 session (不使用关联查询避免类型冲突)
  const sessionResponse = await fetch(
    `${supabaseUrl}/rest/v1/user_sessions?session_token=eq.${sessionToken}&is_active=eq.true&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!sessionResponse.ok) {
    throw new Error('验证会话失败');
  }

  const sessions = await sessionResponse.json();
  
  if (sessions.length === 0) {
    throw new Error('未授权：会话不存在或已失效');
  }

  const session = sessions[0];

  // 检查 session 是否过期
  const expiresAt = new Date(session.expires_at);
  const now = new Date();
  
  if (expiresAt < now) {
    throw new Error('未授权：会话已过期');
  }

  // 单独查询用户数据
  const userResponse = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${session.user_id}&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!userResponse.ok) {
    throw new Error('查询用户信息失败');
  }

  const users = await userResponse.json();
  
  if (users.length === 0) {
    throw new Error('未授权：用户不存在');
  }

  return {
    userId: session.user_id,
    user: users[0],
    session: session
  };
}

serve(async (req) => {
  // 允许 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 从 body 中获取 session_token 和 amount
    const body = await req.json()
    const { session_token, amount } = body

    console.log('[Exchange] Received request:', { session_token: session_token ? 'present' : 'missing', amount });

    if (!session_token) {
      throw new Error('未授权：缺少 session_token');
    }

    if (!amount || amount <= 0) {
      throw new Error('兑换金额必须大于0');
    }

    // 验证用户 session
    const { userId } = await validateSession(session_token);
    
    console.log('[Exchange] User validated:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 创建 Supabase 客户端
    const supabaseClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 获取源钱包（BALANCE）
    const { data: sourceWallet, error: sourceError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'BALANCE')
      .eq('currency', 'TJS')
      .single()

    if (sourceError || !sourceWallet) {
      console.error('[Exchange] Source wallet error:', sourceError);
      throw new Error('未找到余额钱包');
    }

    // 获取目标钱包（LUCKY_COIN）
    const { data: targetWallet, error: targetError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'LUCKY_COIN')
      .eq('currency', 'TJS')
      .single()

    if (targetError || !targetWallet) {
      console.error('[Exchange] Target wallet error:', targetError);
      throw new Error('未找到积分钱包');
    }

    // 检查源钱包余额
    if (sourceWallet.balance < amount) {
      throw new Error('余额不足');
    }

    console.log('[Exchange] Wallets found, processing exchange...');
    console.log('[Exchange] Source balance:', sourceWallet.balance, 'Amount:', amount);
    console.log('[Exchange] Target balance:', targetWallet.balance);

    // 记录兑换前余额
    const sourceBalanceBefore = sourceWallet.balance;
    const targetBalanceBefore = targetWallet.balance;

    // 更新源钱包余额
    const { error: updateSourceError } = await supabaseClient
      .from('wallets')
      .update({
        balance: sourceWallet.balance - amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceWallet.id)

    if (updateSourceError) {
      console.error('[Exchange] Update source wallet error:', updateSourceError);
      throw new Error('更新余额钱包失败');
    }

    // 更新目标钱包余额
    const { error: updateTargetError } = await supabaseClient
      .from('wallets')
      .update({
        balance: targetWallet.balance + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetWallet.id)

    if (updateTargetError) {
      console.error('[Exchange] Update target wallet error:', updateTargetError);
      // 回滚源钱包
      await supabaseClient
        .from('wallets')
        .update({
          balance: sourceWallet.balance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sourceWallet.id)
      throw new Error('更新积分钱包失败');
    }

    // 创建兑换记录
    const { data: exchangeRecord, error: recordError } = await supabaseClient
      .from('exchange_records')
      .insert({
        user_id: userId,
        exchange_type: 'BALANCE_TO_COIN',
        amount: amount,
        currency: 'TJS',
        exchange_rate: 1.0,
        source_wallet_id: sourceWallet.id,
        target_wallet_id: targetWallet.id,
        source_balance_before: sourceBalanceBefore,
        source_balance_after: sourceWallet.balance - amount,
        target_balance_before: targetBalanceBefore,
        target_balance_after: targetWallet.balance + amount,
      })
      .select()
      .single()

    if (recordError) {
      console.error('[Exchange] Create exchange record error:', recordError);
    }

    // 创建钱包交易记录 (使用正确的枚举值 COIN_EXCHANGE)
    const txId1 = `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const txId2 = `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    await supabaseClient.from('wallet_transactions').insert([
      {
        id: txId1,
        wallet_id: sourceWallet.id,
        type: 'COIN_EXCHANGE',
        amount: -amount,
        balance_before: sourceBalanceBefore,
        balance_after: sourceWallet.balance - amount,
        status: 'COMPLETED',
        description: `兑换${amount}TJS到积分`,
        processed_at: new Date().toISOString(),
      },
      {
        id: txId2,
        wallet_id: targetWallet.id,
        type: 'COIN_EXCHANGE',
        amount: amount,
        balance_before: targetBalanceBefore,
        balance_after: targetWallet.balance + amount,
        status: 'COMPLETED',
        description: `从余额兑换${amount}TJS`,
        processed_at: new Date().toISOString(),
      },
    ])

    console.log('[Exchange] Success, new balances:', {
      source: sourceWallet.balance - amount,
      target: targetWallet.balance + amount
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '兑换成功',
        new_balance: sourceWallet.balance - amount,
        lucky_coin_balance: targetWallet.balance + amount
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
    )

  } catch (error) {
    console.error('[Exchange] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
    )
  }
})
