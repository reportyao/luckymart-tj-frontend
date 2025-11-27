import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 允许 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 获取用户 ID
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Invalid token')
    }
    const userId = user.id

    // 2. 获取统计数据
    const { data: stats, error: statsError } = await supabaseClient.rpc('get_user_referral_stats', {
      p_user_id: userId
    })

    if (statsError) throw statsError

    // 3. 获取用户信息
    const { data: userInfo, error: userError } = await supabaseClient
      .from('users')
      .select('id, telegram_username')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    const result = {
      ...(stats && stats[0] ? stats[0] : {}),
      total_invites: stats?.[0]?.total_invites || 0,
      total_commission: stats?.[0]?.total_commission || 0,
      first_deposit_bonus_status: 'INACTIVE',
      first_deposit_bonus_amount: 0,
      first_deposit_bonus_expire_at: null,
      activation_share_count: 0,
      activation_invite_count: 0,
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
    )

  } catch (error) {
    console.error('get_user_referral_stats error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
    )
  }
})
