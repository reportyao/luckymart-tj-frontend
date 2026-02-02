-- =====================================================
-- 运营晒单功能数据库迁移
-- 创建日期: 2026-02-02
-- 功能描述: 为 showoffs 表添加运营晒单所需的字段
-- =====================================================

-- 1. 添加虚拟用户展示字段
-- display_username: 运营晒单的虚拟用户昵称
-- display_avatar_url: 运营晒单的虚拟用户头像URL
ALTER TABLE public.showoffs
ADD COLUMN IF NOT EXISTS display_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS display_avatar_url TEXT;

-- 2. 添加来源标识字段
-- source: 标识晒单来源，'USER' 表示真实用户创建，'ADMIN' 表示管理员运营创建
ALTER TABLE public.showoffs
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'USER';

-- 3. 添加晒单标题字段 (用于运营晒单自定义标题，真实晒单可从关联商品获取)
ALTER TABLE public.showoffs
ADD COLUMN IF NOT EXISTS title TEXT;

-- 4. 添加 image_urls 字段 (兼容前端展示逻辑，与 images 字段功能相同)
-- 注意: 前端 ShowoffPage.tsx 使用 image_urls 字段，而数据库中是 images 字段
-- 我们通过视图或在查询时处理这个映射，这里不重复添加

-- 5. 为 source 字段添加索引，便于后续筛选运营晒单
CREATE INDEX IF NOT EXISTS idx_showoffs_source ON public.showoffs(source);

-- 6. 添加注释说明字段用途
COMMENT ON COLUMN public.showoffs.display_username IS '运营晒单的虚拟用户昵称，仅当 source=ADMIN 时使用';
COMMENT ON COLUMN public.showoffs.display_avatar_url IS '运营晒单的虚拟用户头像URL，仅当 source=ADMIN 时使用';
COMMENT ON COLUMN public.showoffs.source IS '晒单来源: USER=真实用户创建, ADMIN=管理员运营创建';
COMMENT ON COLUMN public.showoffs.title IS '晒单标题，运营晒单可自定义，真实晒单可从关联商品获取';

-- 7. 确保 lottery_id 字段允许为空 (运营晒单可以不关联商品)
-- 根据现有结构，lottery_id 已经是 nullable，无需修改

-- 8. 确保 user_id 字段允许为空 (运营晒单没有真实用户)
-- 根据现有结构，user_id 已经是 nullable，无需修改

-- 验证迁移结果
DO $$
BEGIN
  RAISE NOTICE '运营晒单功能数据库迁移完成';
  RAISE NOTICE '新增字段: display_username, display_avatar_url, source, title';
END $$;
