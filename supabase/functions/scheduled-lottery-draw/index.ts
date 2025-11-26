import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 定时检查并开奖已售罄且到达开奖时间的夺宝活动
 * 这个函数应该被定时任务调用（例如每分钟一次）
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

    const now = new Date().toISOString();

    // 查找所有已售罄且到达开奖时间的活动
    const { data: lotteries, error } = await supabaseClient
      .from('lotteries')
      .select('*')
      .eq('status', 'SOLD_OUT')
      .lte('draw_time', now) // 开奖时间已到
      .order('draw_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch lotteries: ${error.message}`);
    }

    if (!lotteries || lotteries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No lotteries ready for drawing',
          checked: 0,
          drawn: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const drawnLotteries = [];
    const failedLotteries = [];

    // 对每个活动调用开奖 API
    for (const lottery of lotteries) {
      try {
        const drawResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/auto-lottery-draw`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ lotteryId: lottery.id }),
          }
        );

        const drawResult = await drawResponse.json();

        if (!drawResult.success) {
          console.error(`Failed to draw lottery ${lottery.id}:`, drawResult.error);
          failedLotteries.push({
            lottery_id: lottery.id,
            error: drawResult.error,
          });
        } else {
          console.log(`Successfully drew lottery ${lottery.id}`);
          drawnLotteries.push(lottery.id);
        }
      } catch (drawError: any) {
        console.error(`Error drawing lottery ${lottery.id}:`, drawError);
        failedLotteries.push({
          lottery_id: lottery.id,
          error: drawError.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${lotteries.length} lotteries, drew ${drawnLotteries.length}, failed ${failedLotteries.length}`,
        checked: lotteries.length,
        drawn: drawnLotteries.length,
        failed: failedLotteries.length,
        drawn_lottery_ids: drawnLotteries,
        failed_lotteries: failedLotteries,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Scheduled lottery draw error:', error);
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
