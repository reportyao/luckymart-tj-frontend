// 开奖算法: 时间戳求和取模（7位数开奖码版本）
// 算法: 中奖索引 = 时间戳总和 % 总参与记录数
// 中奖码 = lottery_entries[中奖索引].numbers (7位数)
// 特点: 公平、可验证、无法作弊

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 生成 UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface DrawResult {
  success: boolean
  lottery_id: string
  winning_number: string  // 改为字符串，存储7位数开奖码
  winner_user_id: string | null
  winner_entry_id: string | null
  timestamp_sum: string
  total_entries: number
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

    // 2. 获取所有参与记录（使用 lottery_entries 表，按创建时间排序）
    const { data: entries, error: entriesError } = await supabaseClient
      .from('lottery_entries')
      .select('*')
      .eq('lottery_id', lottery_id)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true })

    if (entriesError || !entries || entries.length === 0) {
      throw new Error(`没有找到参与记录: ${entriesError?.message}`)
    }

    console.log(`找到 ${entries.length} 条参与记录`)

    // 3. 计算所有参与记录的购买时间戳总和
    let timestampSum = BigInt(0)
    
    for (const entry of entries) {
      const timestamp = new Date(entry.created_at).getTime()
      timestampSum += BigInt(timestamp)
    }

    console.log(`时间戳总和: ${timestampSum.toString()}`)

    // 4. 计算中奖索引: 时间戳总和 % 总参与记录数
    const totalEntries = entries.length
    const winningIndex = Number(timestampSum % BigInt(totalEntries))
    
    // 5. 获取中奖参与记录
    const winningEntry = entries[winningIndex]
    
    if (!winningEntry) {
      throw new Error(`未找到中奖记录,中奖索引: ${winningIndex}`)
    }

    // 中奖码是7位数字符串
    const winningNumber = winningEntry.numbers as string

    console.log(`中奖码: ${winningNumber} (索引: ${winningIndex})`)
    console.log(`中奖用户: ${winningEntry.user_id}`)

    const drawTime = new Date().toISOString()

    // 6. 更新夺宝状态
    const { error: updateError } = await supabaseClient
      .from('lotteries')
      .update({
        status: 'COMPLETED',
        winning_user_id: winningEntry.user_id,
        winning_numbers: [winningNumber], // 存储7位数开奖码
        winning_ticket_number: parseInt(winningNumber) || 0,
        draw_time: drawTime,
        actual_draw_time: drawTime,
        updated_at: drawTime,
        draw_algorithm_data: {
          algorithm: 'timestamp_sum',
          timestamp_sum: timestampSum.toString(),
          total_entries: totalEntries,
          winning_index: winningIndex,
          winning_number: winningNumber,
          formula: `中奖索引 = ${timestampSum.toString()} % ${totalEntries} = ${winningIndex}，对应号码: ${winningNumber}`,
        },
      })
      .eq('id', lottery_id)

    if (updateError) {
      throw new Error(`更新夺宝状态失败: ${updateError.message}`)
    }

    // 7. 更新中奖参与记录
    await supabaseClient
      .from('lottery_entries')
      .update({
        is_winning: true,
        updated_at: drawTime,
      })
      .eq('id', winningEntry.id)

    // 8. 创建开奖结果记录
    const lotteryResultId = generateUUID()
    const { error: resultError } = await supabaseClient
      .from('lottery_results')
      .insert({
        id: lotteryResultId,
        lottery_id: lottery_id,
        winner_id: winningEntry.user_id,
        winner_ticket_number: parseInt(winningNumber) || 0,
        draw_time: drawTime,
        algorithm_data: {
          algorithm: 'timestamp_sum',
          timestamp_sum: timestampSum.toString(),
          total_entries: totalEntries,
          winning_index: winningIndex,
          winning_number: winningNumber,
          formula: `中奖索引 = ${timestampSum.toString()} % ${totalEntries} = ${winningIndex}，对应号码: ${winningNumber}`,
        },
        created_at: drawTime,
      })

    if (resultError) {
      console.error('创建开奖结果记录失败:', resultError)
      // 不抛出错误,因为主要流程已完成
    }

    // 9. 创建中奖记录(奖品)
    const { error: prizeError } = await supabaseClient
      .from('prizes')
      .insert({
        user_id: winningEntry.user_id,
        lottery_id: lottery_id,
        ticket_id: winningEntry.id,
        winning_code: winningNumber, // 7位数开奖码
        prize_name: lottery.title,
        prize_image: lottery.image_url,
        prize_value: lottery.ticket_price * lottery.total_tickets,
        status: 'PENDING',
        won_at: drawTime,
        algorithm_data: {
          algorithm: 'timestamp_sum',
          timestamp_sum: timestampSum.toString(),
          winning_index: winningIndex,
        },
        created_at: drawTime,
        updated_at: drawTime,
      })

    if (prizeError) {
      console.error('创建奖品记录失败:', prizeError)
    }

    // 10. 发送中奖通知
    try {
      const notificationId = generateUUID()
      await supabaseClient.from('notifications').insert({
        id: notificationId,
        user_id: winningEntry.user_id,
        type: 'LOTTERY_RESULT',
        title: '🎉 恭喜中奖！',
        content: `恭喜您在"${lottery.title}"夺宝中中奖！中奖码: ${winningNumber}`,
        related_id: lottery_id,
        related_type: 'lottery',
        is_read: false,
        created_at: drawTime,
        updated_at: drawTime,
      })
    } catch (notifError) {
      console.error('发送通知失败:', notifError)
    }

    const result: DrawResult = {
      success: true,
      lottery_id: lottery_id,
      winning_number: winningNumber, // 7位数开奖码
      winner_user_id: winningEntry.user_id,
      winner_entry_id: winningEntry.id,
      timestamp_sum: timestampSum.toString(),
      total_entries: totalEntries,
      formula: `中奖索引 = ${timestampSum.toString()} % ${totalEntries} = ${winningIndex}，对应号码: ${winningNumber}`,
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
      winning_number: '',
      winner_user_id: null,
      winner_entry_id: null,
      timestamp_sum: '0',
      total_entries: 0,
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
