-- 移除夺宝活动的时间约束
-- 让 end_time 和 draw_time 可以为 NULL
-- 因为夺宝活动只在售罄后才开奖，不需要固定的结束时间

-- 修改 end_time 为可空
ALTER TABLE lotteries 
ALTER COLUMN end_time DROP NOT NULL;

-- 修改 draw_time 为可空
ALTER TABLE lotteries 
ALTER COLUMN draw_time DROP NOT NULL;

-- 修改 period 为可空（如果不需要期数）
ALTER TABLE lotteries 
ALTER COLUMN period DROP NOT NULL;

-- 注释说明
COMMENT ON COLUMN lotteries.end_time IS '活动结束时间（可选，售罄后自动结束）';
COMMENT ON COLUMN lotteries.draw_time IS '开奖时间（售罄后自动设置为当前时间+180秒）';
COMMENT ON COLUMN lotteries.period IS '期数（可选）';
