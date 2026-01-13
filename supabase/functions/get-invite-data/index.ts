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

    console.log('[GetInviteData] Fetching invite data for user:', user_id)

    // 1. 获取一级邀请用户（直接邀请）
    const { data: level1Users, error: level1Error } = await supabase
      .from('users')
      .select('id, first_name, telegram_username, avatar_url, created_at')
      .eq('referred_by_id', user_id)

    if (level1Error) {
      console.error('[GetInviteData] Level 1 query error:', level1Error)
      throw level1Error
    }

    console.log('[GetInviteData] Level 1 users:', level1Users?.length || 0)

    const level1Count = level1Users?.length || 0
    const allInvitedUsers: any[] = []

    // 添加一级用户到结果
    if (level1Users && level1Users.length > 0) {
      level1Users.forEach(u => {
        allInvitedUsers.push({
          id: u.id,
          telegram_username: u.telegram_username,
          first_name: u.first_name,
          avatar_url: u.avatar_url || null,
          created_at: u.created_at,
          level: 1,
          total_spent: 0,
          commission_earned: 0,
        })
      })

      // 2. 获取二级邀请用户（一级用户邀请的用户）
      const level1Ids = level1Users.map(u => u.id)
      
      const { data: level2Users, error: level2Error } = await supabase
        .from('users')
        .select('id, first_name, telegram_username, avatar_url, created_at')
        .in('referred_by_id', level1Ids)

      if (level2Error) {
        console.error('[GetInviteData] Level 2 query error:', level2Error)
      } else {
        console.log('[GetInviteData] Level 2 users:', level2Users?.length || 0)
        
        // 添加二级用户到结果
        if (level2Users && level2Users.length > 0) {
          level2Users.forEach(u => {
            allInvitedUsers.push({
              id: u.id,
              telegram_username: u.telegram_username,
              first_name: u.first_name,
              avatar_url: u.avatar_url || null,
              created_at: u.created_at,
              level: 2,
              total_spent: 0,
              commission_earned: 0,
            })
          })

          // 3. 获取三级邀请用户（二级用户邀请的用户）
          const level2Ids = level2Users.map(u => u.id)
          
          const { data: level3Users, error: level3Error } = await supabase
            .from('users')
            .select('id, first_name, telegram_username, avatar_url, created_at')
            .in('referred_by_id', level2Ids)

          if (level3Error) {
            console.error('[GetInviteData] Level 3 query error:', level3Error)
          } else {
            console.log('[GetInviteData] Level 3 users:', level3Users?.length || 0)
            
            // 添加三级用户到结果
            if (level3Users && level3Users.length > 0) {
              level3Users.forEach(u => {
                allInvitedUsers.push({
                  id: u.id,
                  telegram_username: u.telegram_username,
                  first_name: u.first_name,
                  avatar_url: u.avatar_url || null,
                  created_at: u.created_at,
                  level: 3,
                  total_spent: 0,
                  commission_earned: 0,
                })
              })
            }
          }
        }
      }
    }

    // 统计各级用户数量
    const level2Count = allInvitedUsers.filter(u => u.level === 2).length
    const level3Count = allInvitedUsers.filter(u => u.level === 3).length
    const totalReferrals = level1Count + level2Count + level3Count

    console.log('[GetInviteData] Total referrals:', {
      level1: level1Count,
      level2: level2Count,
      level3: level3Count,
      total: totalReferrals
    })

    // 获取佣金数据
    const { data: commissionsData } = await supabase
      .from('commissions')
      .select('amount, status')
      .eq('user_id', user_id)

    const totalCommission = commissionsData?.reduce((sum, c) => sum + Number(c.amount), 0) || 0
    const paidCommission = commissionsData?.filter(c => c.status === 'PAID').reduce((sum, c) => sum + Number(c.amount), 0) || 0
    const pendingCommission = commissionsData?.filter(c => c.status === 'PENDING').reduce((sum, c) => sum + Number(c.amount), 0) || 0

    /**
     * 获取用户现金余额（佣金奖励统一发放到现金钱包）
     * 
     * 钱包类型说明（重要）：
     * - 现金钱包: type='TJS', currency='TJS'
     * - 积分钱包: type='LUCKY_COIN', currency='POINTS'
     * 
     * 注意：数据库枚举 WalletType 只有 'TJS' 和 'LUCKY_COIN'，没有 'BONUS'
     * 佣金奖励统一发放到现金钱包(TJS)，不是单独的奖金钱包
     */
    const { data: walletData } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user_id)
      .eq('type', 'TJS')           // 修复：现金钱包类型，不是'BONUS'
      .eq('currency', 'TJS')
      .single()

    // 佣金余额就是现金钱包余额
    const bonusBalance = walletData?.balance || 0

    const stats = {
      total_invites: level1Count, // 直接邀请数
      total_referrals: totalReferrals, // 总推荐数（3级）
      level1_referrals: level1Count,
      level2_referrals: level2Count,
      level3_referrals: level3Count,
      total_commission: totalCommission,
      pending_commission: pendingCommission,
      paid_commission: paidCommission,
      bonus_balance: bonusBalance,
    }

    console.log('[GetInviteData] Stats:', stats)

    return new Response(
      JSON.stringify({ 
        success: true, 
        stats, 
        invited_users: allInvitedUsers 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[GetInviteData] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
