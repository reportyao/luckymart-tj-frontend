import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

/**
 * 时间戳之和算法（7位数参与码版本）
 * 
 * 设计逻辑：
 * 1. 参与码为7位数连续分配（1000000, 1000001, 1000002, ...）
 * 2. 计算所有订单的时间戳总和
 * 3. 使用公式：中奖号码索引 = 时间戳总和 % 总参与记录数
 * 4. 根据索引找到对应的参与记录，其参与码即为中奖号码
 * 
 * 公平性保证：
 * - 每个参与记录（每个7位数号码）都有相同的概率被选中
 * - 时间戳由服务器生成，用户无法操纵
 * - 所有数据公开可查，平台无法作弊
 */
function calculateWinningNumberByTimestamp(entries: any[]) {
  // 计算所有订单的时间戳总和
  let timestampSum = 0;
  const timestampDetails: { entry_id: string; numbers: string; timestamp: number }[] = [];

  for (const entry of entries) {
    // 将 ISO 时间字符串转换为毫秒时间戳
    const timestamp = new Date(entry.created_at).getTime();
    timestampSum += timestamp;
    timestampDetails.push({
      entry_id: entry.id,
      numbers: entry.participation_code || entry.numbers, // 使用 participation_code 字段
      timestamp: timestamp,
    });
  }

  // 计算中奖索引: 时间戳总和 % 总参与记录数
  const winningIndex = timestampSum % entries.length;
  
  // 获取中奖参与记录
  const winningEntry = entries[winningIndex];
  const winningNumber = winningEntry.participation_code || winningEntry.numbers; // 7位数参与码

  return {
    winningNumber,
    winningIndex,
    timestampSum,
    timestampDetails,
    totalEntries: entries.length,
    formula: `中奖索引 = ${timestampSum} % ${entries.length} = ${winningIndex}，对应号码: ${winningNumber}`,
  };
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

    // 1. 获取积分商城商品信息
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
    if (lottery.status === 'COMPLETED') {
      throw new Error('Lottery already drawn');
    }

    // 4. 获取所有参与记录（按创建时间排序）
    const { data: entries, error: entriesError } = await supabaseClient
      .from('lottery_entries')
      .select('*')
      .eq('lottery_id', lotteryId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true });

    if (entriesError || !entries || entries.length === 0) {
      throw new Error('No lottery entries found for this lottery');
    }

    // 5. 使用时间戳之和算法计算中奖号码
    const result = calculateWinningNumberByTimestamp(entries);

    // 6. 获取中奖参与记录
    const winningEntry = entries[result.winningIndex];

    if (!winningEntry) {
      throw new Error(`Winning entry not found at index ${result.winningIndex}`);
    }

    // 7. 开始事务: 更新lottery状态、创建prize记录、发送通知
    const drawTime = new Date().toISOString();

    // 更新lottery状态 - 使用 COMPLETED 状态确保前端能正确显示
    const { error: updateLotteryError } = await supabaseClient
      .from('lotteries')
      .update({
        status: 'COMPLETED', // 改为 COMPLETED 状态
        winning_numbers: [winningEntry.participation_code || winningEntry.numbers], // 7位数参与码
        winning_ticket_number: parseInt(winningEntry.participation_code || winningEntry.numbers) || winningEntry.participation_code || winningEntry.numbers, // 同时设置 winning_ticket_number
        winning_user_id: winningEntry.user_id,
        draw_time: drawTime,
        actual_draw_time: drawTime,
        updated_at: drawTime,
        draw_algorithm_data: {
          algorithm: 'timestamp_sum',
          timestamp_sum: result.timestampSum,
          formula: result.formula,
          total_entries: result.totalEntries,
          winning_index: result.winningIndex,
          winning_number: result.winningNumber,
        },
      })
      .eq('id', lotteryId);
    
    console.log('[AutoLotteryDraw] Updated lottery status to COMPLETED with draw_algorithm_data');

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

    // 创建 lottery_results 记录 - 修复: 使用正确的字段名
    const lotteryResultId = generateUUID();
    const winningTicketNumber = parseInt(winningEntry.participation_code || winningEntry.numbers) || 0;
    
    const { data: lotteryResult, error: resultError } = await supabaseClient
      .from('lottery_results')
      .insert({
        id: lotteryResultId,
        lottery_id: lotteryId,
        winner_id: winningEntry.user_id, // 修复: 添加 winner_id 字段
        winner_ticket_number: winningTicketNumber, // 修复: 使用正确的字段名
        draw_time: drawTime,
        algorithm_data: {
          algorithm: 'timestamp_sum',
          timestamp_sum: result.timestampSum,
          formula: result.formula,
          total_entries: result.totalEntries,
          winning_index: result.winningIndex,
          winning_number: result.winningNumber,
          timestamp_details: result.timestampDetails,
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
        ticket_id: winningEntry.id, // 使用 lottery_entry id
        winning_code: winningEntry.participation_code || winningEntry.numbers, // 7位数参与码
        prize_name: lottery.title,
        prize_image: lottery.images?.[0] || lottery.image_url,
        prize_value: lottery.ticket_price * lottery.total_tickets,
        status: 'PENDING',
        won_at: drawTime,
        algorithm_data: {
          algorithm: 'timestamp_sum',
          timestamp_sum: result.timestampSum,
          formula: result.formula,
          winning_index: result.winningIndex,
        },
        created_at: drawTime,
        updated_at: drawTime,
      })
      .select()
      .single();

    if (prizeError) {
      console.error('Failed to create prize:', prizeError);
    }

    // 发送中奖通知给中奖用户 - 修复: 使用正确的枚举值和添加必填字段
    try {
      const notificationId = generateUUID();
      await supabaseClient.from('notifications').insert({
        id: notificationId, // 修复: 添加 id 字段
        user_id: winningEntry.user_id,
        type: 'LOTTERY_RESULT', // 修复: 使用存在的枚举值 (LOTTERY_RESULT 而不是 LOTTERY_WIN)
        title: '🎉 恭喜中奖！',
        content: `恭喜您在"${lottery.title}"积分商城中中奖！中奖码: ${winningEntry.participation_code || winningEntry.numbers}`,
        related_id: lotteryId, // 修复: 使用 related_id 而不是 data
        related_type: 'lottery',
        is_read: false,
        created_at: drawTime,
        updated_at: drawTime,
      });
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
    }

    // 发送开奖公告通知给所有参与者
    const participantIds = [...new Set(entries.map((e) => e.user_id))];
    const announcements = participantIds
      .filter((userId) => userId !== winningEntry.user_id)
      .map((userId) => ({
        id: generateUUID(), // 修复: 添加 id 字段
        user_id: userId,
        type: 'LOTTERY_RESULT',
        title: '开奖结果公布',
        content: `"${lottery.title}"已开奖，中奖码: ${winningEntry.participation_code || winningEntry.numbers}`,
        related_id: lotteryId, // 修复: 使用 related_id 而不是 data
        related_type: 'lottery',
        is_read: false,
        created_at: drawTime,
        updated_at: drawTime,
      }));

    if (announcements.length > 0) {
      await supabaseClient.from('notifications').insert(announcements);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          lottery_id: lotteryId,
          winning_number: winningEntry.participation_code || winningEntry.numbers, // 7位数参与码
          winning_code: winningEntry.participation_code || winningEntry.numbers,
          winner_user_id: winningEntry.user_id,
          prize_id: prize?.id,
          lottery_result_id: lotteryResult?.id || lotteryResultId,
          algorithm: 'timestamp_sum',
          timestamp_sum: result.timestampSum,
          formula: result.formula,
          draw_time: drawTime,
          total_entries: result.totalEntries,
          winning_index: result.winningIndex,
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
