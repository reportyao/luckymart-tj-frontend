import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 检查夺宝商品是否售罄，如果售罄则自动触发开奖
 * 这个函数可以被购买彩票API调用，或者定时任务调用
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { lotteryId } = await req.json()

    // 如果指定了lottery_id，只检查该商品
    // 否则检查所有ACTIVE状态的商品
    let query = supabaseClient
      .from('lotteries')
      .select('*')
      .eq('status', 'ACTIVE')

    if (lotteryId) {
      query = query.eq('id', lotteryId)
    }

    const { data: lotteries, error } = await query

    if (error) {
      throw new Error(`Failed to fetch lotteries: ${error.message}`)
    }

    if (!lotteries || lotteries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active lotteries found',
          checked: 0,
          sold_out: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const soldOutLotteries = []

    // 检查每个商品是否售罄
    for (const lottery of lotteries) {
      if (lottery.sold_tickets >= lottery.total_tickets) {
        soldOutLotteries.push(lottery)

        // 调用自动开奖API
        try {
          const drawResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/auto-lottery-draw`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
              },
              body: JSON.stringify({ lotteryId: lottery.id })
            }
          )

          const drawResult = await drawResponse.json()

          if (!drawResult.success) {
            console.error(`Failed to draw lottery ${lottery.id}:`, drawResult.error)
          } else {
            console.log(`Successfully drew lottery ${lottery.id}`)
          }
        } catch (drawError) {
          console.error(`Error drawing lottery ${lottery.id}:`, drawError)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${lotteries.length} lotteries, found ${soldOutLotteries.length} sold out`,
        checked: lotteries.length,
        sold_out: soldOutLotteries.length,
        sold_out_lottery_ids: soldOutLotteries.map(l => l.id)
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
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
