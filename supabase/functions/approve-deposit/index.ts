import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-id',
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

    // 获取管理员认证
    const adminId = req.headers.get('x-admin-id')
    const authHeader = req.headers.get('Authorization')
    
    let adminUserId: string | null = null
    
    // 方式1: 通过 x-admin-id 头部认证（管理后台使用）
    if (adminId) {
      // 验证管理员是否存在且有效
      const { data: adminUser, error: adminError } = await supabaseClient
        .from('admin_users')
        .select('id, status')
        .eq('id', adminId)
        .single()
      
      if (adminError || !adminUser || adminUser.status !== 'active') {
        throw new Error('管理员认证失败')
      }
      adminUserId = adminUser.id
    }
    // 方式2: 通过 Supabase Auth token 认证（兼容旧方式）
    else if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
      
      if (!userError && user) {
        adminUserId = user.id
      }
    }
    
    if (!adminUserId) {
      throw new Error('未授权')
    }

    const { requestId, action, adminNote } = await req.json()

    // 验证参数
    if (!requestId) {
      throw new Error('请求ID不能为空')
    }

    if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
      throw new Error('无效的审核操作')
    }

    // 获取充值申请
    const { data: depositRequest, error: requestError } = await supabaseClient
      .from('deposit_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (requestError || !depositRequest) {
      throw new Error('未找到充值申请')
    }

    // 检查申请状态
    if (depositRequest.status !== 'PENDING') {
      throw new Error('该申请已被处理')
    }

    // 更新申请状态
    const { error: updateError } = await supabaseClient
      .from('deposit_requests')
      .update({
        status: action,
        admin_id: adminUserId,
        admin_note: adminNote || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('更新申请状态失败:', updateError)
      throw new Error('审核失败')
    }

    // 如果审核通过,增加用户余额
    if (action === 'APPROVED') {
      // 获取用户余额钱包
      const { data: wallet, error: walletError } = await supabaseClient
        .from('wallets')
        .select('*')
        .eq('user_id', depositRequest.user_id)
        .eq('type', 'BALANCE')
        .eq('currency', depositRequest.currency)
        .single()

      if (walletError || !wallet) {
        throw new Error('未找到用户钱包')
      }

      // 更新钱包余额
      const { error: updateWalletError } = await supabaseClient
        .from('wallets')
        .update({
          balance: wallet.balance + depositRequest.amount,
          total_deposits: wallet.total_deposits + depositRequest.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)

      if (updateWalletError) {
        console.error('更新钱包余额失败:', updateWalletError)
        throw new Error('更新余额失败')
      }

      // 创建钱包交易记录
      await supabaseClient.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'DEPOSIT_APPROVED',
        amount: depositRequest.amount,
        balance_after: wallet.balance + depositRequest.amount,
        description: `充值审核通过 - 订单号: ${depositRequest.order_number}`,
        related_id: requestId,
      })

      // 发送通知给用户
      await supabaseClient.from('notifications').insert({
        user_id: depositRequest.user_id,
        type: 'PAYMENT_SUCCESS',
        title: '充值成功',
        content: `您的充值申请已审核通过,金额${depositRequest.amount} ${depositRequest.currency}已到账`,
        related_id: requestId,
        related_type: 'DEPOSIT_REQUEST',
      })
    } else {
      // 审核拒绝,发送通知
      await supabaseClient.from('notifications').insert({
        user_id: depositRequest.user_id,
        type: 'PAYMENT_FAILED',
        title: '充值失败',
        content: `您的充值申请已被拒绝${adminNote ? `,原因: ${adminNote}` : ''}`,
        related_id: requestId,
        related_type: 'DEPOSIT_REQUEST',
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: action === 'APPROVED' ? '审核通过' : '已拒绝',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('审核充值申请错误:', error)
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
