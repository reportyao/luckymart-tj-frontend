-- ============================================================
-- TezBarakat 管理后台通知系统 - 数据库迁移脚本
-- 创建日期: 2026-02-03
-- 说明: 创建管理员通知渠道、订阅关系、消息队列和日志表
-- ============================================================

-- 1. 管理员通知渠道配置表
-- 存储飞书、Telegram等通知渠道的配置信息
CREATE TABLE IF NOT EXISTS admin_notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,                    -- 渠道名称，如 "财务审核飞书群"
  channel_type VARCHAR(50) NOT NULL,             -- 渠道类型: 'feishu', 'telegram', 'dingtalk', 'email'
  webhook_url TEXT,                              -- 飞书/钉钉的 Webhook URL
  chat_id TEXT,                                  -- Telegram 的 Chat ID
  bot_token TEXT,                                -- Telegram Bot Token (加密存储)
  email_address TEXT,                            -- Email 地址
  is_active BOOLEAN DEFAULT TRUE,                -- 是否启用
  description TEXT,                              -- 渠道描述
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE admin_notification_channels IS '管理员通知渠道配置表';
COMMENT ON COLUMN admin_notification_channels.channel_type IS '渠道类型: feishu, telegram, dingtalk, email';
COMMENT ON COLUMN admin_notification_channels.webhook_url IS '飞书/钉钉的 Webhook URL';

-- 2. 管理员通知订阅关系表
-- 定义哪些事件发送到哪些渠道
CREATE TABLE IF NOT EXISTS admin_notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,              -- 事件类型，如 'new_deposit_request'
  channel_id UUID REFERENCES admin_notification_channels(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,                -- 是否启用该订阅
  priority INTEGER DEFAULT 2,                    -- 优先级: 1=高, 2=中, 3=低
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_type, channel_id)                -- 防止重复订阅
);

COMMENT ON TABLE admin_notification_subscriptions IS '管理员通知订阅关系表';
COMMENT ON COLUMN admin_notification_subscriptions.event_type IS '事件类型: new_deposit_request, new_withdrawal_request, new_group_buy_join, new_lottery_purchase';

-- 3. 管理员通知消息队列表
-- 持久化存储待发送的通知，确保消息不丢失
CREATE TABLE IF NOT EXISTS admin_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,              -- 事件类型
  event_data JSONB NOT NULL DEFAULT '{}',        -- 事件原始数据
  formatted_message TEXT,                        -- 格式化后的消息内容
  status VARCHAR(50) DEFAULT 'pending',          -- 状态: pending, processing, sent, failed
  retry_count INTEGER DEFAULT 0,                 -- 重试次数
  max_retries INTEGER DEFAULT 3,                 -- 最大重试次数
  error_message TEXT,                            -- 错误信息
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),        -- 计划发送时间
  processed_at TIMESTAMPTZ,                      -- 处理时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE admin_notification_queue IS '管理员通知消息队列表';
COMMENT ON COLUMN admin_notification_queue.status IS '状态: pending=待处理, processing=处理中, sent=已发送, failed=失败';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_admin_notification_queue_status ON admin_notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_admin_notification_queue_scheduled_at ON admin_notification_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_admin_notification_queue_event_type ON admin_notification_queue(event_type);

-- 4. 管理员通知发送日志表
-- 记录每一条通知的发送历史，用于审计和调试
CREATE TABLE IF NOT EXISTS admin_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES admin_notification_queue(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES admin_notification_channels(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  channel_type VARCHAR(50),                      -- 冗余存储，便于查询
  channel_name VARCHAR(255),                     -- 冗余存储，便于查询
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,                   -- 'success', 'failed'
  error_message TEXT,
  response_data JSONB,                           -- 第三方API返回的响应
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE admin_notification_logs IS '管理员通知发送日志表';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_admin_notification_logs_event_type ON admin_notification_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_notification_logs_status ON admin_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_admin_notification_logs_sent_at ON admin_notification_logs(sent_at);

-- 5. 开启行级安全 (RLS)
ALTER TABLE admin_notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_logs ENABLE ROW LEVEL SECURITY;

-- 6. 创建 RLS 策略 - 只允许 service_role 访问
CREATE POLICY "service_role_admin_notification_channels" ON admin_notification_channels
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_admin_notification_subscriptions" ON admin_notification_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_admin_notification_queue" ON admin_notification_queue
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_admin_notification_logs" ON admin_notification_logs
  FOR ALL USING (auth.role() = 'service_role');

-- 7. 创建更新时间触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 为相关表添加更新时间触发器
DROP TRIGGER IF EXISTS update_admin_notification_channels_updated_at ON admin_notification_channels;
CREATE TRIGGER update_admin_notification_channels_updated_at
  BEFORE UPDATE ON admin_notification_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_notification_queue_updated_at ON admin_notification_queue;
CREATE TRIGGER update_admin_notification_queue_updated_at
  BEFORE UPDATE ON admin_notification_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 迁移完成
-- ============================================================
