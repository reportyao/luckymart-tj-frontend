import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendTelegramMessage } from '../_shared/sendTelegramMessage.ts'

serve(async (req) => {
  // 允许 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { order_id, user_id, order_amount } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 获取佣金配置（使用 commission_settings 表）
    const { data: settings, error: settingsError } = await supabaseClient
      .from('commission_settings')
      .select('level, rate, is_active, trigger_condition, min_payout_amount')
      .eq('is_active', true)
      .order('level', { ascending: true })
    
    if (settingsError) {
      console.error('Failed to fetch commission settings:', settingsError)
      throw settingsError
    }

    if (!settings || settings.length === 0) {
      console.log('No active commission settings found')
      return new Response(JSON.stringify({ message: 'No active commission settings' }), { status: 200 })
    }

    // 2. 获取购买用户的推荐关系
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('referred_by_id')
      .eq('id', user_id)
      .single()

    if (userError) throw userError

    if (!userData?.referred_by_id) {
      return new Response(JSON.stringify({ message: 'No referrer' }), { status: 200 })
    }

    // 3. 计算三级返佣
    const commissions = []
    let currentUserId = userData.referred_by_id
    let level = 1

    // 遍历每一级
    for (const setting of settings) {
      if (!currentUserId || level > 3) break
      
      // 检查是否有对应级别的配置
      if (setting.level !== level) continue

      const rate = parseFloat(setting.rate)
      const minPayoutAmount = parseFloat(setting.min_payout_amount || '0')
      const commissionAmount = order_amount * rate
      
      // 检查是否达到最低发放金额
      if (commissionAmount < minPayoutAmount) {
        console.log(`Commission ${commissionAmount} below minimum ${minPayoutAmount} for level ${level}`)
        // 继续查找下一级
        const { data: nextUser } = await supabaseClient
          .from('users')
          .select('referred_by_id')
          .eq('id', currentUserId)
          .single()
        
        currentUserId = nextUser?.referred_by_id
        level++
        continue
      }

      // 插入佣金记录
      const { data: commission, error: commissionError } = await supabaseClient
        .from('commissions')
        .insert({
          user_id: currentUserId,
          from_user_id: user_id,
          level: level,
          commission_rate: rate,
          order_amount: order_amount,
          commission_amount: commissionAmount,
          order_id: order_id,
          is_withdrawable: false, // 不可提现
          status: 'settled'
        })
        .select()
        .single()

      if (commissionError) {
        console.error('Failed to insert commission:', commissionError)
        throw commissionError
      }
      
      commissions.push(commission)

      // 更新上级用户的夺宝币余额（不可提现部分）
      const { error: rpcError } = await supabaseClient.rpc('add_bonus_balance', {
        p_user_id: currentUserId,
        p_amount: commissionAmount
      })

      if (rpcError) {
        console.error('Failed to add bonus balance:', rpcError)
        throw rpcError
      }

      // 4. 推送 Telegram 消息
      try {
        await sendTelegramMessage(currentUserId, 'commission_earned', {
          amount: commissionAmount,
          level: level
        })
      } catch (msgError) {
        console.error('Failed to send telegram message:', msgError)
        // 不阻断流程
      }

      // 查找下一级
      const { data: nextUser, error: nextUserError } = await supabaseClient
        .from('users')
        .select('referred_by_id')
        .eq('id', currentUserId)
        .single()

      if (nextUserError) {
        console.error('Failed to fetch next user:', nextUserError)
        break
      }

      currentUserId = nextUser?.referred_by_id
      level++
    }

    return new Response(
      JSON.stringify({ success: true, commissions }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
    )

  } catch (error) {
    console.error('handle_purchase_commission error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
    )
  }
})
