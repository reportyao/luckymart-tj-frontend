-- ============================================================================
-- 迁移脚本: 创建异步事件队列基础设施
-- 日期: 2026-02-09
-- 目的: 为 group-buy-squad 的后端逻辑解耦提供事件队列支持
-- 
-- 设计原则:
--   1. 通用性: event_queue 表设计为全局可复用，不仅限于 squad-buy 场景
--   2. 幂等性: 通过 idempotency_key 字段确保同一事件不会被重复处理
--   3. 可追溯: 完整的状态流转记录和错误日志
--   4. 可恢复: dead_letter_queue 存储处理失败的事件，支持人工重试
--
-- 表说明:
--   - event_queue: 主事件队列，存储待处理的异步事件
--   - dead_letter_queue: 死信队列，存储多次重试仍失败的事件
-- ============================================================================

-- ============================================================================
-- 1. 创建事件队列主表 (event_queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_queue (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 事件分类
  -- event_type 定义事件的业务类型，用于 Worker 路由到对应的处理逻辑
  -- 当前支持的类型:
  --   'COMMISSION'          - 推荐佣金处理
  --   'AI_REWARD'           - AI 对话奖励
  --   'FIRST_GROUP_BUY'     - 首次拼团奖励
  --   'NOTIFICATION'        - 中奖通知
  -- 未来可扩展:
  --   'LOTTERY_COMMISSION'  - 彩票购买佣金
  --   'SPIN_AI_REWARD'      - 转盘抽奖 AI 奖励
  event_type VARCHAR(100) NOT NULL,

  -- 事件来源
  -- 标识是哪个 Edge Function 产生的事件，便于追溯和调试
  -- 例如: 'group-buy-squad', 'group-buy-join', 'lottery-purchase'
  source VARCHAR(100) NOT NULL,

  -- 事件负载
  -- JSON 格式的业务数据，不同 event_type 有不同的 payload 结构
  -- COMMISSION payload 示例:
  --   { "order_id": "uuid", "user_id": "uuid", "order_amount": 10.00 }
  -- AI_REWARD payload 示例:
  --   { "user_id": "uuid", "amount": 10, "reason": "group_buy_participation" }
  -- FIRST_GROUP_BUY payload 示例:
  --   { "user_id": "uuid", "order_id": "uuid" }
  -- NOTIFICATION payload 示例:
  --   { "user_id": "uuid", "type": "group_buy_win", "product_name": "...", ... }
  payload JSONB NOT NULL DEFAULT '{}',

  -- 幂等键
  -- 由 source + event_type + 业务唯一标识 组合而成
  -- 用于防止同一事件被重复写入队列
  -- 例如: "squad:COMMISSION:order_abc123"
  -- 注意: 使用 UNIQUE 约束确保幂等性
  idempotency_key VARCHAR(500) UNIQUE,

  -- 处理状态
  -- 状态流转: pending -> processing -> completed / failed
  -- 如果 failed 且 retry_count >= max_retries，则转入 dead_letter_queue
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- 重试机制
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,

  -- 错误信息
  -- 最近一次处理失败的错误消息，用于调试
  last_error TEXT,

  -- 处理锁
  -- Worker 开始处理时设置，防止多个 Worker 同时处理同一事件
  -- 使用 "SELECT ... WHERE locked_by IS NULL FOR UPDATE SKIP LOCKED" 模式
  locked_by VARCHAR(100),
  locked_at TIMESTAMPTZ,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  -- 计划处理时间（支持延迟执行，默认立即执行）
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 关联信息（可选，便于查询和调试）
  -- 关联的会话 ID（如 group_buy_sessions.id）
  session_id UUID,
  -- 关联的用户 ID
  user_id UUID
);

-- ============================================================================
-- 2. 创建索引
-- 索引设计说明:
--   - idx_event_queue_pending: Worker 消费时的核心查询索引
--     查询模式: WHERE status='pending' AND scheduled_at <= NOW() ORDER BY created_at
--   - idx_event_queue_idempotency: 幂等性检查的唯一索引（已由 UNIQUE 约束创建）
--   - idx_event_queue_source: 按来源查询，用于监控和调试
--   - idx_event_queue_session: 按会话查询，用于查看某次包团的所有事件
--   - idx_event_queue_status_type: 按状态和类型组合查询，用于监控面板
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_event_queue_pending 
  ON event_queue (status, scheduled_at, created_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_event_queue_processing 
  ON event_queue (status, locked_at) 
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_event_queue_source 
  ON event_queue (source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_queue_session 
  ON event_queue (session_id) 
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_queue_status_type 
  ON event_queue (status, event_type);

CREATE INDEX IF NOT EXISTS idx_event_queue_user 
  ON event_queue (user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- 3. 创建死信队列表 (dead_letter_queue)
-- 当事件在 event_queue 中多次重试仍然失败时，转入此表
-- 死信队列中的事件需要人工介入排查和重试
-- ============================================================================
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 原始事件信息（从 event_queue 复制）
  original_event_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  source VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  idempotency_key VARCHAR(500),

  -- 失败信息
  -- 记录所有重试的错误历史，便于排查
  error_history JSONB NOT NULL DEFAULT '[]',
  -- 最终的错误消息
  final_error TEXT,
  -- 总共重试了多少次
  total_retries INTEGER NOT NULL DEFAULT 0,

  -- 恢复状态
  -- 'unresolved' - 待处理
  -- 'retrying'   - 正在重试
  -- 'resolved'   - 已解决（人工确认或重试成功）
  -- 'ignored'    - 已忽略（人工确认不需要处理）
  resolution_status VARCHAR(20) NOT NULL DEFAULT 'unresolved'
    CHECK (resolution_status IN ('unresolved', 'retrying', 'resolved', 'ignored')),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,

  -- 关联信息
  session_id UUID,
  user_id UUID,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 死信队列索引
CREATE INDEX IF NOT EXISTS idx_dead_letter_unresolved 
  ON dead_letter_queue (resolution_status, created_at DESC) 
  WHERE resolution_status = 'unresolved';

CREATE INDEX IF NOT EXISTS idx_dead_letter_event_type 
  ON dead_letter_queue (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_original_event 
  ON dead_letter_queue (original_event_id);

-- ============================================================================
-- 4. 添加表注释
-- ============================================================================
COMMENT ON TABLE event_queue IS '异步事件队列 - 用于解耦 Edge Functions 中的非核心业务逻辑（如佣金、奖励、通知），支持重试和幂等性';
COMMENT ON TABLE dead_letter_queue IS '死信队列 - 存储多次重试仍失败的事件，需要人工介入处理';

COMMENT ON COLUMN event_queue.event_type IS '事件类型: COMMISSION, AI_REWARD, FIRST_GROUP_BUY, NOTIFICATION 等';
COMMENT ON COLUMN event_queue.source IS '事件来源: 产生该事件的 Edge Function 名称';
COMMENT ON COLUMN event_queue.payload IS '事件负载: JSON 格式的业务数据';
COMMENT ON COLUMN event_queue.idempotency_key IS '幂等键: 确保同一事件不被重复处理，格式为 source:type:business_id';
COMMENT ON COLUMN event_queue.status IS '处理状态: pending(待处理) -> processing(处理中) -> completed(完成) / failed(失败)';
COMMENT ON COLUMN event_queue.locked_by IS '处理锁: Worker 实例标识，防止并发处理';
COMMENT ON COLUMN event_queue.scheduled_at IS '计划处理时间: 支持延迟执行，默认立即执行';

-- ============================================================================
-- 5. 创建自动更新 updated_at 的触发器函数（如果不存在）
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 event_queue 创建 updated_at 自动更新触发器
DROP TRIGGER IF EXISTS trigger_event_queue_updated_at ON event_queue;
CREATE TRIGGER trigger_event_queue_updated_at
  BEFORE UPDATE ON event_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 dead_letter_queue 创建 updated_at 自动更新触发器
DROP TRIGGER IF EXISTS trigger_dead_letter_queue_updated_at ON dead_letter_queue;
CREATE TRIGGER trigger_dead_letter_queue_updated_at
  BEFORE UPDATE ON dead_letter_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. 设置 RLS (Row Level Security) 策略
-- event_queue 和 dead_letter_queue 只允许 service_role 访问
-- 普通用户不应该直接操作这些表
-- ============================================================================
ALTER TABLE event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- 允许 service_role 完全访问（Edge Functions 使用 service_role key）
CREATE POLICY "Service role full access on event_queue" 
  ON event_queue FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on dead_letter_queue" 
  ON dead_letter_queue FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 7. 创建清理过期已完成事件的函数
-- 建议通过 pg_cron 定期调用，清理 7 天前已完成的事件
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_completed_events(retention_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM event_queue 
  WHERE status = 'completed' 
    AND processed_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % completed events older than % days', deleted_count, retention_days;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_completed_events IS '清理已完成的事件记录，默认保留 7 天';
