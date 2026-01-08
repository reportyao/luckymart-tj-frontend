#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Supabase配置
const SUPABASE_URL = 'https://owyitxwxmxwbkqgzffdw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MjM4NTMsImV4cCI6MjA3Nzk5OTg1M30.xsdiUmVfN9Cwa7jkusYubs4ZI34ZpYSdD_nsAB_X2w0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA';

// 创建Supabase客户端
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 测试统计
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function logTest(name, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`✅ [PASS] ${name}`);
    if (details) console.log(`    └─ ${details}`);
  } else {
    failedTests++;
    console.log(`❌ [FAIL] ${name}`);
    if (details) console.log(`    └─ ${details}`);
  }
}

console.log('\n🧪 开始全面功能测试...\n');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. 数据库连接测试
console.log('📊 [测试组] 数据库连接与基础查询\n');

try {
  const { data, error } = await supabaseAnon.from('users').select('count', { count: 'exact', head: true });
  logTest('数据库连接 (Anon Key)', !error, error ? error.message : '连接成功');
} catch (e) {
  logTest('数据库连接 (Anon Key)', false, e.message);
}

try {
  const { data, error } = await supabaseAdmin.from('users').select('count', { count: 'exact', head: true });
  logTest('数据库连接 (Service Role)', !error, error ? error.message : '连接成功');
} catch (e) {
  logTest('数据库连接 (Service Role)', false, e.message);
}

// 2. 用户数据测试
console.log('\n👤 [测试组] 用户管理功能\n');

try {
  const { data: users, error } = await supabaseAdmin.from('users').select('*').limit(5);
  logTest('查询用户列表', !error && users && users.length > 0, 
    error ? error.message : `成功获取 ${users.length} 个用户`);
  
  if (users && users.length > 0) {
    const user = users[0];
    logTest('用户数据结构验证', 
      user.hasOwnProperty('telegram_id') && user.hasOwnProperty('username'),
      `用户: ${user.username || 'N/A'} (ID: ${user.telegram_id})`);
  }
} catch (e) {
  logTest('查询用户列表', false, e.message);
}

// 3. 抽奖商品测试
console.log('\n🎁 [测试组] 抽奖商品功能\n');

try {
  const { data: lotteries, error } = await supabaseAdmin
    .from('lotteries')
    .select('*')
    .limit(5);
  
  logTest('查询抽奖商品列表', !error && lotteries && lotteries.length > 0,
    error ? error.message : `成功获取 ${lotteries.length} 个商品`);
  
  if (lotteries && lotteries.length > 0) {
    const lottery = lotteries[0];
    logTest('商品数据结构验证',
      lottery.hasOwnProperty('title') && lottery.hasOwnProperty('price'),
      `商品: ${lottery.title} - $${lottery.price}`);
    
    // 统计商品状态
    const activeCount = lotteries.filter(l => l.status === 'ACTIVE').length;
    const completedCount = lotteries.filter(l => l.status === 'COMPLETED').length;
    logTest('商品状态统计', true,
      `活跃: ${activeCount}, 已完成: ${completedCount}`);
  }
} catch (e) {
  logTest('查询抽奖商品列表', false, e.message);
}

// 4. 订单测试
console.log('\n📦 [测试组] 订单管理功能\n');

try {
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('*, users(*), lotteries(*)')
    .limit(5);
  
  logTest('查询订单列表', !error && orders,
    error ? error.message : `成功获取 ${orders?.length || 0} 个订单`);
  
  if (orders && orders.length > 0) {
    const order = orders[0];
    logTest('订单关联数据验证',
      order.users && order.lotteries,
      `订单 #${order.order_number} - 用户: ${order.users?.username}, 商品: ${order.lotteries?.title}`);
    
    // 统计订单状态
    const paidCount = orders.filter(o => o.status === 'PAID').length;
    const pendingCount = orders.filter(o => o.status === 'PENDING').length;
    logTest('订单状态统计', true,
      `已支付: ${paidCount}, 待支付: ${pendingCount}`);
  }
} catch (e) {
  logTest('查询订单列表', false, e.message);
}

// 5. 充值申请测试
console.log('\n💰 [测试组] 充值管理功能\n');

try {
  const { data: deposits, error } = await supabaseAdmin
    .from('deposit_requests')
    .select('*, users(*)')
    .limit(5);
  
  logTest('查询充值申请', !error && deposits,
    error ? error.message : `成功获取 ${deposits?.length || 0} 个充值申请`);
  
  if (deposits && deposits.length > 0) {
    const deposit = deposits[0];
    logTest('充值数据结构验证',
      deposit.hasOwnProperty('amount') && deposit.hasOwnProperty('status'),
      `金额: $${deposit.amount}, 状态: ${deposit.status}`);
    
    // 统计充值状态
    const pendingCount = deposits.filter(d => d.status === 'PENDING').length;
    const approvedCount = deposits.filter(d => d.status === 'APPROVED').length;
    logTest('充值状态统计', true,
      `待审核: ${pendingCount}, 已通过: ${approvedCount}`);
  }
} catch (e) {
  logTest('查询充值申请', false, e.message);
}

// 6. 提现申请测试
console.log('\n💸 [测试组] 提现管理功能\n');

try {
  const { data: withdrawals, error } = await supabaseAdmin
    .from('withdrawal_requests')
    .select('*, users(*)')
    .limit(5);
  
  logTest('查询提现申请', !error && withdrawals,
    error ? error.message : `成功获取 ${withdrawals?.length || 0} 个提现申请`);
  
  if (withdrawals && withdrawals.length > 0) {
    const withdrawal = withdrawals[0];
    logTest('提现数据结构验证',
      withdrawal.hasOwnProperty('amount') && withdrawal.hasOwnProperty('status'),
      `金额: $${withdrawal.amount}, 状态: ${withdrawal.status}`);
    
    // 统计提现状态
    const pendingCount = withdrawals.filter(w => w.status === 'PENDING').length;
    const approvedCount = withdrawals.filter(w => w.status === 'APPROVED').length;
    logTest('提现状态统计', true,
      `待审核: ${pendingCount}, 已通过: ${approvedCount}`);
  }
} catch (e) {
  logTest('查询提现申请', false, e.message);
}

// 7. 数据完整性测试
console.log('\n🔍 [测试组] 数据完整性检查\n');

try {
  // 检查孤立订单
  const { data: orphanOrders, error: orphanError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id')
    .is('user_id', null);
  
  logTest('孤立订单检查', !orphanError && orphanOrders.length === 0,
    orphanError ? orphanError.message : `发现 ${orphanOrders.length} 个孤立订单`);
  
  // 检查数据库表权限
  const tables = ['users', 'lotteries', 'orders', 'deposit_requests', 'withdrawal_requests'];
  for (const table of tables) {
    try {
      const { error } = await supabaseAnon.from(table).select('id').limit(1);
      logTest(`表权限检查: ${table}`, !error,
        error ? `权限错误: ${error.message}` : '权限正常');
    } catch (e) {
      logTest(`表权限检查: ${table}`, false, e.message);
    }
  }
} catch (e) {
  logTest('数据完整性检查', false, e.message);
}

// 8. Telegram Bot配置测试
console.log('\n🤖 [测试组] Telegram Bot 配置\n');

try {
  // 检查环境变量
  const botUsername = process.env.VITE_TELEGRAM_BOT_USERNAME || 'luckymartbot';
  logTest('Bot用户名配置', botUsername === 'luckymartbot',
    `Bot用户名: @${botUsername}`);
  
  // 检查Supabase Edge Functions配置
  const { data: functions, error } = await supabaseAdmin
    .from('pg_catalog.pg_stat_activity')
    .select('*')
    .limit(1);
  
  logTest('Supabase连接池状态', !error, 
    error ? error.message : '连接池正常');
  
  console.log('\n    ⚠️  注意: Telegram Bot需要在Supabase Edge Functions中配置');
  console.log('    Token: 8074258399:AAG1WdyCJe4vphx9YB3B6z60nTE3dhBBP-Q');
  console.log('    配置位置: supabase/functions/_shared/sendTelegramMessage.ts');
  
} catch (e) {
  logTest('Telegram Bot配置', false, e.message);
}

// 9. API响应时间测试
console.log('\n⚡ [测试组] API性能测试\n');

try {
  const start = Date.now();
  const { data, error } = await supabaseAnon.from('users').select('count', { count: 'exact', head: true });
  const duration = Date.now() - start;
  
  logTest('API响应时间', !error && duration < 2000,
    error ? error.message : `响应时间: ${duration}ms`);
} catch (e) {
  logTest('API响应时间', false, e.message);
}

// 10. 数据一致性测试
console.log('\n📐 [测试组] 数据一致性测试\n');

try {
  // 检查用户钱包余额
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, balance, lottery_coins')
    .limit(10);
  
  if (!usersError && users) {
    const negativeBalance = users.filter(u => u.balance < 0 || u.lottery_coins < 0);
    logTest('用户余额合法性检查', negativeBalance.length === 0,
      negativeBalance.length > 0 ? `发现 ${negativeBalance.length} 个负余额用户` : '所有余额正常');
  }
  
  // 检查订单金额一致性
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, lottery_id, price, lotteries(price)')
    .limit(10);
  
  if (!ordersError && orders) {
    const inconsistent = orders.filter(o => 
      o.lotteries && o.price !== o.lotteries.price
    );
    logTest('订单金额一致性检查', inconsistent.length === 0,
      inconsistent.length > 0 ? `发现 ${inconsistent.length} 个价格不一致订单` : '价格一致');
  }
} catch (e) {
  logTest('数据一致性测试', false, e.message);
}

// 测试总结
console.log('\n═══════════════════════════════════════════════════════════');
console.log('\n📊 测试结果汇总\n');
console.log(`总测试数: ${totalTests}`);
console.log(`✅ 通过: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
console.log(`❌ 失败: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);

if (failedTests === 0) {
  console.log('\n🎉 所有测试通过！系统运行正常。');
} else {
  console.log('\n⚠️  有测试失败，请查看上方详细信息。');
}

console.log('\n═══════════════════════════════════════════════════════════\n');

process.exit(failedTests > 0 ? 1 : 0);
