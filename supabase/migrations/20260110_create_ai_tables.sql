-- AI 功能数据库迁移脚本
-- 创建时间: 2026-01-10

-- 1. 创建 AI 对话配额表
CREATE TABLE IF NOT EXISTS ai_chat_quota (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  base_quota INTEGER NOT NULL DEFAULT 10,
  bonus_quota INTEGER NOT NULL DEFAULT 0,
  used_quota INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 2. 创建 AI 对话历史表
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  response_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_chat_quota_user_date ON ai_chat_quota(user_id, date);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user_created ON ai_chat_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_blocked ON ai_chat_history(is_blocked) WHERE is_blocked = TRUE;

-- 4. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_ai_chat_quota_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_chat_quota_updated_at ON ai_chat_quota;
CREATE TRIGGER trigger_update_ai_chat_quota_updated_at
  BEFORE UPDATE ON ai_chat_quota
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_chat_quota_updated_at();

-- 5. 创建增加已用配额的 RPC 函数
CREATE OR REPLACE FUNCTION increment_ai_quota_used(p_user_id TEXT, p_date DATE)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_chat_quota
  SET used_quota = used_quota + 1
  WHERE user_id = p_user_id AND date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 创建增加奖励配额的 RPC 函数
CREATE OR REPLACE FUNCTION increment_ai_quota_bonus(p_user_id TEXT, p_date DATE, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_chat_quota
  SET bonus_quota = bonus_quota + p_amount
  WHERE user_id = p_user_id AND date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 启用 RLS
ALTER TABLE ai_chat_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

-- 8. 创建 RLS 策略 (用户只能访问自己的数据)
DROP POLICY IF EXISTS "Users can view own quota" ON ai_chat_quota;
CREATE POLICY "Users can view own quota" ON ai_chat_quota
  FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own history" ON ai_chat_history;
CREATE POLICY "Users can view own history" ON ai_chat_history
  FOR SELECT USING (auth.uid()::text = user_id);

-- 9. 授予 service_role 完全访问权限
GRANT ALL ON ai_chat_quota TO service_role;
GRANT ALL ON ai_chat_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ai_chat_quota_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ai_chat_history_id_seq TO service_role;

-- 10. 添加注释
COMMENT ON TABLE ai_chat_quota IS 'AI 对话次数配额表，记录每个用户每天的对话次数';
COMMENT ON TABLE ai_chat_history IS 'AI 对话历史记录表，记录所有对话内容用于审计和优化';
COMMENT ON COLUMN ai_chat_quota.base_quota IS '每日基础额度，默认10次';
COMMENT ON COLUMN ai_chat_quota.bonus_quota IS '奖励额度，通过邀请或拼团获得';
COMMENT ON COLUMN ai_chat_quota.used_quota IS '已使用次数';
COMMENT ON COLUMN ai_chat_history.is_blocked IS '是否被敏感词拦截';
COMMENT ON COLUMN ai_chat_history.response_time IS '响应时间(毫秒)';
