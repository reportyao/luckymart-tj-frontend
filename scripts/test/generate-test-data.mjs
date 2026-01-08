import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://owyitxwxmxwbkqgzffdw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function generateTestData() {
  console.log('🚀 开始生成测试数据...\n');

  try {
    // 1. 获取现有测试用户
    console.log('📝 获取现有用户...');
    const { data: existingUsers, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(10);
    
    const testUsers = existingUsers || [];
    console.log(`  ✅ 找到 ${testUsers.length} 个用户`);
    
    // 如果没有用户，输出提示
    if (testUsers.length === 0) {
      console.log('  ⚠️  数据库中没有用户，请先注册或创建用户');
    }

    // 2. 创建夺宝商品
    console.log('\n🎰 创建夺宝商品...');
    const products = [
      {
        title: { zh: 'iPhone 15 Pro Max', ru: 'iPhone 15 Pro Max', tg: 'iPhone 15 Pro Max' },
        description: { zh: '最新款苹果手机，256GB', ru: 'Последний iPhone, 256GB', tg: 'iPhone навтарин, 256GB' },
        ticket_price: 10,
        total_tickets: 1000,
        currency: 'USD',
        status: 'ACTIVE'
      },
      {
        title: { zh: 'MacBook Pro 14寸', ru: 'MacBook Pro 14"', tg: 'MacBook Pro 14"' },
        description: { zh: 'M3 Pro芯片，16GB内存', ru: 'M3 Pro чип, 16GB RAM', tg: 'M3 Pro чип, 16GB RAM' },
        ticket_price: 20,
        total_tickets: 500,
        currency: 'USD',
        status: 'ACTIVE'
      },
      {
        title: { zh: 'AirPods Pro 2', ru: 'AirPods Pro 2', tg: 'AirPods Pro 2' },
        description: { zh: '主动降噪无线耳机', ru: 'Беспроводные наушники с ANC', tg: 'Гӯшвораҳои бесим бо ANC' },
        ticket_price: 5,
        total_tickets: 2000,
        currency: 'USD',
        status: 'ACTIVE'
      },
      {
        title: { zh: 'iPad Air', ru: 'iPad Air', tg: 'iPad Air' },
        description: { zh: '10.9英寸平板电脑', ru: '10.9" планшет', tg: 'Планшети 10.9"' },
        ticket_price: 15,
        total_tickets: 800,
        currency: 'USD',
        status: 'UPCOMING'
      },
      {
        title: { zh: 'Apple Watch Series 9', ru: 'Apple Watch Series 9', tg: 'Apple Watch Series 9' },
        description: { zh: '智能手表，GPS版', ru: 'Умные часы, GPS', tg: 'Соати ҳушманд, GPS' },
        ticket_price: 8,
        total_tickets: 1500,
        currency: 'USD',
        status: 'ACTIVE'
      }
    ];

    const lotteries = [];
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - Math.floor(Math.random() * 5));
      const endTime = new Date(startTime);
      endTime.setDate(endTime.getDate() + 7);

      const lotteryData = {
        period: `TEST2025${String(100 + i).padStart(3, '0')}`,
        ...product,
        sold_tickets: Math.floor(Math.random() * product.total_tickets * 0.6),
        max_per_user: 100,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        draw_time: endTime.toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('lotteries')
        .insert(lotteryData)
        .select();

      if (!error && data) {
        lotteries.push(data[0]);
        console.log(`  ✅ 创建夺宝: ${product.title.zh} (期号: ${lotteryData.period})`);
      } else if (error) {
        console.log(`  ❌ 创建失败: ${error.message}`);
      }
    }

    // 3. 创建订单
    if (testUsers.length > 0 && lotteries.length > 0) {
      console.log('\n📦 创建测试订单...');
      for (let i = 0; i < 20; i++) {
        const user = testUsers[Math.floor(Math.random() * testUsers.length)];
        const lottery = lotteries[Math.floor(Math.random() * lotteries.length)];
        const statuses = ['PENDING', 'PAID', 'COMPLETED', 'CANCELLED'];
        const types = ['LOTTERY_PURCHASE', 'MARKET_PURCHASE', 'WALLET_RECHARGE'];

        const orderData = {
          order_number: `ORD-${Date.now()}-${i}`,
          user_id: user.id,
          type: types[Math.floor(Math.random() * types.length)],
          total_amount: Math.floor(Math.random() * 500) + 50,
          status: statuses[Math.floor(Math.random() * statuses.length)]
        };

        const { error } = await supabase
          .from('orders')
          .insert(orderData);

        if (!error) {
          console.log(`  ✅ 创建订单: ${orderData.order_number}`);
        }
      }
    }

    // 4. 创建充值申请
    if (testUsers.length > 0) {
      console.log('\n💰 创建充值申请...');
      for (let i = 0; i < 10; i++) {
        const user = testUsers[Math.floor(Math.random() * testUsers.length)];
        const statuses = ['PENDING', 'APPROVED', 'REJECTED'];

        const depositData = {
          user_id: user.id,
          amount: Math.floor(Math.random() * 5000) + 100,
          currency: 'USD',
          payment_proof_url: `https://example.com/proof-${i}.jpg`,
          status: statuses[Math.floor(Math.random() * statuses.length)]
        };

        const { error } = await supabase
          .from('deposit_requests')
          .insert(depositData);

        if (!error) {
          console.log(`  ✅ 创建充值申请: ${depositData.amount} SOM`);
        }
      }
    }

    // 5. 创建提现申请
    if (testUsers.length > 0) {
      console.log('\n💸 创建提现申请...');
      for (let i = 0; i < 8; i++) {
        const user = testUsers[Math.floor(Math.random() * testUsers.length)];
        const statuses = ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED'];

        const withdrawalData = {
          user_id: user.id,
          amount: Math.floor(Math.random() * 3000) + 100,
          currency: 'USD',
          withdrawal_address: `BANK-${Math.random().toString(36).substring(7).toUpperCase()}`,
          status: statuses[Math.floor(Math.random() * statuses.length)]
        };

        const { error } = await supabase
          .from('withdrawal_requests')
          .insert(withdrawalData);

        if (!error) {
          console.log(`  ✅ 创建提现申请: ${withdrawalData.amount} SOM`);
        }
      }
    }

    // 6. 创建晒单
    if (testUsers.length > 0 && lotteries.length > 0) {
      console.log('\n📸 创建晒单...');
      for (let i = 0; i < 5; i++) {
        const user = testUsers[Math.floor(Math.random() * testUsers.length)];
        const lottery = lotteries[Math.floor(Math.random() * lotteries.length)];
        const statuses = ['PENDING', 'APPROVED', 'REJECTED'];

        const showoffData = {
          user_id: user.id,
          lottery_id: lottery.id,
          title: `我中奖了！${lottery.title.zh}`,
          content: `太开心了，终于中了${lottery.title.zh}！感谢平台！`,
          image_urls: [`https://example.com/showoff-${i}-1.jpg`, `https://example.com/showoff-${i}-2.jpg`],
          status: statuses[Math.floor(Math.random() * statuses.length)]
        };

        const { error } = await supabase
          .from('showoff_posts')
          .insert(showoffData);

        if (!error) {
          console.log(`  ✅ 创建晒单: ${showoffData.title}`);
        }
      }
    }

    console.log('\n✅ 测试数据生成完成！');
    console.log('\n📊 数据统计:');
    console.log(`  - 用户: ${testUsers.length} 个`);
    console.log(`  - 夺宝商品: ${lotteries.length} 个`);
    console.log(`  - 订单: 20 个`);
    console.log(`  - 充值申请: 10 个`);
    console.log(`  - 提现申请: 8 个`);
    console.log(`  - 晒单: 5 个`);

  } catch (error) {
    console.error('❌ 生成测试数据时出错:', error);
  }
}

generateTestData();
