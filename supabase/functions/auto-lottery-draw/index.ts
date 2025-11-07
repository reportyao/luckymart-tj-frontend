import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * VRF (Verifiable Random Function) 算法
 * 生成可验证的随机中奖号码
 */
function generateVRFWinningNumber(lotteryId: string, totalTickets: number, seed: string): {
  winningNumber: number
  proof: string
  timestamp: number
} {
  // 使用lottery_id + seed + timestamp生成随机种子
  const timestamp = Date.now()
  const input = `${lotteryId}-${seed}-${timestamp}`
  
  // 简化的VRF实现 (生产环境应使用专业的VRF库)
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  // 确保结果在1到totalTickets范围内
  const winningNumber = Math.abs(hash % totalTickets) + 1
  
  // 生成证明(proof) - 用于验证随机性
  const proof = btoa(input) // Base64编码作为proof
  
  return {
    winningNumber,
    proof,
    timestamp
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { lotteryId } = await req.json()

    if (!lotteryId) {
      throw new Error('lottery_id is required')
    }

    // 1. 获取夺宝商品信息
    const { data: lottery, error: lotteryError } = await supabaseClient
      .from('lotteries')
      .select('*')
      .eq('id', lotteryId)
      .single()

    if (lotteryError || !lottery) {
      throw new Error('Lottery not found')
    }

    // 2. 检查是否已售罄
    if (lottery.sold_tickets < lottery.total_tickets) {
      throw new Error('Lottery not sold out yet')
    }

    // 3. 检查是否已经开奖
    if (lottery.status === 'DRAWN') {
      throw new Error('Lottery already drawn')
    }

    // 4. 获取所有参与的彩票
    const { data: tickets, error: ticketsError } = await supabaseClient
      .from('tickets')
      .select('*')
      .eq('lottery_id', lotteryId)
      .order('ticket_number', { ascending: true })

    if (ticketsError || !tickets || tickets.length === 0) {
      throw new Error('No tickets found for this lottery')
    }

    // 5. 使用VRF算法生成中奖号码
    const vrf = generateVRFWinningNumber(
      lotteryId,
      lottery.total_tickets,
      lottery.id + lottery.created_at // 使用lottery信息作为seed
    )

    // 6. 找到中奖彩票
    const winningTicket = tickets.find(t => t.ticket_number === vrf.winningNumber)

    if (!winningTicket) {
      throw new Error('Winning ticket not found')
    }

    // 7. 开始事务: 更新lottery状态、创建prize记录、发送通知
    const drawTime = new Date().toISOString()

    // 更新lottery状态
    const { error: updateLotteryError } = await supabaseClient
      .from('lotteries')
      .update({
        status: 'DRAWN',
        winning_ticket_number: vrf.winningNumber,
        winning_user_id: winningTicket.user_id,
        draw_time: drawTime,
        vrf_proof: vrf.proof,
        vrf_timestamp: vrf.timestamp
      })
      .eq('id', lotteryId)

    if (updateLotteryError) {
      throw new Error(`Failed to update lottery: ${updateLotteryError.message}`)
    }

    // 创建prize记录
    const { data: prize, error: prizeError } = await supabaseClient
      .from('prizes')
      .insert({
        lottery_id: lotteryId,
        user_id: winningTicket.user_id,
        ticket_id: winningTicket.id,
        winning_code: winningTicket.winning_code,
        prize_name: lottery.title,
        prize_image: lottery.image_url,
        prize_value: lottery.price * lottery.total_tickets,
        status: 'PENDING', // 待处理(用户需要选择发货或转售)
        won_at: drawTime
      })
      .select()
      .single()

    if (prizeError) {
      console.error('Failed to create prize:', prizeError)
    }

    // 发送中奖通知给中奖用户
    try {
      await supabaseClient.from('notifications').insert({
        user_id: winningTicket.user_id,
        type: 'LOTTERY_WIN',
        title: '🎉 恭喜中奖！',
        content: `恭喜您在"${lottery.title}"夺宝中中奖！中奖码: ${winningTicket.winning_code}`,
        data: {
          lottery_id: lotteryId,
          prize_id: prize?.id,
          winning_code: winningTicket.winning_code
        },
        is_read: false
      })
    } catch (notifError) {
      console.error('Failed to send notification:', notifError)
    }

    // 发送开奖公告通知给所有参与者
    const participantIds = [...new Set(tickets.map(t => t.user_id))]
    const announcements = participantIds
      .filter(userId => userId !== winningTicket.user_id)
      .map(userId => ({
        user_id: userId,
        type: 'LOTTERY_RESULT',
        title: '开奖结果公布',
        content: `"${lottery.title}"已开奖，中奖码: ${winningTicket.winning_code}`,
        data: {
          lottery_id: lotteryId,
          winning_code: winningTicket.winning_code
        },
        is_read: false
      }))

    if (announcements.length > 0) {
      await supabaseClient.from('notifications').insert(announcements)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          lottery_id: lotteryId,
          winning_ticket_number: vrf.winningNumber,
          winning_code: winningTicket.winning_code,
          winner_user_id: winningTicket.user_id,
          prize_id: prize?.id,
          vrf_proof: vrf.proof,
          vrf_timestamp: vrf.timestamp,
          draw_time: drawTime
        }
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
