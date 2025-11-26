import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

    // 调用 RPC 实现单向兑换：余额 -> 幸运币
    // 注意：RPC 函数期望 uuid 类型，需要进行类型转换
    const rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/exchange_real_to_bonus_balance`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'params=single-object'
        },
        body: JSON.stringify({
          p_user_id: userId,  // PostgreSQL will auto-cast text to uuid
          p_amount: parseFloat(amount)
        })
      }
    );

    console.log('[Exchange] RPC response status:', rpcResponse.status);

    if (!rpcResponse.ok) {
      const errorText = await rpcResponse.text();
      console.error('[Exchange] RPC调用失败:', errorText);
      
      // 尝试解析错误信息
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || '兑换失败');
      } catch {
        throw new Error(errorText || '兑换失败');
      }
    }

    const data = await rpcResponse.json();

    console.log('[Exchange] Success, new balance:', data);

    return new Response(
      JSON.stringify({ success: true, message: 'Exchange successful', new_balance: data }),
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
