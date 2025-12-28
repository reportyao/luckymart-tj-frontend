import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendTelegramMessage } from '../_shared/sendTelegramMessage.ts'

serve(async (req) => {
  // 允许 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { user_id } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 获取用户资料（使用 users 表替代已删除的 profiles 表）
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('first_deposit_bonus_status, first_deposit_bonus_amount, first_deposit_bonus_expire_at, activation_share_count, activation_invite_count')
      .eq('id', user_id)
      .single()

    if (userError) throw userError

    // 2. 检查状态和是否过期
    if (userData.first_deposit_bonus_status !== 'pending') {
      return new Response(
        JSON.stringify({ success: true, message: 'Bonus is not pending or already activated' }),
        { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
      )
    }

    if (new Date(userData.first_deposit_bonus_expire_at) < new Date()) {
      // 标记为过期
      await supabaseClient
        .from('users')
        .update({ first_deposit_bonus_status: 'expired' })
        .eq('id', user_id)
      
      return new Response(
        JSON.stringify({ success: false, error: 'Bonus has expired' }),
        { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
      )
    }

    // 3. 获取激活配置
    const { data: config, error: configError } = await supabaseClient
      .from('system_configs')
      .select('value')
      .eq('key', 'first_deposit_bonus')
      .single()

    if (configError) throw configError

    const bonusConfig = config?.value || {
      activation_methods: ['share_2_groups', 'invite_1_user']
    }

    // 4. 检查激活条件
    let isActivated = false
    
    // 检查分享条件 (分享2群)
    if (bonusConfig.activation_methods.includes('share_2_groups')) {
      if (userData.activation_share_count >= 2) {
        isActivated = true
      }
    }

    // 检查邀请条件 (邀请1人)
    if (bonusConfig.activation_methods.includes('invite_1_user')) {
      if (userData.activation_invite_count >= 1) {
        isActivated = true
      }
    }

    if (!isActivated) {
      return new Response(
        JSON.stringify({ success: false, error: 'Activation conditions not met' }),
        { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
      )
    }

    // 5. 激活奖励：更新状态并增加积分商城币余额
    const bonusAmount = userData.first_deposit_bonus_amount

    const { error: rpcError } = await supabaseClient.rpc('add_bonus_balance', {
      p_user_id: user_id,
      p_amount: bonusAmount
    })

    if (rpcError) throw rpcError

    // 6. 推送 Telegram 消息
    await sendTelegramMessage(user_id, 'first_deposit_bonus', {
      amount: bonusAmount
    })
	
    await supabaseClient
      .from('users')
      .update({
        first_deposit_bonus_status: 'activated',
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bonus activated and added to bonus balance',
        bonus_amount: bonusAmount
      }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
    )

  } catch (error) {
    console.error('activate_first_deposit_bonus error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
    )
  }
})
