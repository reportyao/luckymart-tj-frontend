-- 创建测试账号
-- 用于在非 Telegram 环境中测试应用

-- 测试用户 1: 普通用户
INSERT INTO users (
  telegram_id,
  username,
  first_name,
  last_name,
  language_code,
  balance,
  lottery_coins,
  created_at
) VALUES (
  1000001,
  'testuser1',
  'Test',
  'User1',
  'zh',
  1000.00,
  500,
  NOW()
) ON CONFLICT (telegram_id) DO UPDATE SET
  balance = 1000.00,
  lottery_coins = 500;

-- 测试用户 2: VIP 用户
INSERT INTO users (
  telegram_id,
  username,
  first_name,
  last_name,
  language_code,
  balance,
  lottery_coins,
  created_at
) VALUES (
  1000002,
  'vipuser',
  'VIP',
  'User',
  'zh',
  10000.00,
  5000,
  NOW()
) ON CONFLICT (telegram_id) DO UPDATE SET
  balance = 10000.00,
  lottery_coins = 5000;

-- 测试用户 3: 新用户(无余额)
INSERT INTO users (
  telegram_id,
  username,
  first_name,
  last_name,
  language_code,
  balance,
  lottery_coins,
  created_at
) VALUES (
  1000003,
  'newuser',
  'New',
  'User',
  'zh',
  0.00,
  0,
  NOW()
) ON CONFLICT (telegram_id) DO UPDATE SET
  balance = 0.00,
  lottery_coins = 0;

-- 测试用户 4: 俄语用户
INSERT INTO users (
  telegram_id,
  username,
  first_name,
  last_name,
  language_code,
  balance,
  lottery_coins,
  created_at
) VALUES (
  1000004,
  'russianuser',
  'Тест',
  'Пользователь',
  'ru',
  2000.00,
  1000,
  NOW()
) ON CONFLICT (telegram_id) DO UPDATE SET
  balance = 2000.00,
  lottery_coins = 1000;

-- 测试用户 5: 塔吉克语用户
INSERT INTO users (
  telegram_id,
  username,
  first_name,
  last_name,
  language_code,
  balance,
  lottery_coins,
  created_at
) VALUES (
  1000005,
  'tajikuser',
  'Санҷиш',
  'Корбар',
  'tg',
  3000.00,
  1500,
  NOW()
) ON CONFLICT (telegram_id) DO UPDATE SET
  balance = 3000.00,
  lottery_coins = 1500;

-- 创建测试夺宝商品
INSERT INTO lotteries (
  name_i18n,
  description_i18n,
  details_i18n,
  specifications_i18n,
  material_i18n,
  image_url,
  image_urls,
  price,
  currency,
  total_tickets,
  sold_tickets,
  max_per_user,
  status,
  start_time,
  end_time,
  created_at
) VALUES (
  '{"zh": "测试商品 - iPhone 15 Pro", "ru": "Тестовый товар - iPhone 15 Pro", "tg": "Мол санҷишӣ - iPhone 15 Pro"}',
  '{"zh": "全新未拆封的 iPhone 15 Pro 256GB", "ru": "Новый запечатанный iPhone 15 Pro 256GB", "tg": "iPhone 15 Pro 256GB нав ва печатнашуда"}',
  '{"zh": "最新款 iPhone 15 Pro,配备 A17 Pro 芯片,钛金属边框,全新相机系统", "ru": "Новейший iPhone 15 Pro с чипом A17 Pro, титановой рамкой и новой камерой", "tg": "iPhone 15 Pro-и нав бо чипи A17 Pro, чаҳорчӯбаи титан ва системаи камераи нав"}',
  '{"zh": "存储: 256GB\n屏幕: 6.1英寸 Super Retina XDR\n芯片: A17 Pro", "ru": "Память: 256GB\nЭкран: 6.1 дюйма Super Retina XDR\nЧип: A17 Pro", "tg": "Хотира: 256GB\nЭкран: 6.1 дюйм Super Retina XDR\nЧип: A17 Pro"}',
  '{"zh": "钛金属边框,玻璃背板", "ru": "Титановая рамка, стеклянная задняя панель", "tg": "Чаҳорчӯбаи титан, панели паси шишагӣ"}',
  'https://images.unsplash.com/photo-1696446702183-cbd0174e00e4?w=800',
  ARRAY['https://images.unsplash.com/photo-1696446702183-cbd0174e00e4?w=800', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800'],
  10.00,
  'TJS',
  100,
  0,
  10,
  'ACTIVE',
  NOW(),
  NOW() + INTERVAL '7 days',
  NOW()
) ON CONFLICT DO NOTHING;

-- 输出测试账号信息
SELECT 
  telegram_id,
  username,
  first_name,
  language_code,
  balance,
  lottery_coins
FROM users
WHERE telegram_id >= 1000001 AND telegram_id <= 1000005
ORDER BY telegram_id;
