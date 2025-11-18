import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 允许 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { share_type, share_target, share_data } = await req.json()
    
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

    // 2. 记录分享日志
    const { error: logError } = await supabaseClient
      .from('share_logs')
      .insert({
        user_id: userId,
        share_type: share_type,
        share_target: share_target,
        share_data: share_data
      })

    if (logError) throw logError

    // 3. 如果是激活分享，更新 profiles 表中的分享计数
    if (share_type === 'activation') {
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('activation_share_count')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError

      const newCount = (profile.activation_share_count || 0) + 1

      await supabaseClient
        .from('profiles')
        .update({ activation_share_count: newCount })
        .eq('id', userId)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Share event logged successfully' }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
    )

  } catch (error) {
    console.error('log_share_event error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
    )
  }
})
