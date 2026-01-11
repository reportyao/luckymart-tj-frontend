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
      .eq('type', 'TJS')
      .eq('currency', withdrawalRequest.currency)
      .single()

    if (walletError || !wallet) {
      throw new Error('未找到用户钱包')
    }

    const withdrawAmount = parseFloat(withdrawalRequest.amount)
    const currentBalance = parseFloat(wallet.balance) || 0
    const currentFrozenBalance = parseFloat(wallet.frozen_balance) || 0
    const currentTotalWithdrawals = parseFloat(wallet.total_withdrawals) || 0

    if (action === 'APPROVED') {
      // 审核通过 - 如果余额没有被冻结，现在冻结它
      let newBalance = currentBalance
      let newFrozenBalance = currentFrozenBalance

      // 检查是否需要冻结余额（兼容旧的没有冻结的提现请求）
      if (currentFrozenBalance < withdrawAmount) {
        // 需要从balance中冻结
        const needToFreeze = withdrawAmount - currentFrozenBalance
        if (currentBalance < needToFreeze) {
          throw new Error(`余额不足，当前余额: ${currentBalance}`)
        }
        newBalance = currentBalance - needToFreeze
        newFrozenBalance = withdrawAmount
        
        // 更新钱包余额
        const { error: freezeError } = await supabaseClient
          .from('wallets')
          .update({
            balance: newBalance,
            frozen_balance: newFrozenBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id)

        if (freezeError) {
          console.error('冻结余额失败:', freezeError)
          throw new Error('冻结余额失败')
        }
      }

      const { error: updateError } = await supabaseClient
        .from('withdrawal_requests')
        .update({
          status: 'APPROVED',
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

      // 发送通知给用户
      await supabaseClient.from('notifications').insert({
        user_id: withdrawalRequest.user_id,
        type: 'PAYMENT_SUCCESS',
        title: '提现审核通过',
        content: `您的提现申请已审核通过,金额${withdrawalRequest.amount} ${withdrawalRequest.currency},正在处理中`,
        related_id: requestId,
        related_type: 'WITHDRAWAL_REQUEST',
      })

      // Send Telegram notification
      try {
        await supabaseClient.functions.invoke('send-telegram-notification', {
          body: {
            user_id: withdrawalRequest.user_id,
            type: 'wallet_withdraw_pending',
            data: {
              transaction_amount: withdrawalRequest.amount,
            },
            priority: 2,
          },
        });
      } catch (error) {
        console.error('Failed to send Telegram notification:', error);
      }
    } else if (action === 'REJECTED') {
      // 审核拒绝,解冻余额
      // 只解冻实际冻结的金额
      const amountToUnfreeze = Math.min(currentFrozenBalance, withdrawAmount)
      
      const { error: unfreezeError } = await supabaseClient
        .from('wallets')
        .update({
          balance: currentBalance + amountToUnfreeze,
          frozen_balance: Math.max(0, currentFrozenBalance - withdrawAmount),
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

      // 发送通知给用户
      await supabaseClient.from('notifications').insert({
        user_id: withdrawalRequest.user_id,
        type: 'PAYMENT_FAILED',
        title: '提现失败',
        content: `您的提现申请已被拒绝${adminNote ? `,原因: ${adminNote}` : ''},金额已退回账户`,
        related_id: requestId,
        related_type: 'WITHDRAWAL_REQUEST',
      })

      // Send Telegram notification
      try {
        await supabaseClient.functions.invoke('send-telegram-notification', {
          body: {
            user_id: withdrawalRequest.user_id,
            type: 'wallet_withdraw_failed',
            data: {
              transaction_amount: withdrawalRequest.amount,
              failure_reason: adminNote || '审核未通过',
              current_balance: currentBalance + amountToUnfreeze,
            },
            priority: 2,
          },
        });
      } catch (error) {
        console.error('Failed to send Telegram notification:', error);
      }
    } else if (action === 'COMPLETED') {
      // 转账完成
      // 计算需要从frozen_balance和balance中扣除的金额
      let newFrozenBalance = currentFrozenBalance
      let newBalance = currentBalance
      
      if (currentFrozenBalance >= withdrawAmount) {
        // 冻结余额足够，只从冻结余额扣除
        newFrozenBalance = currentFrozenBalance - withdrawAmount
      } else {
        // 冻结余额不足，需要从balance中扣除差额
        const fromBalance = withdrawAmount - currentFrozenBalance
        newFrozenBalance = 0
        newBalance = currentBalance - fromBalance
        
        if (newBalance < 0) {
          throw new Error(`余额不足，无法完成提现`)
        }
      }
      
      const { error: deductError } = await supabaseClient
        .from('wallets')
        .update({
          balance: newBalance,
          frozen_balance: newFrozenBalance,
          total_withdrawals: currentTotalWithdrawals + withdrawAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)

      if (deductError) {
        console.error('扣除余额失败:', deductError)
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
        type: 'WITHDRAWAL',
        amount: -withdrawAmount,
        balance_after: newBalance,
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

      // Send Telegram notification
      try {
        await supabaseClient.functions.invoke('send-telegram-notification', {
          body: {
            user_id: withdrawalRequest.user_id,
            type: 'wallet_withdraw_completed',
            data: {
              transaction_amount: withdrawalRequest.amount,
              estimated_arrival: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Dushanbe' }),
            },
            priority: 2,
          },
        });
      } catch (error) {
        console.error('Failed to send Telegram notification:', error);
      }
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
