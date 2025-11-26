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

  // 查询 user_sessions 表验证 session
  const sessionResponse = await fetch(
    `${supabaseUrl}/rest/v1/user_sessions?session_token=eq.${sessionToken}&is_active=eq.true&select=*,users(*)`,
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

  // 检查是否有用户数据
  if (!session.users) {
    throw new Error('未授权：用户不存在');
  }

  return {
    userId: session.user_id,
    user: session.users,
    session: session
  };
}

// 生成提现订单号
function generateOrderNumber(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `WD${timestamp}${random}`;
}

serve(async (req) => {
  // 允许 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 从 body 中获取 session_token
    const body = await req.json()
    const { 
      session_token, 
      amount, 
      currency, 
      withdrawalMethod,
      bankName,
      bankAccountNumber,
      bankAccountName,
      bankBranch,
      idCardNumber,
      idCardName,
      phoneNumber,
      mobileWalletNumber,
      mobileWalletName
    } = body

    if (!session_token) {
      throw new Error('未授权：缺少 session_token');
    }

    // 验证用户 session
    const { userId } = await validateSession(session_token);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 生成订单号
    const orderNumber = generateOrderNumber();

    // 直接插入 withdrawal_requests 表
    const insertResponse = await fetch(
      `${supabaseUrl}/rest/v1/withdrawal_requests`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: userId,
          order_number: orderNumber,
          amount: amount,
          currency: currency || 'TJS',
          withdrawal_method: withdrawalMethod,
          bank_name: bankName,
          bank_account_number: bankAccountNumber,
          bank_account_name: bankAccountName,
          bank_branch: bankBranch,
          id_card_number: idCardNumber,
          id_card_name: idCardName,
          phone_number: phoneNumber,
          mobile_wallet_number: mobileWalletNumber,
          mobile_wallet_name: mobileWalletName,
          status: 'PENDING'
        })
      }
    );

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      console.error('插入提现请求失败:', errorText);
      throw new Error('创建提现请求失败');
    }

    const data = await insertResponse.json();

    return new Response(
      JSON.stringify({ success: true, message: 'Withdrawal request created', data }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
    )

  } catch (error) {
    console.error('withdraw_request error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
    )
  }
})
