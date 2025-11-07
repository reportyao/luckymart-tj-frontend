import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // 获取当前用户
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('未授权')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('未授权')
    }

    // TODO: 验证用户是否为管理员

    const { requestId, action, adminNote, transferProofImages, transferReference } = await req.json()

    // 验证参数
    if (!requestId) {
      throw new Error('请求ID不能为空')
    }

    if (!action || !['APPROVED', 'REJECTED', 'COMPLETED'].includes(action)) {
      throw new Error('无效的审核操作')
    }

    // 获取提现申请
    const { data: withdrawalRequest, error: requestError } = await supabaseClient
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (requestError || !withdrawalRequest) {
      throw new Error('未找到提现申请')
    }

    // 检查申请状态
    if (action === 'APPROVED' && withdrawalRequest.status !== 'PENDING') {
      throw new Error('该申请已被处理')
    }

    if (action === 'COMPLETED' && withdrawalRequest.status !== 'APPROVED') {
      throw new Error('该申请尚未审核通过')
    }

    // 获取用户余额钱包
    const { data: wallet, error: walletError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', withdrawalRequest.user_id)
      .eq('type', 'BALANCE')
      .eq('currency', withdrawalRequest.currency)
      .single()

    if (walletError || !wallet) {
      throw new Error('未找到用户钱包')
    }

    if (action === 'APPROVED') {
      // 审核通过
      const { error: updateError } = await supabaseClient
        .from('withdrawal_requests')
        .update({
          status: 'APPROVED',
          admin_id: user.id,
          admin_note: adminNote || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updateError) {
        console.error('更新申请状态失败:', updateError)
        throw new Error('审核失败')
      }

      // 发送通知给用户
      await supabaseClient.from('notifications').insert({
        user_id: withdrawalRequest.user_id,
        type: 'PAYMENT_SUCCESS',
        title: '提现审核通过',
        content: `您的提现申请已审核通过,金额${withdrawalRequest.amount} ${withdrawalRequest.currency},正在处理中`,
        related_id: requestId,
        related_type: 'WITHDRAWAL_REQUEST',
      })
    } else if (action === 'REJECTED') {
      // 审核拒绝,解冻余额
      const { error: unfreezeError } = await supabaseClient
        .from('wallets')
        .update({
          balance: wallet.balance + withdrawalRequest.amount,
          frozen_balance: wallet.frozen_balance - withdrawalRequest.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)

      if (unfreezeError) {
        console.error('解冻余额失败:', unfreezeError)
        throw new Error('解冻余额失败')
      }

      const { error: updateError } = await supabaseClient
        .from('withdrawal_requests')
        .update({
          status: 'REJECTED',
          admin_id: user.id,
          admin_note: adminNote || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updateError) {
        console.error('更新申请状态失败:', updateError)
        throw new Error('审核失败')
      }

      // 发送通知给用户
      await supabaseClient.from('notifications').insert({
        user_id: withdrawalRequest.user_id,
        type: 'PAYMENT_FAILED',
        title: '提现失败',
        content: `您的提现申请已被拒绝${adminNote ? `,原因: ${adminNote}` : ''},金额已退回账户`,
        related_id: requestId,
        related_type: 'WITHDRAWAL_REQUEST',
      })
    } else if (action === 'COMPLETED') {
      // 转账完成,扣除冻结余额
      const { error: deductError } = await supabaseClient
        .from('wallets')
        .update({
          frozen_balance: wallet.frozen_balance - withdrawalRequest.amount,
          total_withdrawals: wallet.total_withdrawals + withdrawalRequest.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)

      if (deductError) {
        console.error('扣除冻结余额失败:', deductError)
        throw new Error('扣除余额失败')
      }

      const { error: updateError } = await supabaseClient
        .from('withdrawal_requests')
        .update({
          status: 'COMPLETED',
          transfer_proof_images: transferProofImages || null,
          transfer_reference: transferReference || null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updateError) {
        console.error('更新申请状态失败:', updateError)
        throw new Error('更新失败')
      }

      // 创建钱包交易记录
      await supabaseClient.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'WITHDRAWAL_APPROVED',
        amount: -withdrawalRequest.amount,
        balance_after: wallet.balance,
        description: `提现完成 - 订单号: ${withdrawalRequest.order_number}`,
        related_id: requestId,
      })

      // 发送通知给用户
      await supabaseClient.from('notifications').insert({
        user_id: withdrawalRequest.user_id,
        type: 'PAYMENT_SUCCESS',
        title: '提现成功',
        content: `您的提现已完成,金额${withdrawalRequest.amount} ${withdrawalRequest.currency}已转账`,
        related_id: requestId,
        related_type: 'WITHDRAWAL_REQUEST',
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: action === 'APPROVED' ? '审核通过' : action === 'REJECTED' ? '已拒绝' : '转账完成',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('审核提现申请错误:', error)
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
