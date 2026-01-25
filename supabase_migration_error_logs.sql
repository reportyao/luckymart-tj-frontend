-- =====================================================
-- 错误日志表 - 用于收集前端错误和异常信息
-- =====================================================

-- 创建错误日志表
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 错误基本信息
    error_type VARCHAR(50) NOT NULL, -- JS_ERROR, API_ERROR, NETWORK_ERROR, UNHANDLED_REJECTION
    error_message TEXT NOT NULL,
    error_stack TEXT,
    
    -- 用户信息
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    telegram_id BIGINT,
    telegram_username VARCHAR(255),
    
    -- 页面上下文
    page_url TEXT,
    page_route VARCHAR(255),
    component_name VARCHAR(255),
    
    -- 操作上下文
    action_type VARCHAR(100), -- 触发错误的操作类型
    action_data JSONB, -- 操作相关数据（脱敏）
    user_actions JSONB, -- 最近的用户操作序列
    
    -- 设备信息
    user_agent TEXT,
    device_type VARCHAR(50), -- mobile, tablet, desktop
    device_model VARCHAR(100), -- 解析出的设备型号
    os_name VARCHAR(50),
    os_version VARCHAR(50),
    browser_name VARCHAR(50),
    browser_version VARCHAR(50),
    screen_width INTEGER,
    screen_height INTEGER,
    
    -- 网络和环境信息
    network_type VARCHAR(50), -- wifi, 4g, 3g, etc.
    app_version VARCHAR(50),
    is_telegram_mini_app BOOLEAN DEFAULT FALSE,
    telegram_platform VARCHAR(50), -- ios, android, web, etc.
    
    -- 地理位置（基于IP）
    ip_address INET,
    country VARCHAR(100),
    city VARCHAR(100),
    
    -- API错误特有字段
    api_endpoint VARCHAR(255),
    api_method VARCHAR(10),
    api_status_code INTEGER,
    api_response_body TEXT,
    
    -- 状态管理
    status VARCHAR(20) DEFAULT 'NEW', -- NEW, REVIEWING, RESOLVED, IGNORED
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
    admin_note TEXT,
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_status ON error_logs(status);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_page_route ON error_logs(page_route);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_error_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_error_logs_updated_at ON error_logs;
CREATE TRIGGER trigger_update_error_logs_updated_at
    BEFORE UPDATE ON error_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_error_logs_updated_at();

-- 启用 RLS
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
-- 允许匿名用户插入错误日志（用于错误上报）
CREATE POLICY "Allow anonymous insert" ON error_logs
    FOR INSERT
    WITH CHECK (true);

-- 允许 service_role 完全访问
CREATE POLICY "Allow service role full access" ON error_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- 添加注释
COMMENT ON TABLE error_logs IS '前端错误日志表，用于收集和监控用户遇到的异常';
COMMENT ON COLUMN error_logs.error_type IS '错误类型：JS_ERROR, API_ERROR, NETWORK_ERROR, UNHANDLED_REJECTION';
COMMENT ON COLUMN error_logs.status IS '处理状态：NEW-新建, REVIEWING-处理中, RESOLVED-已解决, IGNORED-已忽略';
