-- 修复数据库表结构,添加前端代码需要的字段
-- 执行时间: 2025-11-22
-- 版本: v2 (只修改存在的表)

-- 1. 修改 lotteries 表,添加缺失的字段
ALTER TABLE lotteries 
  ADD COLUMN IF NOT EXISTS image_urls TEXT[],
  ADD COLUMN IF NOT EXISTS specifications_i18n JSONB,
  ADD COLUMN IF NOT EXISTS material_i18n JSONB,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'TJS',
  ADD COLUMN IF NOT EXISTS max_per_user INTEGER DEFAULT 10;

-- 2. 迁移现有数据: 将 image_url 转换为 image_urls 数组
UPDATE lotteries 
SET image_urls = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

-- 3. 为新字段添加注释
COMMENT ON COLUMN lotteries.image_urls IS '商品图片URL数组,支持多图展示';
COMMENT ON COLUMN lotteries.specifications_i18n IS '商品规格多语言JSON: {"zh": "...", "ru": "...", "tg": "..."}';
COMMENT ON COLUMN lotteries.material_i18n IS '商品材质多语言JSON: {"zh": "...", "ru": "...", "tg": "..."}';
COMMENT ON COLUMN lotteries.currency IS '货币单位,默认TJS(塔吉克斯坦索莫尼)';
COMMENT ON COLUMN lotteries.max_per_user IS '每个用户最多可购买的票数';

-- 4. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_lotteries_currency ON lotteries(currency);
CREATE INDEX IF NOT EXISTS idx_lotteries_status_draw_time ON lotteries(status, draw_time) WHERE status = 'SOLD_OUT';

-- 5. 检查 lottery_entries 表是否可以作为开奖结果的替代
-- (lottery_results 表不存在,可能使用 lottery_entries 或 prizes 表存储开奖信息)

-- 6. 为 prizes 表添加 algorithm_data 字段(如果需要)
ALTER TABLE prizes
  ADD COLUMN IF NOT EXISTS algorithm_data JSONB;

COMMENT ON COLUMN prizes.algorithm_data IS '开奖算法数据JSON,包含timestamp_sum等验证信息';
