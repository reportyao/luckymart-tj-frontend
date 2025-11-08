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

    const { prizeId, price, description } = await req.json()

    // 验证用户身份
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('未授权')
    }

    // 查询奖品信息
    const { data: prize, error: prizeError } = await supabaseClient
      .from('prizes')
      .select('*, lotteries(*)')
      .eq('id', prizeId)
      .eq('user_id', user.id)
      .single()

    if (prizeError || !prize) {
      throw new Error('奖品不存在或不属于您')
    }

    // 检查奖品状态
    if (prize.status !== 'PENDING' && prize.status !== 'REJECTED') {
      throw new Error('该奖品不能转售')
    }

    // 检查是否已经在转售中
    const { data: existingResale } = await supabaseClient
      .from('resale_items')
      .select('id')
      .eq('prize_id', prizeId)
      .eq('status', 'ACTIVE')
      .single()

    if (existingResale) {
      throw new Error('该奖品已在转售中')
    }

    // 创建转售商品
    const { data: resaleItem, error: resaleError } = await supabaseClient
      .from('resale_items')
      .insert({
        prize_id: prizeId,
        seller_id: user.id,
        lottery_id: prize.lottery_id,
        original_price: prize.lotteries.ticket_price,
        resale_price: price,
        description: description,
        status: 'ACTIVE',
      })
      .select()
      .single()

    if (resaleError) {
      throw new Error('创建转售商品失败: ' + resaleError.message)
    }

    // 更新奖品状态为转售中
    await supabaseClient
      .from('prizes')
      .update({ status: 'RESELLING' })
      .eq('id', prizeId)

    return new Response(
      JSON.stringify({
        success: true,
        data: resaleItem,
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
