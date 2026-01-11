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
      currency = 'TJS', 
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

    if (!amount || amount <= 0) {
      throw new Error('提现金额必须大于0');
    }

    // 验证用户 session
    const { userId } = await validateSession(session_token);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 1. 获取用户钱包
    const walletResponse = await fetch(
      `${supabaseUrl}/rest/v1/wallets?user_id=eq.${userId}&type=eq.TJS&currency=eq.${currency}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!walletResponse.ok) {
      throw new Error('获取钱包信息失败');
    }

    const wallets = await walletResponse.json();
    
    if (wallets.length === 0) {
      throw new Error('未找到用户钱包');
    }

    const wallet = wallets[0];

    // 2. 检查余额是否足够
    const currentBalance = parseFloat(wallet.balance) || 0;
    const withdrawAmount = parseFloat(amount);

    if (currentBalance < withdrawAmount) {
      throw new Error(`余额不足，当前余额: ${currentBalance} ${currency}`);
    }

    // 3. 冻结余额（减少balance，增加frozen_balance）
    const newBalance = currentBalance - withdrawAmount;
    const newFrozenBalance = (parseFloat(wallet.frozen_balance) || 0) + withdrawAmount;

    const updateWalletResponse = await fetch(
      `${supabaseUrl}/rest/v1/wallets?id=eq.${wallet.id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          balance: newBalance,
          frozen_balance: newFrozenBalance,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!updateWalletResponse.ok) {
      const errorText = await updateWalletResponse.text();
      console.error('冻结余额失败:', errorText);
      throw new Error('冻结余额失败');
    }

    // 4. 生成订单号
    const orderNumber = generateOrderNumber();

    // 5. 创建提现请求
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
          amount: withdrawAmount,
          currency: currency,
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
      // 如果创建提现请求失败，需要回滚钱包冻结
      await fetch(
        `${supabaseUrl}/rest/v1/wallets?id=eq.${wallet.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            balance: currentBalance,
            frozen_balance: parseFloat(wallet.frozen_balance) || 0,
            updated_at: new Date().toISOString()
          })
        }
      );
      
      const errorText = await insertResponse.text();
      console.error('创建提现请求失败:', errorText);
      throw new Error('创建提现请求失败');
    }

    const data = await insertResponse.json();

    // 6. 创建钱包交易记录
    await fetch(
      `${supabaseUrl}/rest/v1/wallet_transactions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wallet_id: wallet.id,
          type: 'WITHDRAWAL',
          amount: -withdrawAmount,
          balance_after: newBalance,
          description: `提现申请 - 订单号: ${orderNumber}`,
          related_id: data[0]?.id || null
        })
      }
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '提现申请已提交，余额已冻结', 
        data: data[0],
        wallet: {
          balance: newBalance,
          frozen_balance: newFrozenBalance
        }
      }),
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
