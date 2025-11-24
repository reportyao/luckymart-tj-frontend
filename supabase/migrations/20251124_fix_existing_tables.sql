-- ============================================
-- 修复现有表的缺失字段
-- 创建时间: 2025-11-24
-- 描述: 为users和lotteries表添加缺失的多语言和邀请关系字段
-- ============================================

-- 1. 修复 users 表 - 添加邀请关系字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS referral_level INTEGER DEFAULT 0;

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_level ON users(referral_level);

-- 2. 修复 lotteries 表 - 添加多语言名称字段
ALTER TABLE lotteries 
ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb;

-- 如果已有单语言name字段，迁移数据到name_i18n
UPDATE lotteries 
SET name_i18n = jsonb_build_object('zh', COALESCE(name, ''), 'ru', '', 'tg', '')
WHERE name_i18n IS NULL OR name_i18n = '{"zh": "", "ru": "", "tg": ""}'::jsonb;

-- 3. 确保description_i18n和details_i18n字段存在
ALTER TABLE lotteries 
ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb,
ADD COLUMN IF NOT EXISTS details_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb;

-- 添加注释
COMMENT ON COLUMN users.referrer_id IS '邀请人ID，指向邀请该用户的用户';
COMMENT ON COLUMN users.referral_level IS '用户在邀请树中的层级，0表示根用户';
COMMENT ON COLUMN lotteries.name_i18n IS '商品名称（多语言）';
COMMENT ON COLUMN lotteries.description_i18n IS '商品简短描述（多语言）';
COMMENT ON COLUMN lotteries.details_i18n IS '商品详细介绍（多语言，富文本）';
