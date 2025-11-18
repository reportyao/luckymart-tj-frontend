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

    // 2. 获取一级好友 (invited_by = userId)
    const { data: level1Users, error: level1Error } = await supabaseClient
      .from('profiles')
      .select(`
        id,
        username,
        avatar_url,
        created_at,
        level,
        total_spent:orders(amount),
        commissions!from_user_id(commission_amount)
      `)
      .eq('invited_by', userId)

    if (level1Error) throw level1Error

    // 3. 获取二级好友 (invited_by = level1Users.id)
    const level1Ids = level1Users.map(u => u.id)
    let level2Users: any[] = []
    if (level1Ids.length > 0) {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
          id,
          username,
          avatar_url,
          created_at,
          level,
          invited_by,
          total_spent:orders(amount),
          commissions!from_user_id(commission_amount)
        `)
        .in('invited_by', level1Ids)
      
      if (error) throw error
      level2Users = data
    }

    // 4. 获取三级好友 (invited_by = level2Users.id)
    const level2Ids = level2Users.map(u => u.id)
    let level3Users: any[] = []
    if (level2Ids.length > 0) {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
          id,
          username,
          avatar_url,
          created_at,
          level,
          invited_by,
          total_spent:orders(amount),
          commissions!from_user_id(commission_amount)
        `)
        .in('invited_by', level2Ids)
      
      if (error) throw error
      level3Users = data
    }

    // 5. 整合数据并计算统计
    const allInvitedUsers = [...level1Users, ...level2Users, ...level3Users]
      .map(u => {
        // 简化计算逻辑，实际应更复杂
        const totalSpent = u.total_spent.reduce((sum: number, order: { amount: number }) => sum + order.amount, 0)
        const commissionEarned = u.commissions.reduce((sum: number, commission: { commission_amount: number }) => sum + commission.commission_amount, 0)
        
        // 确定层级
        let userLevel = 0
        if (level1Users.some(l1 => l1.id === u.id)) userLevel = 1
        else if (level2Users.some(l2 => l2.id === u.id)) userLevel = 2
        else if (level3Users.some(l3 => l3.id === u.id)) userLevel = 3

        return {
          id: u.id,
          username: u.username,
          avatar_url: u.avatar_url,
          created_at: u.created_at,
          level: userLevel,
          commission_earned: commissionEarned,
          total_spent: totalSpent,
        }
      })

    return new Response(
      JSON.stringify({ success: true, data: allInvitedUsers }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
    )

  } catch (error) {
    console.error('get_invited_users error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
    )
  }
})
