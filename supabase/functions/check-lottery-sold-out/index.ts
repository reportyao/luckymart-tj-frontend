import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
};

/**
 * 检查积分商城商品是否售罄，如果售罄则设置开奖时间（180秒后）
 * 这个函数由购买API调用，不再直接触发开奖
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { lotteryId } = await req.json();

    // 如果指定了lottery_id，只检查该商品
    // 否则检查所有ACTIVE状态的商品
    let query = supabaseClient
      .from('lotteries')
      .select('*')
      .eq('status', 'ACTIVE');

    if (lotteryId) {
      query = query.eq('id', lotteryId);
    }

    const { data: lotteries, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch lotteries: ${error.message}`);
    }

    if (!lotteries || lotteries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active lotteries found',
          checked: 0,
          sold_out: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const soldOutLotteries = [];

    // 检查每个商品是否售罄
    for (const lottery of lotteries) {
      if (lottery.sold_tickets >= lottery.total_tickets) {
        soldOutLotteries.push(lottery);

        // ✅ 修复：设置状态为 SOLD_OUT 并设置开奖时间（180秒后）
        // 不再直接调用开奖API
        const drawTime = new Date(Date.now() + 180 * 1000); // 180秒后

        const { error: updateError } = await supabaseClient
          .from('lotteries')
          .update({
            status: 'SOLD_OUT',
            draw_time: drawTime.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', lottery.id);

        if (updateError) {
          console.error(`Failed to update lottery ${lottery.id}:`, updateError);
        } else {
          console.log(
            `Lottery ${lottery.id} marked as SOLD_OUT, draw time set to ${drawTime.toISOString()}`
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${lotteries.length} lotteries, found ${soldOutLotteries.length} sold out`,
        checked: lotteries.length,
        sold_out: soldOutLotteries.length,
        sold_out_lottery_ids: soldOutLotteries.map((l) => l.id),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Check lottery sold-out error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
