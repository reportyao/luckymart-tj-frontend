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
    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 获取邀请的用户列表
    const { data: referralsData, error: referralsError } = await supabase
      .from('users')
      .select('id, first_name, telegram_username, telegram_photo_url, created_at')
      .eq('referred_by_id', user_id)

    if (referralsError) {
      throw referralsError
    }

    // 获取佣金数据
    const { data: commissionsData } = await supabase
      .from('commissions')
      .select('amount')
      .eq('user_id', user_id)

    const totalInvited = referralsData?.length || 0
    const totalEarnings = commissionsData?.reduce((sum, c) => sum + Number(c.amount), 0) || 0

    const stats = {
      total_invites: totalInvited,
      total_referrals: totalInvited,
      level1_referrals: totalInvited,
      level2_referrals: 0,
      level3_referrals: 0,
      total_commission: totalEarnings,
      pending_commission: 0,
      paid_commission: totalEarnings,
      bonus_balance: 0,
    }

    const invited_users = referralsData?.map(u => ({
      id: u.id,
      telegram_username: u.telegram_username,
      avatar_url: u.telegram_photo_url || null,
      created_at: u.created_at,
      level: 1,
      total_spent: 0,
      commission_earned: 0,
    })) || []

    return new Response(
      JSON.stringify({ success: true, stats, invited_users }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
