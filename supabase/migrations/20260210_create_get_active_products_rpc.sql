-- ============================================================
-- RPC函数: get_active_products_with_sessions
-- 功能: 将 group-buy-list 的 N+1 查询合并为单次 SQL
-- 
-- 原始逻辑:
--   1. 查询所有 ACTIVE 的 group_buy_products (1次查询)
--   2. 为每个商品查询活跃的 group_buy_sessions (N次查询)
--   总计: 1 + N 次查询 (当前 N=17)
--
-- 优化后: 使用子查询在单次 SQL 中完成所有数据获取
-- 
-- 返回格式: JSON数组, 每个元素包含商品所有字段 + active_sessions数组
-- 注意: 字段映射(mapProductToFrontend)仍在Edge Function中处理
-- ============================================================

CREATE OR REPLACE FUNCTION get_active_products_with_sessions()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'title_i18n', p.title_i18n,
        'description', p.description,
        'description_i18n', p.description_i18n,
        'image_url', p.image_url,
        'image_urls', p.image_urls,
        'original_price', p.original_price,
        'group_price', p.group_price,
        'min_participants', p.min_participants,
        'max_participants', p.max_participants,
        'duration_hours', p.duration_hours,
        'currency', p.currency,
        'group_size', p.group_size,
        'name', p.name,
        'name_i18n', p.name_i18n,
        'price_comparisons', p.price_comparisons,
        'price_per_person', p.price_per_person,
        'stock', p.stock,
        'status', p.status,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'active_sessions', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', s.id,
                'current_participants', s.current_participants,
                'group_size', s.group_size,
                'expires_at', s.expires_at
              )
            )
            FROM group_buy_sessions s
            WHERE s.product_id = p.id
              AND s.status = 'ACTIVE'
              AND s.expires_at > NOW()
          ),
          '[]'::jsonb
        )
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  FROM group_buy_products p
  WHERE p.status = 'ACTIVE';
$$;

-- 授权: 允许 anon 和 authenticated 角色调用
GRANT EXECUTE ON FUNCTION get_active_products_with_sessions() TO anon;
GRANT EXECUTE ON FUNCTION get_active_products_with_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_products_with_sessions() TO service_role;

-- 添加注释
COMMENT ON FUNCTION get_active_products_with_sessions() IS 
  '获取所有活跃的拼团商品及其活跃会话，合并N+1查询为单次SQL。返回JSONB数组。';
