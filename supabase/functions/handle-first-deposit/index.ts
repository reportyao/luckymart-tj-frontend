import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 允许 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { user_id, deposit_amount } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 检查是否首次充值（使用 users 表替代已删除的 profiles 表）
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('first_deposit_bonus_status')
      .eq('id', user_id)
      .single()

    if (userError) throw userError

    if (userData.first_deposit_bonus_status !== 'none') {
      return new Response(
        JSON.stringify({ success: true, message: 'Already received first deposit bonus' }),
        { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
      )
    }

    // 2. 获取首充配置（使用 system_configs 表）
    const { data: config, error: configError } = await supabaseClient
      .from('system_configs')
      .select('value')
      .eq('key', 'first_deposit_bonus')
      .single()

    if (configError) throw configError

    const bonusConfig = config?.value || {
      min_amount: 10,
      bonus_amount: 2.5,
      expire_days: 7
    }

    // 3. 检查充值金额是否达标
    if (deposit_amount < bonusConfig.min_amount) {
      return new Response(
        JSON.stringify({ success: true, message: 'Deposit amount below minimum' }),
        { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
      )
    }

    // 4. 发放待激活奖励（使用 users 表）
    const expireAt = new Date()
    expireAt.setDate(expireAt.getDate() + bonusConfig.expire_days)

    const { error: updateError } = await supabaseClient
      .from('users')
      .update({
        first_deposit_bonus_amount: bonusConfig.bonus_amount,
        first_deposit_bonus_status: 'pending',
        first_deposit_bonus_expire_at: expireAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ 
        success: true, 
        bonus_amount: bonusConfig.bonus_amount,
        expire_at: expireAt.toISOString(),
        status: 'pending'
      }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
    )

  } catch (error) {
    console.error('handle_first_deposit error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
    )
  }
})
