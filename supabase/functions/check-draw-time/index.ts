// 定时任务: 检查是否有到达开奖时间的夺宝
// 运行频率: 每分钟
// 功能: 查找状态为 SOLD_OUT 且 draw_time <= NOW() 的夺宝,自动调用开奖函数

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckResult {
  success: boolean
  checked_at: string
  lotteries_found: number
  draw_results: Array<{
    lottery_id: string
    success: boolean
    winning_number?: number
    error?: string
  }>
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const now = new Date().toISOString()
    console.log(`[${now}] 开始检查待开奖的夺宝...`)

    // 查找状态为 SOLD_OUT 且 draw_time <= NOW() 的夺宝
    const { data: lotteries, error: queryError } = await supabaseClient
      .from('lotteries')
      .select('id, title, draw_time, total_tickets, sold_tickets')
      .eq('status', 'SOLD_OUT')
      .lte('draw_time', now)
      .order('draw_time', { ascending: true })

    if (queryError) {
      throw new Error(`查询夺宝失败: ${queryError.message}`)
    }

    console.log(`找到 ${lotteries?.length || 0} 个待开奖的夺宝`)

    const drawResults = []

    // 逐个开奖
    for (const lottery of lotteries || []) {
      console.log(`开始开奖: ${lottery.id} - ${lottery.title}`)
      
      try {
        // 调用开奖函数
        const drawResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/lottery-draw-timestamp`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ lottery_id: lottery.id }),
          }
        )

        const drawResult = await drawResponse.json()

        if (drawResult.success) {
          console.log(`✅ 开奖成功: ${lottery.id}, 中奖号码: ${drawResult.winning_number}`)
          drawResults.push({
            lottery_id: lottery.id,
            success: true,
            winning_number: drawResult.winning_number,
          })
        } else {
          console.error(`❌ 开奖失败: ${lottery.id}, 错误: ${drawResult.error}`)
          drawResults.push({
            lottery_id: lottery.id,
            success: false,
            error: drawResult.error,
          })
        }
      } catch (error) {
        console.error(`❌ 调用开奖函数失败: ${lottery.id}, 错误: ${error.message}`)
        drawResults.push({
          lottery_id: lottery.id,
          success: false,
          error: error.message,
        })
      }
    }

    const result: CheckResult = {
      success: true,
      checked_at: now,
      lotteries_found: lotteries?.length || 0,
      draw_results: drawResults,
    }

    console.log('检查完成:', result)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    )

  } catch (error) {
    console.error('检查失败:', error)
    
    const errorResult: CheckResult = {
      success: false,
      checked_at: new Date().toISOString(),
      lotteries_found: 0,
      draw_results: [],
    }

    return new Response(
      JSON.stringify(errorResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      },
    )
  }
})

// Supabase Cron Job 配置说明:
// 
// 在 Supabase SQL Editor 中执行以下 SQL:
// 
// -- 启用 pg_cron 扩展
// CREATE EXTENSION IF NOT EXISTS pg_cron;
// 
// -- 创建定时任务(每分钟运行一次)
// SELECT cron.schedule(
//   'check-lottery-draw-time',  -- 任务名称
//   '* * * * *',                 -- Cron 表达式(每分钟)
//   $$
//   SELECT net.http_post(
//     url:='https://owyitxwxmxwbkqgzffdw.supabase.co/functions/v1/check-draw-time',
//     headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
//   ) as request_id;
//   $$
// );
// 
// -- 查看所有定时任务
// SELECT * FROM cron.job;
// 
// -- 删除定时任务(如果需要)
// SELECT cron.unschedule('check-lottery-draw-time');
