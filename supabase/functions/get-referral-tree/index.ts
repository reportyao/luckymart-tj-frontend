import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReferralNode {
  id: string
  telegram_username: string
  first_name: string
  last_name: string
  telegram_id: string
  invite_code: string
  referred_by_id: string | null
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
        .eq('referred_by_id', userId)

      // 如果还没到3层，继续递归
      const childNodes: ReferralNode[] = []
      if (currentLevel < 2 && children && children.length > 0) {
        for (const child of children) {
          const childNode = await buildReferralTree(child.id, currentLevel + 1)
          childNodes.push(childNode)
        }
      }

      // 修复: 基于递归结果统计人脉数量
      const stats = {
        level1_count: childNodes.length, // 一级人脉数量
        level2_count: 0,
        level3_count: 0,
        total_commission: 0
      }

      // 统计二级和三级人脉
      childNodes.forEach(child => {
        stats.level2_count += child.children.length; // 二级人脉
        
        child.children.forEach(grandchild => {
          stats.level3_count += grandchild.children.length; // 三级人脉
        });
      });

      // 获取返利统计（佣金总额）
      const { data: commissions } = await supabaseClient
        .from('commissions')
        .select('amount')
        .eq('referred_by_id', userId)

      if (commissions) {
        stats.total_commission = commissions.reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0)
      }

      return {
        id: currentUser.id,
        telegram_username: currentUser.telegram_username,
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
        telegram_id: currentUser.telegram_id,
        invite_code: currentUser.invite_code,
        referred_by_id: currentUser.referred_by_id,
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
