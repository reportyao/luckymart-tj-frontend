import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReferralNode {
  id: string
  username: string
  telegram_id: string
  referral_code: string
  referrer_id: string | null
  referral_level: number
  created_at: string
  children: ReferralNode[]
  stats: {
    level1_count: number
    level2_count: number
    level3_count: number
    total_commission: number
  }
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

    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 获取用户信息
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 递归获取邀请树（最多3层）
    const buildReferralTree = async (userId: string, currentLevel: number = 0): Promise<ReferralNode> => {
      const { data: currentUser } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (!currentUser) {
        throw new Error('User not found')
      }

      // 获取直接邀请的用户
      const { data: children } = await supabaseClient
        .from('users')
        .select('*')
        .eq('referrer_id', userId)

      // 获取返利统计
      const { data: commissions } = await supabaseClient
        .from('commissions')
        .select('amount, level')
        .eq('referrer_id', userId)

      const stats = {
        level1_count: 0,
        level2_count: 0,
        level3_count: 0,
        total_commission: 0
      }

      if (commissions) {
        commissions.forEach(c => {
          if (c.level === 1) stats.level1_count++
          if (c.level === 2) stats.level2_count++
          if (c.level === 3) stats.level3_count++
          stats.total_commission += parseFloat(c.amount)
        })
      }

      // 如果还没到3层，继续递归
      const childNodes: ReferralNode[] = []
      if (currentLevel < 2 && children && children.length > 0) {
        for (const child of children) {
          const childNode = await buildReferralTree(child.id, currentLevel + 1)
          childNodes.push(childNode)
        }
      }

      return {
        id: currentUser.id,
        username: currentUser.username,
        telegram_id: currentUser.telegram_id,
        referral_code: currentUser.referral_code,
        referrer_id: currentUser.referrer_id,
        referral_level: currentUser.referral_level,
        created_at: currentUser.created_at,
        children: childNodes,
        stats
      }
    }

    const tree = await buildReferralTree(user_id)

    return new Response(
      JSON.stringify(tree),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
