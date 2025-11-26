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

    const { showoffId, action, rewardCoins, adminNote } = await req.json()

    // 验证参数
    if (!showoffId) {
      throw new Error('晒单ID不能为空')
    }

    if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
      throw new Error('无效的审核操作')
    }

    // 获取晒单记录
    const { data: showoff, error: showoffError } = await supabaseClient
      .from('showoffs')
      .select('*')
      .eq('id', showoffId)
      .single()

    if (showoffError || !showoff) {
      throw new Error('未找到晒单记录')
    }

    // 检查晒单状态
    if (showoff.status !== 'PENDING') {
      throw new Error('该晒单已被处理')
    }

    // 更新晒单状态
    const updateData: any = {
      status: action,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      admin_note: adminNote || null,
    }

    // 只有批准时才设置奖励
    if (action === 'APPROVED') {
      updateData.reward_coins = rewardCoins || 0
    }

    const { error: updateError } = await supabaseClient
      .from('showoffs')
      .update(updateData)
      .eq('id', showoffId)

    if (updateError) {
      console.error('更新晒单状态失败:', updateError)
      throw new Error('审核失败')
    }

    // 如果批准且有奖励，给用户增加幸运币
    if (action === 'APPROVED' && rewardCoins && rewardCoins > 0) {
      // 查询用户的幸运币钱包
      const { data: wallet, error: walletError } = await supabaseClient
        .from('wallets')
        .select('*')
        .eq('user_id', showoff.user_id)
        .eq('type', 'LUCKY_COIN')
        .single()

      if (walletError || !wallet) {
        console.error('查询幸运币钱包失败:', walletError)
        throw new Error('未找到用户幸运币钱包')
      }

      // 更新钱包余额
      const newBalance = parseFloat(wallet.balance) + rewardCoins
      const { error: updateWalletError } = await supabaseClient
        .from('wallets')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)

      if (updateWalletError) {
        console.error('更新幸运币余额失败:', updateWalletError)
        throw new Error('更新幸运币余额失败')
      }

      // 创建交易记录
      await supabaseClient.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'SHOWOFF_REWARD',
        amount: rewardCoins,
        balance_after: newBalance,
        description: `晒单审核通过奖励 - ${rewardCoins} 幸运币`,
        related_id: showoffId,
      })

      // 发送通知给用户
      await supabaseClient.from('notifications').insert({
        user_id: showoff.user_id,
        type: 'SHOWOFF_APPROVED',
        title: '晒单审核通过',
        content: `您的晒单已审核通过，获得 ${rewardCoins} 幸运币奖励！`,
        related_id: showoffId,
        related_type: 'SHOWOFF',
      })
    } else if (action === 'APPROVED') {
      // 批准但没有奖励
      await supabaseClient.from('notifications').insert({
        user_id: showoff.user_id,
        type: 'SHOWOFF_APPROVED',
        title: '晒单审核通过',
        content: '您的晒单已审核通过！',
        related_id: showoffId,
        related_type: 'SHOWOFF',
      })
    } else {
      // 审核拒绝,发送通知
      await supabaseClient.from('notifications').insert({
        user_id: showoff.user_id,
        type: 'SHOWOFF_REJECTED',
        title: '晒单审核未通过',
        content: `您的晒单审核未通过${adminNote ? `，原因: ${adminNote}` : ''}`,
        related_id: showoffId,
        related_type: 'SHOWOFF',
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
    console.error('审核晒单错误:', error)
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
