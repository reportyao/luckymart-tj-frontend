import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://owyitxwxmxwbkqgzffdw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🚀 生成完整测试数据...\n');

async function generateTestData() {
  try {
    // 1. 生成测试用户
    console.log('👥 生成测试用户...');
    const testUsers = [];
    
    // 获取现有用户
    const { data: existingUsers } = await supabase
      .from('users')
      .select('*')
      .limit(10);
    
    if (existingUsers && existingUsers.length > 0) {
      console.log(`  ✅ 已有 ${existingUsers.length} 个用户`);
      testUsers.push(...existingUsers);
    } else {
      console.log('  ⚠️  没有现有用户，请先注册用户');
    }

    // 2. 生成夺宝商品
    console.log('\n🎰 生成夺宝商品...');
    const products = [
      {
        period: `LUCKY${Date.now()}001`,
        title: 'iPhone 15 Pro Max 256GB',
        description: '最新款苹果手机，性能强大',
        ticket_price: 10,
        total_tickets: 1000,
        currency: 'USD',
        status: 'ACTIVE',
        max_per_user: 50
      },
      {
        period: `LUCKY${Date.now()}002`,
        title: 'MacBook Pro 14寸 M3',
        description: '专业级笔记本电脑',
        ticket_price: 20,
        total_tickets: 500,
        currency: 'USD',
        status: 'ACTIVE',
        max_per_user: 30
      },
      {
        period: `LUCKY${Date.now()}003`,
        title: 'iPad Air 第五代',
        description: '10.9英寸液晶显示屏',
        ticket_price: 15,
        total_tickets: 800,
        currency: 'USD',
        status: 'ACTIVE',
        max_per_user: 40
      },
      {
        period: `LUCKY${Date.now()}004`,
        title: 'AirPods Pro 2代',
        description: '主动降噪无线耳机',
        ticket_price: 5,
        total_tickets: 2000,
        currency: 'USD',
        status: 'ACTIVE',
        max_per_user: 100
      },
      {
        period: `LUCKY${Date.now()}005`,
        title: 'Apple Watch Series 9',
        description: 'GPS版智能手表',
        ticket_price: 8,
        total_tickets: 1500,
        currency: 'USD',
        status: 'UPCOMING',
        max_per_user: 60
      }
    ];

    const createdLotteries = [];
    for (const product of products) {
      const now = new Date();
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 昨天
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后
      const drawTime = new Date(endTime.getTime() + 60 * 60 * 1000); // 结束后1小时开奖

      const lotteryData = {
        ...product,
        sold_tickets: Math.floor(Math.random() * product.total_tickets * 0.3),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        draw_time: drawTime.toISOString(),
        updated_at: now.toISOString()
      };

      const { data, error } = await supabase
        .from('lotteries')
        .insert(lotteryData)
        .select()
        .single();

      if (!error && data) {
        createdLotteries.push(data);
        console.log(`  ✅ 创建夺宝: ${product.title}`);
      } else if (error) {
        console.log(`  ❌ 失败: ${error.message}`);
      }
    }

    // 3. 生成订单
    if (testUsers.length > 0 && createdLotteries.length > 0) {
      console.log('\n📦 生成订单...');
      const orderStatuses = ['PENDING', 'PAID', 'COMPLETED', 'CANCELLED'];
      const paymentMethods = ['BALANCE_WALLET', 'LOTTERY_COIN', 'ALIF_MOBI', 'DC_BANK'];

      for (let i = 0; i < 30; i++) {
        const user = testUsers[Math.floor(Math.random() * testUsers.length)];
        const lottery = createdLotteries[Math.floor(Math.random() * createdLotteries.length)];
        const quantity = Math.floor(Math.random() * 10) + 1;

        const orderData = {
          user_id: user.id,
          lottery_id: lottery.id,
          order_number: `ORD${Date.now()}${i}`,
          type: 'LOTTERY_PURCHASE',
          total_amount: lottery.ticket_price * quantity,
          currency: lottery.currency,
          quantity: quantity,
          status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
          payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)]
        };

        const { error } = await supabase
          .from('orders')
          .insert(orderData);

        if (!error) {
          console.log(`  ✅ 订单 ${i + 1}/30`);
        }
      }
    }

    // 4. 生成充值申请
    if (testUsers.length > 0) {
      console.log('\n💰 生成充值申请...');
      const statuses = ['PENDING', 'APPROVED', 'REJECTED'];

      for (let i = 0; i < 15; i++) {
        const user = testUsers[Math.floor(Math.random() * testUsers.length)];
        const depositData = {
          user_id: user.id,
          amount: Math.floor(Math.random() * 5000) + 100,
          currency: 'USD',
          payment_proof_url: `https://example.com/proof-${Date.now()}-${i}.jpg`,
          status: statuses[Math.floor(Math.random() * statuses.length)]
        };

        const { error } = await supabase
          .from('deposit_requests')
          .insert(depositData);

        if (!error) {
          console.log(`  ✅ 充值申请 ${i + 1}/15`);
        }
      }
    }

    // 5. 生成提现申请
    if (testUsers.length > 0) {
      console.log('\n💸 生成提现申请...');
      const statuses = ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED'];

      for (let i = 0; i < 12; i++) {
        const user = testUsers[Math.floor(Math.random() * testUsers.length)];
        const withdrawalData = {
          user_id: user.id,
          amount: Math.floor(Math.random() * 3000) + 50,
          currency: 'USD',
          withdrawal_address: `BANK-ACC-${Math.random().toString(36).substring(7).toUpperCase()}`,
          status: statuses[Math.floor(Math.random() * statuses.length)]
        };

        const { error } = await supabase
          .from('withdrawal_requests')
          .insert(withdrawalData);

        if (!error) {
          console.log(`  ✅ 提现申请 ${i + 1}/12`);
        }
      }
    }

    console.log('\n✅ 测试数据生成完成！');
    console.log('\n📊 数据统计:');
    console.log(`  用户: ${testUsers.length} 个`);
    console.log(`  夺宝商品: ${createdLotteries.length} 个`);
    console.log(`  订单: 30 个`);
    console.log(`  充值申请: 15 个`);
    console.log(`  提现申请: 12 个`);

    return {
      users: testUsers.length,
      lotteries: createdLotteries.length,
      orders: 30,
      deposits: 15,
      withdrawals: 12
    };

  } catch (error) {
    console.error('❌ 生成测试数据时出错:', error);
    throw error;
  }
}

generateTestData().then(result => {
  console.log('\n🎉 完成！');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
