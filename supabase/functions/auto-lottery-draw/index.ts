import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * VRF (Verifiable Random Function) 算法
 * 生成可验证的随机中奖号码
 */
function generateVRFWinningNumber(lotteryId: string, totalTickets: number, seed: string) {
  // 使用lottery_id + seed + timestamp生成随机种子
  const timestamp = Date.now();
  const input = `${lotteryId}-${seed}-${timestamp}`;

  // 简化的VRF实现 (生产环境应使用专业的VRF库)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // 确保结果在1到totalTickets范围内
  const winningNumber = Math.abs(hash % totalTickets) + 1;

  // 生成证明(proof) - 用于验证随机性
  const proof = btoa(input); // Base64编码作为proof

  return { winningNumber, proof, timestamp };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { lotteryId } = await req.json();

    if (!lotteryId) {
      throw new Error('lottery_id is required');
    }

    // 1. 获取夺宝商品信息
    const { data: lottery, error: lotteryError } = await supabaseClient
      .from('lotteries')
      .select('*')
      .eq('id', lotteryId)
      .single();

    if (lotteryError || !lottery) {
      throw new Error('Lottery not found');
    }

    // 2. 检查是否已售罄
    if (lottery.sold_tickets < lottery.total_tickets) {
      throw new Error('Lottery not sold out yet');
    }

    // 3. 检查是否已经开奖
    if (lottery.status === 'DRAWN' || lottery.status === 'COMPLETED') {
      throw new Error('Lottery already drawn');
    }

    // ✅ 修复：使用 lottery_entries 表而不是 tickets 表
    const { data: entries, error: entriesError } = await supabaseClient
      .from('lottery_entries')
      .select('*')
      .eq('lottery_id', lotteryId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true });

    if (entriesError || !entries || entries.length === 0) {
      throw new Error('No lottery entries found for this lottery');
    }

    // ✅ 修复：使用 VRF 算法生成中奖号码（基于参与记录数量）
    const vrf = generateVRFWinningNumber(
      lotteryId,
      entries.length,
      lottery.id + lottery.created_at // 使用lottery信息作为seed
    );

    // ✅ 修复：根据 VRF 结果选择中奖记录
    const winningIndex = vrf.winningNumber - 1; // 数组索引从0开始
    const winningEntry = entries[winningIndex];

    if (!winningEntry) {
      throw new Error('Winning entry not found');
    }

    // 7. 开始事务: 更新lottery状态、创建prize记录、发送通知
    const drawTime = new Date().toISOString();

    // 更新lottery状态
    const { error: updateLotteryError } = await supabaseClient
      .from('lotteries')
      .update({
        status: 'DRAWN',
        winning_numbers: [winningEntry.numbers], // ✅ 使用 numbers 字段，转换为数组
        winning_user_id: winningEntry.user_id,
        draw_time: drawTime,
        updated_at: drawTime,
      })
      .eq('id', lotteryId);

    if (updateLotteryError) {
      throw new Error(`Failed to update lottery: ${updateLotteryError.message}`);
    }

    // 更新中奖记录
    const { error: updateEntryError } = await supabaseClient
      .from('lottery_entries')
      .update({
        is_winning: true,
        updated_at: drawTime,
      })
      .eq('id', winningEntry.id);

    if (updateEntryError) {
      console.error('Failed to update winning entry:', updateEntryError);
    }

    // 创建 lottery_results 记录
    const { data: lotteryResult, error: resultError } = await supabaseClient
      .from('lottery_results')
      .insert({
        lottery_id: lotteryId,
        winning_number: winningEntry.numbers,
        draw_time: drawTime,
        algorithm_data: {
          vrf_proof: vrf.proof,
          vrf_timestamp: vrf.timestamp,
          total_entries: entries.length,
          winning_index: winningIndex,
        },
        created_at: drawTime,
      })
      .select()
      .single();

    if (resultError) {
      console.error('Failed to create lottery result:', resultError);
    }

    // 创建prize记录
    const { data: prize, error: prizeError } = await supabaseClient
      .from('prizes')
      .insert({
        lottery_id: lotteryId,
        user_id: winningEntry.user_id,
        ticket_id: winningEntry.id, // ✅ 使用 lottery_entry id
        winning_code: winningEntry.numbers,
        prize_name: lottery.title,
        prize_image: lottery.images?.[0] || lottery.image_url,
        prize_value: lottery.ticket_price * lottery.total_tickets,
        status: 'PENDING',
        won_at: drawTime,
        algorithm_data: {
          vrf_proof: vrf.proof,
          vrf_timestamp: vrf.timestamp,
        },
        created_at: drawTime,
        updated_at: drawTime,
      })
      .select()
      .single();

    if (prizeError) {
      console.error('Failed to create prize:', prizeError);
    }

    // 发送中奖通知给中奖用户
    try {
      await supabaseClient.from('notifications').insert({
        user_id: winningEntry.user_id,
        type: 'LOTTERY_WIN',
        title: '🎉 恭喜中奖！',
        content: `恭喜您在"${lottery.title}"夺宝中中奖！中奖码: ${winningEntry.numbers}`,
        data: {
          lottery_id: lotteryId,
          prize_id: prize?.id,
          winning_code: winningEntry.numbers,
        },
        is_read: false,
        created_at: drawTime,
      });
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
    }

    // 发送开奖公告通知给所有参与者
    const participantIds = [...new Set(entries.map((e) => e.user_id))];
    const announcements = participantIds
      .filter((userId) => userId !== winningEntry.user_id)
      .map((userId) => ({
        user_id: userId,
        type: 'LOTTERY_RESULT',
        title: '开奖结果公布',
        content: `"${lottery.title}"已开奖，中奖码: ${winningEntry.numbers}`,
        data: {
          lottery_id: lotteryId,
          winning_code: winningEntry.numbers,
        },
        is_read: false,
        created_at: drawTime,
      }));

    if (announcements.length > 0) {
      await supabaseClient.from('notifications').insert(announcements);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          lottery_id: lotteryId,
          winning_number: winningEntry.numbers,
          winning_code: winningEntry.numbers,
          winner_user_id: winningEntry.user_id,
          prize_id: prize?.id,
          lottery_result_id: lotteryResult?.id,
          vrf_proof: vrf.proof,
          vrf_timestamp: vrf.timestamp,
          draw_time: drawTime,
          total_entries: entries.length,
          winning_index: winningIndex,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Auto lottery draw error:', error);
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
