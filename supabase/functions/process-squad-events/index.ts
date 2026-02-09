/**
 * ============================================================================
 * 异步事件处理 Worker (process-squad-events)
 * ============================================================================
 *
 * 功能概述:
 *   消费 event_queue 表中的待处理事件，调用对应的 Edge Function 完成实际业务处理。
 *   支持自动重试（指数退避）和死信队列。
 *
 * 触发方式:
 *   1. Supabase Database Webhook: 当 event_queue 表有新 INSERT 时自动触发
 *   2. Supabase Cron Job: 每分钟定时触发，处理可能遗漏的事件
 *   3. 手动调用: POST /functions/v1/process-squad-events
 *
 * 处理流程:
 *   1. 从 event_queue 中取出一批 pending 状态的事件（默认 10 条）
 *   2. 先释放超时的锁（防止 Worker 崩溃导致事件卡住）
 *   3. 逐个处理事件，根据 event_type 路由到对应的处理函数
 *   4. 处理成功: 标记为 completed
 *   5. 处理失败: 如果还有重试机会，重置为 pending（指数退避）
 *                如果重试次数耗尽，转入 dead_letter_queue
 *
 * 支持的事件类型:
 *   - COMMISSION:      调用 handle-purchase-commission
 *   - AI_REWARD:       调用 ai-add-bonus
 *   - FIRST_GROUP_BUY: 调用 handle-first-group-buy-reward
 *   - NOTIFICATION:    写入 notification_queue 表
 *
 * 幂等性保证:
 *   - 每个事件处理函数内部都有自己的防重复机制
 *   - handle-purchase-commission: 检查 commissions 表
 *   - handle-first-group-buy-reward: 检查 invite_rewards 表
 *   - ai-add-bonus: 通过 idempotency_key 在事件队列层面保证
 *   - notification: 通过 idempotency_key 在事件队列层面保证
 *
 * 并发安全:
 *   - 使用 locked_by + locked_at 字段实现乐观锁
 *   - 多个 Worker 实例可以安全并发运行
 *   - 超时 5 分钟的锁会被自动释放
 * ============================================================================
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  dequeueEvents,
  markEventCompleted,
  markEventFailed,
  releaseStaleEvents,
  EventType,
} from '../_shared/eventQueue.ts';
import type { QueuedEvent } from '../_shared/eventQueue.ts';

// ============================================================================
// 环境变量
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ============================================================================
// 事件处理器：每种事件类型对应一个处理函数
// ============================================================================

/**
 * 处理推荐佣金事件
 *
 * 调用 handle-purchase-commission Edge Function，为推荐人发放三级分销佣金。
 * handle-purchase-commission 内部会:
 *   1. 查询用户的推荐关系链（最多 3 级）
 *   2. 检查是否已发放过佣金（防重复）
 *   3. 计算佣金金额并写入 commissions 表
 *   4. 更新推荐人的积分钱包余额
 *   5. 发送 Telegram 通知
 *
 * @param event - 队列事件，payload 包含 { order_id, user_id, order_amount }
 */
async function handleCommission(event: QueuedEvent): Promise<void> {
  const { order_id, user_id, order_amount } = event.payload as any;

  console.log(`[Worker] Processing COMMISSION: order=${order_id}, user=${user_id}, amount=${order_amount}`);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/handle-purchase-commission`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order_id, user_id, order_amount }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`handle-purchase-commission returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[Worker] COMMISSION completed: order=${order_id}, commissions=${result.commissions?.length ?? 0}`);
}

/**
 * 处理 AI 对话奖励事件
 *
 * 调用 ai-add-bonus Edge Function，增加用户的 AI 对话配额。
 * ai-add-bonus 内部会:
 *   1. 获取或创建今日的 ai_chat_quota 记录
 *   2. 原子性地增加 bonus_quota
 *
 * 注意: 在 group-buy-squad v2 中，我们将 groupSize 次调用合并为一次，
 * 总量 = groupSize × 10。这减少了网络调用次数。
 *
 * @param event - 队列事件，payload 包含 { user_id, amount, reason }
 */
async function handleAiReward(event: QueuedEvent): Promise<void> {
  const { user_id, amount, reason } = event.payload as any;

  console.log(`[Worker] Processing AI_REWARD: user=${user_id}, amount=${amount}, reason=${reason}`);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-add-bonus`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id, amount, reason }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ai-add-bonus returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[Worker] AI_REWARD completed: user=${user_id}, amount=${amount}`);
}

/**
 * 处理首次拼团奖励事件
 *
 * 调用 handle-first-group-buy-reward Edge Function，给邀请人增加 2 次抽奖机会。
 * handle-first-group-buy-reward 内部会:
 *   1. 检查用户是否有邀请人
 *   2. 检查是否已发放过首次拼团奖励（防重复）
 *   3. 检查是否确实是首次拼团
 *   4. 给邀请人增加 2 次抽奖机会
 *   5. 记录邀请奖励
 *
 * @param event - 队列事件，payload 包含 { user_id, order_id }
 */
async function handleFirstGroupBuy(event: QueuedEvent): Promise<void> {
  const { user_id, order_id } = event.payload as any;

  console.log(`[Worker] Processing FIRST_GROUP_BUY: user=${user_id}, order=${order_id}`);

  // 使用 Supabase client 的 functions.invoke 方式调用
  // （与原 group-buy-squad v1 的调用方式保持一致）
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supabase.functions.invoke('handle-first-group-buy-reward', {
    body: { user_id, order_id },
  });

  if (error) {
    throw new Error(`handle-first-group-buy-reward error: ${error.message}`);
  }

  console.log(
    `[Worker] FIRST_GROUP_BUY completed: user=${user_id}, is_first=${data?.is_first_group_buy}, inviter_rewarded=${data?.inviter_rewarded}`,
  );
}

/**
 * 处理中奖通知事件
 *
 * 直接写入 notification_queue 表（与原 group-buy-squad v1 的逻辑完全一致）。
 * notification_queue 表中的记录会被 telegram-notification-sender 消费并发送。
 *
 * 幂等性: 通过 event_queue 的 idempotency_key 保证不会重复写入。
 * 额外保护: 写入前检查 notification_queue 中是否已存在相同的通知。
 *
 * @param event - 队列事件，payload 包含通知的完整数据
 */
async function handleNotification(event: QueuedEvent): Promise<void> {
  const payload = event.payload as any;
  const { user_id, type, product_name, session_code, won_at, is_squad_buy } = payload;

  console.log(`[Worker] Processing NOTIFICATION: user=${user_id}, type=${type}`);

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date();

  // 防重复: 检查是否已经为该 session 发送过通知
  // 使用 session_code 作为唯一标识（因为 notification_queue 没有 idempotency_key）
  const { data: existingNotification } = await supabase
    .from('notification_queue')
    .select('id')
    .eq('user_id', user_id)
    .eq('type', 'group_buy_win')
    .contains('payload', { session_code })
    .maybeSingle();

  if (existingNotification) {
    console.log(`[Worker] NOTIFICATION already exists for session_code=${session_code}, skipping`);
    return;
  }

  // 写入 notification_queue（与原 v1 代码完全一致）
  const { error } = await supabase.from('notification_queue').insert({
    user_id: user_id,
    type: 'group_buy_win',
    payload: {
      product_name,
      session_code,
      won_at,
      is_squad_buy,
    },
    telegram_chat_id: null,
    notification_type: 'group_buy_win',
    title: '包团成功通知',
    message: '',
    data: {
      product_name,
      session_code,
      won_at,
      is_squad_buy,
    },
    priority: 1,
    status: 'pending',
    scheduled_at: now.toISOString(),
    retry_count: 0,
    max_retries: 3,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });

  if (error) {
    throw new Error(`Failed to insert notification: ${error.message}`);
  }

  console.log(`[Worker] NOTIFICATION completed: user=${user_id}, session_code=${session_code}`);
}

// ============================================================================
// 事件路由器
// ============================================================================

/**
 * 根据事件类型路由到对应的处理函数
 *
 * 扩展方式: 新增事件类型时，只需:
 *   1. 在 _shared/eventQueue.ts 中添加 EventType 枚举值
 *   2. 在此处添加对应的 case 分支和处理函数
 *
 * @param event - 待处理的队列事件
 */
async function routeEvent(event: QueuedEvent): Promise<void> {
  switch (event.event_type) {
    case EventType.COMMISSION:
      await handleCommission(event);
      break;

    case EventType.AI_REWARD:
      await handleAiReward(event);
      break;

    case EventType.FIRST_GROUP_BUY:
      await handleFirstGroupBuy(event);
      break;

    case EventType.NOTIFICATION:
      await handleNotification(event);
      break;

    default:
      // 未知的事件类型：记录警告但不抛出异常
      // 这样可以避免因为新增了事件类型但 Worker 未更新而导致事件卡在队列中
      console.warn(`[Worker] Unknown event type: ${event.event_type}, marking as completed`);
      break;
  }
}

// ============================================================================
// 主请求处理
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const workerId = `worker-${startTime}-${Math.random().toString(36).substring(2, 8)}`;

  console.log(`[Worker] Starting event processing (worker: ${workerId})`);

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ----------------------------------------
    // 步骤 1: 释放超时的锁
    // 如果某个 Worker 在处理事件时崩溃，事件会一直处于 processing 状态。
    // 这里释放超过 5 分钟的锁，使事件可以被重新处理。
    // ----------------------------------------
    const releasedCount = await releaseStaleEvents(supabase, 5);
    if (releasedCount > 0) {
      console.log(`[Worker] Released ${releasedCount} stale events`);
    }

    // ----------------------------------------
    // 步骤 2: 从队列中取出待处理的事件
    // 每次最多处理 10 个事件，避免单次执行时间过长
    // （Supabase Edge Functions 有 60 秒的执行时间限制）
    // ----------------------------------------
    const events = await dequeueEvents(supabase, 10, workerId);

    if (events.length === 0) {
      console.log(`[Worker] No pending events found`);
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: 'No pending events',
        }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    console.log(`[Worker] Dequeued ${events.length} events for processing`);

    // ----------------------------------------
    // 步骤 3: 逐个处理事件
    // 使用 try-catch 确保单个事件的失败不会影响其他事件
    // ----------------------------------------
    let successCount = 0;
    let failCount = 0;
    const results: Array<{ id: string; type: string; status: string; error?: string }> = [];

    for (const event of events) {
      try {
        console.log(
          `[Worker] Processing event ${event.id}: type=${event.event_type}, retry=${event.retry_count}/${event.max_retries}`,
        );

        // 调用事件路由器
        await routeEvent(event);

        // 标记为完成
        await markEventCompleted(supabase, event.id);
        successCount++;
        results.push({ id: event.id, type: event.event_type, status: 'completed' });
      } catch (err: any) {
        console.error(`[Worker] Event ${event.id} (${event.event_type}) failed:`, err.message);

        // 标记为失败（内部会决定是重试还是转入死信队列）
        await markEventFailed(supabase, event, err.message);
        failCount++;
        results.push({
          id: event.id,
          type: event.event_type,
          status: 'failed',
          error: err.message,
        });
      }
    }

    // ----------------------------------------
    // 步骤 4: 返回处理结果
    // ----------------------------------------
    const duration = Date.now() - startTime;
    console.log(
      `[Worker] ✅ Processing complete: ${successCount} succeeded, ${failCount} failed, ${duration}ms`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        worker_id: workerId,
        processed: events.length,
        succeeded: successCount,
        failed: failCount,
        duration_ms: duration,
        results,
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error(`[Worker] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
});
