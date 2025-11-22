// 开奖算法: 时间戳求和取模
// 算法: 中奖号码 = (所有票购买时间戳总和 % 总票数) + 1
// 特点: 公平、可验证、无法作弊

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DrawResult {
  success: boolean
  lottery_id: string
  winning_number: number
  winner_user_id: string | null
  winner_ticket_id: string | null
  timestamp_sum: string
  total_tickets: number
  formula: string
  error?: string
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

    const { lottery_id } = await req.json()

    if (!lottery_id) {
      throw new Error('lottery_id is required')
    }

    console.log(`开始开奖: lottery_id=${lottery_id}`)

    // 1. 获取夺宝信息
    const { data: lottery, error: lotteryError } = await supabaseClient
      .from('lotteries')
      .select('*')
      .eq('id', lottery_id)
      .single()

    if (lotteryError || !lottery) {
      throw new Error(`夺宝不存在: ${lotteryError?.message}`)
    }

    // 检查状态
    if (lottery.status !== 'SOLD_OUT') {
      throw new Error(`夺宝状态不正确,当前状态: ${lottery.status},需要 SOLD_OUT`)
    }

    // 2. 获取所有参与的票(按票号排序)
    const { data: tickets, error: ticketsError } = await supabaseClient
      .from('tickets')
      .select('*')
      .eq('lottery_id', lottery_id)
      .order('ticket_number', { ascending: true })

    if (ticketsError || !tickets || tickets.length === 0) {
      throw new Error(`没有找到票记录: ${ticketsError?.message}`)
    }

    console.log(`找到 ${tickets.length} 张票`)

    // 3. 计算所有票的购买时间戳总和
    let timestampSum = BigInt(0)
    
    for (const ticket of tickets) {
      const timestamp = new Date(ticket.created_at).getTime()
      timestampSum += BigInt(timestamp)
    }

    console.log(`时间戳总和: ${timestampSum.toString()}`)

    // 4. 计算中奖号码: (时间戳总和 % 总票数) + 1
    const totalTickets = lottery.total_tickets
    const winningNumber = Number(timestampSum % BigInt(totalTickets)) + 1

    console.log(`中奖号码: ${winningNumber} = ${timestampSum.toString()} % ${totalTickets} + 1`)

    // 5. 找到中奖票
    const winningTicket = tickets.find(t => t.ticket_number === winningNumber)

    if (!winningTicket) {
      throw new Error(`未找到中奖票,中奖号码: ${winningNumber}`)
    }

    console.log(`中奖用户: ${winningTicket.user_id}`)

    // 6. 更新夺宝状态
    const { error: updateError } = await supabaseClient
      .from('lotteries')
      .update({
        status: 'DRAWN',
        winner_id: winningTicket.user_id,
        winner_ticket_number: winningNumber,
        draw_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', lottery_id)

    if (updateError) {
      throw new Error(`更新夺宝状态失败: ${updateError.message}`)
    }

    // 7. 创建开奖结果记录
    const { error: resultError } = await supabaseClient
      .from('lottery_results')
      .insert({
        lottery_id: lottery_id,
        winner_id: winningTicket.user_id,
        winner_ticket_id: winningTicket.id,
        winning_number: winningNumber,
        draw_time: new Date().toISOString(),
        algorithm_type: 'timestamp_sum',
        algorithm_data: {
          timestamp_sum: timestampSum.toString(),
          total_tickets: totalTickets,
          formula: `${winningNumber} = ${timestampSum.toString()} % ${totalTickets} + 1`,
          ticket_count: tickets.length,
        },
        created_at: new Date().toISOString(),
      })

    if (resultError) {
      console.error('创建开奖结果记录失败:', resultError)
      // 不抛出错误,因为主要流程已完成
    }

    // 8. 创建中奖记录(奖品)
    const { error: prizeError } = await supabaseClient
      .from('prizes')
      .insert({
        user_id: winningTicket.user_id,
        lottery_id: lottery_id,
        ticket_id: winningTicket.id,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (prizeError) {
      console.error('创建奖品记录失败:', prizeError)
    }

    // 9. 发送中奖通知(TODO: 实现通知功能)
    // await sendWinnerNotification(winningTicket.user_id, lottery_id)

    const result: DrawResult = {
      success: true,
      lottery_id: lottery_id,
      winning_number: winningNumber,
      winner_user_id: winningTicket.user_id,
      winner_ticket_id: winningTicket.id,
      timestamp_sum: timestampSum.toString(),
      total_tickets: totalTickets,
      formula: `${winningNumber} = ${timestampSum.toString()} % ${totalTickets} + 1`,
    }

    console.log('开奖成功:', result)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    )

  } catch (error) {
    console.error('开奖失败:', error)
    
    const errorResult: DrawResult = {
      success: false,
      lottery_id: '',
      winning_number: 0,
      winner_user_id: null,
      winner_ticket_id: null,
      timestamp_sum: '0',
      total_tickets: 0,
      formula: '',
      error: error.message,
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
