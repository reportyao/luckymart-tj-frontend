-- ============================================================
-- 增强操作日志系统
-- 1. 为 admin_audit_logs 添加缺失字段
-- 2. 创建 Edge Function 操作日志表
-- 3. 创建统一的日志写入 RPC 函数
-- 4. 创建索引以支持高效查询
-- ============================================================

-- ============================================================
-- 1. 增强 admin_audit_logs 表
-- ============================================================

-- 添加 details 字段（JSONB，存储操作的详细上下文信息）
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS details jsonb;

-- 添加 source 字段（标识日志来源：admin_ui / edge_function / rpc / manual）
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS source text DEFAULT 'admin_ui';

-- 添加 status 字段（操作结果：success / failed / error）
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS status text DEFAULT 'success';

-- 添加 error_message 字段（操作失败时的错误信息）
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS error_message text;

-- 添加 duration_ms 字段（操作耗时，毫秒）
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS duration_ms integer;

-- ============================================================
-- 2. 创建 edge_function_logs 表（记录 Edge Function 的关键操作）
-- ============================================================

CREATE TABLE IF NOT EXISTS edge_function_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name text NOT NULL,
    action text NOT NULL,
    user_id text,
    target_type text,
    target_id text,
    request_body jsonb,
    response_status integer,
    details jsonb,
    status text DEFAULT 'success',
    error_message text,
    duration_ms integer,
    ip_address text,
    created_at timestamptz DEFAULT now()
);

-- 为 edge_function_logs 创建索引
CREATE INDEX IF NOT EXISTS idx_efl_function_name ON edge_function_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_efl_action ON edge_function_logs(action);
CREATE INDEX IF NOT EXISTS idx_efl_user_id ON edge_function_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_efl_created_at ON edge_function_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_efl_status ON edge_function_logs(status);

-- 为 admin_audit_logs 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_aal_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_aal_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_aal_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_target_type ON admin_audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_aal_source ON admin_audit_logs(source);

-- ============================================================
-- 3. 创建统一的日志写入 RPC 函数
-- ============================================================

-- 3.1 管理后台操作日志写入函数
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_id uuid,
    p_action text,
    p_target_type text DEFAULT NULL,
    p_target_id text DEFAULT NULL,
    p_old_data jsonb DEFAULT NULL,
    p_new_data jsonb DEFAULT NULL,
    p_details jsonb DEFAULT NULL,
    p_source text DEFAULT 'admin_ui',
    p_status text DEFAULT 'success',
    p_error_message text DEFAULT NULL,
    p_ip_address text DEFAULT NULL,
    p_user_agent text DEFAULT NULL,
    p_duration_ms integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO admin_audit_logs (
        admin_id, action, target_type, target_id,
        old_data, new_data, details, source,
        status, error_message, ip_address, user_agent,
        duration_ms, created_at
    ) VALUES (
        p_admin_id, p_action, p_target_type, p_target_id,
        p_old_data, p_new_data, p_details, p_source,
        p_status, p_error_message, p_ip_address, p_user_agent,
        p_duration_ms, now()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- 3.2 Edge Function 操作日志写入函数
CREATE OR REPLACE FUNCTION log_edge_function_action(
    p_function_name text,
    p_action text,
    p_user_id text DEFAULT NULL,
    p_target_type text DEFAULT NULL,
    p_target_id text DEFAULT NULL,
    p_request_body jsonb DEFAULT NULL,
    p_response_status integer DEFAULT NULL,
    p_details jsonb DEFAULT NULL,
    p_status text DEFAULT 'success',
    p_error_message text DEFAULT NULL,
    p_duration_ms integer DEFAULT NULL,
    p_ip_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO edge_function_logs (
        function_name, action, user_id, target_type, target_id,
        request_body, response_status, details, status,
        error_message, duration_ms, ip_address, created_at
    ) VALUES (
        p_function_name, p_action, p_user_id, p_target_type, p_target_id,
        p_request_body, p_response_status, p_details, p_status,
        p_error_message, p_duration_ms, p_ip_address, now()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- ============================================================
-- 4. 删除 admin-add-test-bonuses 相关的 RPC 函数（如果存在）
-- ============================================================
-- 注意：admin-add-test-bonuses Edge Function 已从代码库中删除
-- add_user_spin_count RPC 函数保留（被其他功能使用），但不再被测试函数调用

-- ============================================================
-- 5. 添加注释
-- ============================================================

COMMENT ON TABLE edge_function_logs IS 'Edge Function 操作日志表，记录所有关键 Edge Function 的调用和操作结果';
COMMENT ON FUNCTION log_admin_action IS '统一的管理后台操作日志写入函数';
COMMENT ON FUNCTION log_edge_function_action IS '统一的 Edge Function 操作日志写入函数';
