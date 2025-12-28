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

  // 查询 user_sessions 表验证 session
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

  return {
    userId: session.user_id,
    session: session
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json()
    const { resale_item_id, session_token } = body

    console.log('[PurchaseResale] Request:', { resale_item_id, session_token: session_token ? 'present' : 'missing' })

    if (!resale_item_id) {
      throw new Error('缺少转售商品ID')
    }

    // 验证用户 session
    let userId: string
    
    if (session_token) {
      // 使用自定义 session token 验证
      const { userId: validatedUserId } = await validateSession(session_token)
      userId = validatedUserId
    } else {
      // 尝试使用 Authorization header (兼容旧方式)
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('未授权：缺少认证信息')
      }

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      
      if (authError || !user) {
        throw new Error('未授权：认证失败')
      }
      
      // 通过 telegram_id 找到用户
      const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('id')
        .eq('telegram_id', user.id)
        .single()
      
      if (userError || !userData) {
        throw new Error('用户不存在')
      }
      
      userId = userData.id
    }

    console.log('[PurchaseResale] Validated user:', userId)

    // 查询转售商品信息 (使用 resales 表)
    const { data: resaleItem, error: resaleError } = await supabaseClient
      .from('resales')
      .select('*, lotteries(*)')
      .eq('id', resale_item_id)
      .single()

    if (resaleError || !resaleItem) {
      console.error('[PurchaseResale] Resale item not found:', resaleError)
      throw new Error('转售商品不存在')
    }

    console.log('[PurchaseResale] Resale item:', { 
      id: resaleItem.id, 
      status: resaleItem.status, 
      price: resaleItem.resale_price,
      seller_id: resaleItem.seller_id
    })

    // 检查状态
    if (resaleItem.status !== 'ACTIVE') {
      throw new Error('该商品已下架或已售出')
    }

    // 不能购买自己的商品
    if (resaleItem.seller_id === userId) {
      throw new Error('不能购买自己的商品')
    }

    // 查询买家钱包余额 (使用 wallets 表)
    const { data: buyerWallet, error: walletError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'LUCKY_COIN')
      .eq('currency', 'TJS')
      .single()

    if (walletError || !buyerWallet) {
      console.error('[PurchaseResale] Buyer wallet not found:', walletError)
      throw new Error('买家钱包不存在')
    }

    console.log('[PurchaseResale] Buyer wallet balance:', buyerWallet.balance)

    // 检查余额
    if (buyerWallet.balance < resaleItem.resale_price) {
      throw new Error('积分余额不足')
    }

    const buyerBalanceBefore = buyerWallet.balance
    const buyerBalanceAfter = buyerWallet.balance - resaleItem.resale_price

    // 查询卖家钱包
    const { data: sellerWallet, error: sellerWalletError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', resaleItem.seller_id)
      .eq('type', 'BALANCE')
      .eq('currency', 'TJS')
      .single()

    if (sellerWalletError || !sellerWallet) {
      console.error('[PurchaseResale] Seller wallet not found:', sellerWalletError)
      throw new Error('卖家钱包不存在')
    }

    // 计算卖家收入 (扣除5%手续费)
    const sellerAmount = resaleItem.resale_price * 0.95
    const fee = resaleItem.resale_price * 0.05
    const sellerBalanceBefore = sellerWallet.balance
    const sellerBalanceAfter = sellerWallet.balance + sellerAmount

    // 开始事务处理
    // 1. 扣除买家积分余额
    const { error: deductError } = await supabaseClient
      .from('wallets')
      .update({ 
        balance: buyerBalanceAfter,
        updated_at: new Date().toISOString()
      })
      .eq('id', buyerWallet.id)

    if (deductError) {
      console.error('[PurchaseResale] Deduct buyer balance error:', deductError)
      throw new Error('扣除余额失败: ' + deductError.message)
    }

    // 2. 增加卖家余额钱包
    const { error: addError } = await supabaseClient
      .from('wallets')
      .update({ 
        balance: sellerBalanceAfter,
        updated_at: new Date().toISOString()
      })
      .eq('id', sellerWallet.id)

    if (addError) {
      console.error('[PurchaseResale] Add seller balance error:', addError)
      // 回滚买家余额
      await supabaseClient
        .from('wallets')
        .update({ balance: buyerBalanceBefore })
        .eq('id', buyerWallet.id)
      throw new Error('增加卖家余额失败: ' + addError.message)
    }

    // 3. 更新转售商品状态
    const { error: updateResaleError } = await supabaseClient
      .from('resales')
      .update({
        status: 'SOLD',
        buyer_id: userId,
        sold_at: new Date().toISOString(),
      })
      .eq('id', resale_item_id)

    if (updateResaleError) {
      console.error('[PurchaseResale] Update resale status error:', updateResaleError)
      // 尝试回滚
      await supabaseClient.from('wallets').update({ balance: buyerBalanceBefore }).eq('id', buyerWallet.id)
      await supabaseClient.from('wallets').update({ balance: sellerBalanceBefore }).eq('id', sellerWallet.id)
      throw new Error('更新转售商品状态失败: ' + updateResaleError.message)
    }

    // 4. 转移参与记录所有权（使用 lottery_entries 表）
    if (resaleItem.ticket_id) {
      const { error: updateEntryError } = await supabaseClient
        .from('lottery_entries')
        .update({
          user_id: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resaleItem.ticket_id)

      if (updateEntryError) {
        console.error('[PurchaseResale] Update entry owner error:', updateEntryError)
        // 不回滚，参与记录转移失败不影响交易
      }
    }

    // 5. 记录钱包交易 (买家)
    await supabaseClient
      .from('wallet_transactions')
      .insert({
        wallet_id: buyerWallet.id,
        type: 'RESALE_PURCHASE',
        amount: -resaleItem.resale_price,
        balance_after: buyerBalanceAfter,
        description: `购买转售: ${resaleItem.lotteries?.title || '商品'}`,
      })

    // 6. 记录钱包交易 (卖家)
    await supabaseClient
      .from('wallet_transactions')
      .insert({
        wallet_id: sellerWallet.id,
        type: 'RESALE_INCOME',
        amount: sellerAmount,
        balance_after: sellerBalanceAfter,
        description: `转售收入 (扣除${fee.toFixed(2)}TJS手续费)`,
      })

    // 交易记录已通过 wallet_transactions 表记录，不再使用已删除的 transactions 表

    console.log('[PurchaseResale] Success!')

    return new Response(
      JSON.stringify({
        success: true,
        message: '购买成功',
        data: {
          resale_id: resale_item_id,
          price: resaleItem.resale_price,
          new_balance: buyerBalanceAfter
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[PurchaseResale] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
