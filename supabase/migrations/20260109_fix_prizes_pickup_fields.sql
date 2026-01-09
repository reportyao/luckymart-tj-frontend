-- ============================================
-- 数据库迁移: 修复prizes表缺失的提货相关字段
-- 创建时间: 2026-01-09
-- 目的: 使prizes表结构与claim-prize和get-my-orders函数逻辑一致
-- ============================================

-- 1. 添加提货相关字段到prizes表
ALTER TABLE prizes 
  ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pickup_status VARCHAR(30) DEFAULT 'PENDING_CLAIM',
  ADD COLUMN IF NOT EXISTS pickup_point_id UUID REFERENCES pickup_points(id),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

-- 2. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_prizes_pickup_code ON prizes(pickup_code);
CREATE INDEX IF NOT EXISTS idx_prizes_pickup_status ON prizes(pickup_status);
CREATE INDEX IF NOT EXISTS idx_prizes_pickup_point_id ON prizes(pickup_point_id);
CREATE INDEX IF NOT EXISTS idx_prizes_expires_at ON prizes(expires_at);

-- 3. 添加约束确保pickup_status的值有效
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prizes_pickup_status_check'
  ) THEN
    ALTER TABLE prizes
      ADD CONSTRAINT prizes_pickup_status_check
      CHECK (pickup_status IN (
        'PENDING_CLAIM',    -- 待领取（用户需要确认领取）
        'PENDING_PICKUP',   -- 待提货（已生成提货码）
        'PICKED_UP',        -- 已提货
        'EXPIRED'           -- 已过期
      ));
  END IF;
END $$;

-- 4. 添加约束确保pickup_code唯一性（如果存在）
CREATE UNIQUE INDEX IF NOT EXISTS idx_prizes_pickup_code_unique 
  ON prizes(pickup_code) 
  WHERE pickup_code IS NOT NULL;

-- 5. 更新现有记录的pickup_status（如果为NULL）
UPDATE prizes 
SET pickup_status = 'PENDING_CLAIM' 
WHERE pickup_status IS NULL;

-- 6. 添加注释
COMMENT ON COLUMN prizes.pickup_code IS '提货码（6位数字）';
COMMENT ON COLUMN prizes.pickup_status IS '提货状态: PENDING_CLAIM待领取, PENDING_PICKUP待提货, PICKED_UP已提货, EXPIRED已过期';
COMMENT ON COLUMN prizes.pickup_point_id IS '自提点ID';
COMMENT ON COLUMN prizes.expires_at IS '提货码过期时间（生成后30天）';
COMMENT ON COLUMN prizes.claimed_at IS '用户确认领取时间';
COMMENT ON COLUMN prizes.picked_up_at IS '实际提货时间';

-- 迁移完成
