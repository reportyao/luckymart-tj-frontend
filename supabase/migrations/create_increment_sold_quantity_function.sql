-- =====================================================
-- 创建增量更新sold_quantity的RPC函数
-- =====================================================

-- 删除旧函数(如果存在)
DROP FUNCTION IF EXISTS increment_sold_quantity(UUID, INTEGER);

-- 创建新函数
CREATE OR REPLACE FUNCTION increment_sold_quantity(
  product_id UUID,
  amount INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  UPDATE group_buy_products
  SET 
    sold_quantity = COALESCE(sold_quantity, 0) + amount,
    updated_at = NOW()
  WHERE id = product_id;
  
  -- 检查是否更新成功
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product with id % not found', product_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 添加注释
COMMENT ON FUNCTION increment_sold_quantity(UUID, INTEGER) IS 
'Increment the sold_quantity of a group buy product by the specified amount';

-- 测试函数(可选)
DO $$
BEGIN
  RAISE NOTICE 'increment_sold_quantity function created successfully';
END $$;
