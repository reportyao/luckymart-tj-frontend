import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // 1. 获取佣金配置
    const { data: config } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', 'referral_commission_rates')
      .single()
    
    // 默认值：一级 3%，二级 1%，三级 0.5%
    const rates = config?.value || { level1: 0.03, level2: 0.01, level3: 0.005 }

    // 2. 获取购买用户的推荐关系
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('invited_by')
      .eq('id', user_id)
      .single()

    if (profileError) throw profileError

    if (!userProfile?.invited_by) {
      return new Response(JSON.stringify({ message: 'No referrer' }), { status: 200 })
    }

    // 3. 计算三级返佣
    const commissions = []
    let currentUserId = userProfile.invited_by
    let level = 1

    while (currentUserId && level <= 3) {
      const rateKey = `level${level}` as keyof typeof rates
      const rate = rates[rateKey]
      
      if (!rate) {
        // 如果配置中没有该级别，则停止
        break
      }

      const commissionAmount = (order_amount * rate).toFixed(2)
      const commissionFloat = parseFloat(commissionAmount)

      // 插入佣金记录
      const { data: commission, error: commissionError } = await supabaseClient
        .from('commissions')
        .insert({
          user_id: currentUserId,
          from_user_id: user_id,
          level: level,
          commission_rate: rate,
          order_amount: order_amount,
          commission_amount: commissionFloat,
          order_id: order_id,
          is_withdrawable: false, // 不可提现
          status: 'settled'
        })
        .select()
        .single()

      if (commissionError) throw commissionError
      commissions.push(commission)

      // 更新上级用户的夺宝币余额（不可提现部分）
      const { error: rpcError } = await supabaseClient.rpc('add_bonus_balance', {
        p_user_id: currentUserId,
        p_amount: commissionFloat
      })

      if (rpcError) throw rpcError

      // 查找下一级
      const { data: nextUser, error: nextUserError } = await supabaseClient
        .from('profiles')
        .select('invited_by')
        .eq('id', currentUserId)
        .single()

      if (nextUserError) throw nextUserError

      currentUserId = nextUser?.invited_by
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
