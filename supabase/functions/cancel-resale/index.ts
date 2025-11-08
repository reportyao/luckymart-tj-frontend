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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { resaleItemId } = await req.json()

    // 验证用户身份
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('未授权')
    }

    // 查询转售商品
    const { data: resaleItem, error: resaleError } = await supabaseClient
      .from('resale_items')
      .select('*')
      .eq('id', resaleItemId)
      .eq('seller_id', user.id)
      .single()

    if (resaleError || !resaleItem) {
      throw new Error('转售商品不存在或不属于您')
    }

    // 检查状态
    if (resaleItem.status !== 'ACTIVE') {
      throw new Error('该商品已下架或已售出')
    }

    // 更新转售商品状态
    const { error: updateResaleError } = await supabaseClient
      .from('resale_items')
      .update({ status: 'CANCELLED' })
      .eq('id', resaleItemId)

    if (updateResaleError) {
      throw new Error('取消转售失败: ' + updateResaleError.message)
    }

    // 恢复奖品状态
    const { error: updatePrizeError } = await supabaseClient
      .from('prizes')
      .update({ status: 'PENDING' })
      .eq('id', resaleItem.prize_id)

    if (updatePrizeError) {
      throw new Error('恢复奖品状态失败: ' + updatePrizeError.message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '取消转售成功',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
