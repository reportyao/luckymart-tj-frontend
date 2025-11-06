import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReferralRewardRequest {
  user_id: string
  transaction_type: 'LOTTERY_PURCHASE' | 'COIN_EXCHANGE' | 'DEPOSIT'
  amount: number
  currency: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, transaction_type, amount, currency }: ReferralRewardRequest = await req.json()

    // 获取用户信息
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('invited_by')
      .eq('id', user_id)
      .single()

    if (userError || !user || !user.invited_by) {
      return new Response(
        JSON.stringify({ success: true, message: 'No referrer found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 计算佣金比例
    const commissionRates = {
      1: 0.10, // 一级 10%
      2: 0.05, // 二级 5%
      3: 0.02  // 三级 2%
    }

    const rewards: Array<{
      referrer_id: string
      level: number
      amount: number
    }> = []

    // 递归查找上级推荐人(最多3级)
    let currentReferrerId = user.invited_by
    let level = 1

    while (currentReferrerId && level <= 3) {
      const commissionAmount = amount * commissionRates[level as keyof typeof commissionRates]
      
      rewards.push({
        referrer_id: currentReferrerId,
        level,
        amount: commissionAmount
      })

      // 查找下一级推荐人
      const { data: referrer } = await supabaseClient
        .from('users')
        .select('invited_by')
        .eq('id', currentReferrerId)
        .single()

      currentReferrerId = referrer?.invited_by
      level++
    }

    // 发放奖励
    const results = []
    for (const reward of rewards) {
      // 1. 创建Commission记录
      const { data: commission, error: commissionError } = await supabaseClient
        .from('commissions')
        .insert({
          referrer_id: reward.referrer_id,
          referee_id: user_id,
          level: reward.level,
          amount: reward.amount,
          currency: currency,
          transaction_type: transaction_type,
          status: 'COMPLETED'
        })
        .select()
        .single()

      if (commissionError) {
        console.error('Failed to create commission:', commissionError)
        continue
      }

      // 2. 更新推荐人钱包余额
      const { data: wallet, error: walletError } = await supabaseClient
        .from('wallets')
        .select('balance')
        .eq('user_id', reward.referrer_id)
        .eq('currency', currency)
        .single()

      if (wallet && !walletError) {
        const { error: updateError } = await supabaseClient
          .from('wallets')
          .update({
            balance: wallet.balance + reward.amount,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', reward.referrer_id)
          .eq('currency', currency)

        if (updateError) {
          console.error('Failed to update wallet:', updateError)
          continue
        }

        // 3. 创建钱包交易记录
        await supabaseClient
          .from('wallet_transactions')
          .insert({
            user_id: reward.referrer_id,
            wallet_id: wallet.id,
            type: 'REFERRAL_REWARD',
            amount: reward.amount,
            currency: currency,
            status: 'COMPLETED',
            description: `L${reward.level}邀请奖励`,
            metadata: {
              referee_id: user_id,
              level: reward.level,
              transaction_type: transaction_type
            }
          })

        // 4. 发送通知
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: reward.referrer_id,
            type: 'REFERRAL_REWARD',
            title: '邀请奖励到账',
            content: `您的${reward.level}级好友消费,您获得了 ${reward.amount.toFixed(2)} ${currency} 奖励`,
            is_read: false
          })

        results.push({
          referrer_id: reward.referrer_id,
          level: reward.level,
          amount: reward.amount,
          status: 'success'
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rewards: results,
        message: `Successfully distributed ${results.length} rewards`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in referral-reward function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
