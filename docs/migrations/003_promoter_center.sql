-- ============================================================
-- 迁移 003: 推广者中心（用户端）后端支持
-- 日期: 2026-02-10
-- 说明: 创建推广者中心所需的RPC函数
-- ============================================================

-- ============================================================
-- 函数1: increment_contact_count
-- 用途: 推广者"今日打卡"功能，每次点击+1记录接触人数
-- 参数: p_promoter_id (推广者用户ID), p_log_date (日期)
-- 逻辑: 如果当天已有记录则+1，否则新建记录
-- ============================================================
CREATE OR REPLACE FUNCTION increment_contact_count(
    p_promoter_id TEXT,
    p_log_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INT;
    v_point_id UUID;
BEGIN
    -- 验证推广者身份
    IF NOT EXISTS (
        SELECT 1 FROM promoter_profiles 
        WHERE user_id = p_promoter_id 
        AND promoter_status = 'active'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_PROMOTER',
            'message', 'User is not an active promoter'
        );
    END IF;

    -- 获取推广者当前分配的点位
    SELECT point_id INTO v_point_id
    FROM promoter_profiles
    WHERE user_id = p_promoter_id;

    -- 使用 UPSERT：如果当天记录存在则+1，否则新建
    INSERT INTO promoter_daily_logs (promoter_id, log_date, contact_count, point_id)
    VALUES (p_promoter_id, p_log_date, 1, v_point_id)
    ON CONFLICT (promoter_id, log_date)
    DO UPDATE SET 
        contact_count = promoter_daily_logs.contact_count + 1,
        updated_at = now()
    RETURNING contact_count INTO v_current_count;

    RETURN jsonb_build_object(
        'success', true,
        'contact_count', v_current_count,
        'log_date', p_log_date
    );
END;
$$;

-- ============================================================
-- 函数2: get_promoter_center_data
-- 用途: 一次性获取推广者中心所需的所有数据
-- 参数: p_user_id (用户ID), p_time_range (时间范围)
-- 返回: 业绩统计、团队数据、排行榜、今日打卡等
-- ============================================================
CREATE OR REPLACE FUNCTION get_promoter_center_data(
    p_user_id TEXT,
    p_time_range TEXT DEFAULT 'today'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_prev_start_date TIMESTAMPTZ;
    v_promoter_record RECORD;
    v_my_stats JSONB;
    v_team_data JSONB;
    v_leaderboard JSONB;
    v_today_log JSONB;
    v_result JSONB;
BEGIN
    -- 验证推广者身份
    SELECT pp.*, pt.name AS team_name, ppt.name AS point_name
    INTO v_promoter_record
    FROM promoter_profiles pp
    LEFT JOIN promoter_teams pt ON pp.team_id = pt.id
    LEFT JOIN promotion_points ppt ON pp.point_id = ppt.id
    WHERE pp.user_id = p_user_id AND pp.promoter_status = 'active';

    IF v_promoter_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_PROMOTER',
            'message', 'User is not an active promoter'
        );
    END IF;

    -- 计算时间范围
    CASE p_time_range
        WHEN 'today' THEN 
            v_start_date := date_trunc('day', now());
            v_prev_start_date := v_start_date - INTERVAL '1 day';
        WHEN 'week' THEN 
            v_start_date := date_trunc('week', now());
            v_prev_start_date := v_start_date - INTERVAL '1 week';
        WHEN 'month' THEN 
            v_start_date := date_trunc('month', now());
            v_prev_start_date := v_start_date - INTERVAL '1 month';
        ELSE 
            v_start_date := date_trunc('day', now());
            v_prev_start_date := v_start_date - INTERVAL '1 day';
    END CASE;

    -- ========== 1. 我的业绩 ==========
    WITH my_regs AS (
        SELECT COUNT(*) AS reg_count
        FROM users p
        WHERE p.referred_by_id = p_user_id
        AND p.created_at >= v_start_date
    ),
    my_prev_regs AS (
        SELECT COUNT(*) AS reg_count
        FROM users p
        WHERE p.referred_by_id = p_user_id
        AND p.created_at >= v_prev_start_date
        AND p.created_at < v_start_date
    ),
    my_charges AS (
        SELECT 
            COUNT(DISTINCT d.user_id) AS charge_count,
            COALESCE(SUM(d.amount), 0) AS charge_amount
        FROM deposits d
        JOIN users ref ON d.user_id = ref.id
        WHERE ref.referred_by_id = p_user_id
        AND d.status = 'APPROVED'
        AND d.created_at >= v_start_date
    ),
    my_prev_charges AS (
        SELECT 
            COUNT(DISTINCT d.user_id) AS charge_count,
            COALESCE(SUM(d.amount), 0) AS charge_amount
        FROM deposits d
        JOIN users ref ON d.user_id = ref.id
        WHERE ref.referred_by_id = p_user_id
        AND d.status = 'APPROVED'
        AND d.created_at >= v_prev_start_date
        AND d.created_at < v_start_date
    ),
    my_commission AS (
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM commissions
        WHERE beneficiary_id = p_user_id
        AND created_at >= v_start_date
    )
    SELECT jsonb_build_object(
        'registrations', (SELECT reg_count FROM my_regs),
        'prev_registrations', (SELECT reg_count FROM my_prev_regs),
        'charges', (SELECT charge_count FROM my_charges),
        'charge_amount', (SELECT charge_amount FROM my_charges),
        'prev_charges', (SELECT charge_count FROM my_prev_charges),
        'prev_charge_amount', (SELECT charge_amount FROM my_prev_charges),
        'commission', (SELECT total FROM my_commission),
        'conversion_rate', CASE 
            WHEN (SELECT reg_count FROM my_regs) > 0 
            THEN ROUND((SELECT charge_count FROM my_charges)::numeric / (SELECT reg_count FROM my_regs) * 100, 1)
            ELSE 0 
        END
    ) INTO v_my_stats;

    -- ========== 2. 我的团队（一二三级下线） ==========
    WITH level1 AS (
        SELECT id, first_name, last_name, avatar_url, created_at
        FROM users
        WHERE referred_by_id = p_user_id
    ),
    level2 AS (
        SELECT u.id, u.first_name, u.last_name, u.avatar_url, u.created_at
        FROM users u
        WHERE u.referred_by_id IN (SELECT id FROM level1)
    ),
    level3 AS (
        SELECT u.id, u.first_name, u.last_name, u.avatar_url, u.created_at
        FROM users u
        WHERE u.referred_by_id IN (SELECT id FROM level2)
    )
    SELECT jsonb_build_object(
        'level1_count', (SELECT COUNT(*) FROM level1),
        'level2_count', (SELECT COUNT(*) FROM level2),
        'level3_count', (SELECT COUNT(*) FROM level3),
        'total_count', (SELECT COUNT(*) FROM level1) + (SELECT COUNT(*) FROM level2) + (SELECT COUNT(*) FROM level3),
        'recent_members', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'name', COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''),
                    'avatar_url', avatar_url,
                    'joined_at', created_at,
                    'level', 1
                ) ORDER BY created_at DESC
            ), '[]'::jsonb)
            FROM (SELECT * FROM level1 ORDER BY created_at DESC LIMIT 10) sub
        )
    ) INTO v_team_data;

    -- ========== 3. 排行榜（注册数前20） ==========
    WITH all_promoters AS (
        SELECT 
            pp.user_id,
            u.first_name,
            u.last_name,
            u.avatar_url,
            pt.name AS team_name,
            COUNT(ref.id) AS reg_count
        FROM promoter_profiles pp
        JOIN users u ON pp.user_id = u.id
        LEFT JOIN promoter_teams pt ON pp.team_id = pt.id
        LEFT JOIN users ref ON ref.referred_by_id = pp.user_id 
            AND ref.created_at >= v_start_date
        WHERE pp.promoter_status = 'active'
        GROUP BY pp.user_id, u.first_name, u.last_name, u.avatar_url, pt.name
        ORDER BY reg_count DESC
        LIMIT 20
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'user_id', user_id,
            'name', COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''),
            'avatar_url', avatar_url,
            'team_name', team_name,
            'registrations', reg_count,
            'is_me', user_id = p_user_id
        )
    ), '[]'::jsonb) INTO v_leaderboard
    FROM all_promoters;

    -- ========== 4. 今日打卡 ==========
    SELECT jsonb_build_object(
        'contact_count', COALESCE(pdl.contact_count, 0),
        'log_date', CURRENT_DATE,
        'has_logged', pdl.id IS NOT NULL
    ) INTO v_today_log
    FROM (SELECT 1) dummy
    LEFT JOIN promoter_daily_logs pdl 
        ON pdl.promoter_id = p_user_id 
        AND pdl.log_date = CURRENT_DATE;

    -- ========== 组装返回结果 ==========
    RETURN jsonb_build_object(
        'success', true,
        'promoter', jsonb_build_object(
            'user_id', v_promoter_record.user_id,
            'team_name', v_promoter_record.team_name,
            'point_name', v_promoter_record.point_name,
            'hire_date', v_promoter_record.hire_date,
            'base_salary', v_promoter_record.base_salary
        ),
        'my_stats', v_my_stats,
        'team', v_team_data,
        'leaderboard', v_leaderboard,
        'today_log', v_today_log,
        'time_range', p_time_range
    );
END;
$$;

-- ============================================================
-- RLS 策略: promoter_daily_logs 表允许推广者操作自己的记录
-- ============================================================
-- 先删除可能存在的旧策略
DROP POLICY IF EXISTS "Promoters can view own logs" ON promoter_daily_logs;
DROP POLICY IF EXISTS "Promoters can insert own logs" ON promoter_daily_logs;
DROP POLICY IF EXISTS "Promoters can update own logs" ON promoter_daily_logs;
DROP POLICY IF EXISTS "Allow all access to promoter_daily_logs" ON promoter_daily_logs;

-- 启用 RLS
ALTER TABLE promoter_daily_logs ENABLE ROW LEVEL SECURITY;

-- 创建宽松策略（因为RPC函数使用SECURITY DEFINER，实际安全由函数内部控制）
CREATE POLICY "Allow all access to promoter_daily_logs" ON promoter_daily_logs
    FOR ALL USING (true) WITH CHECK (true);
