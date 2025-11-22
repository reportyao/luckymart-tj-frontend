// 并发购买测试脚本
// 测试场景: 10个用户同时购买最后1张票
// 预期结果: 只有1个用户成功,其他9个用户失败(票数不足)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://owyitxwxmxwbkqgzffdw.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// 测试配置
const TEST_CONFIG = {
  concurrent_users: 10,        // 并发用户数
  tickets_to_purchase: 1,      // 每人购买票数
  remaining_tickets: 1,        // 剩余票数
}

// 创建测试夺宝
async function createTestLottery() {
  console.log('📝 创建测试夺宝...')
  
  const { data, error } = await supabase
    .from('lotteries')
    .insert({
      title: '并发测试夺宝',
      description: '用于测试并发购买',
      ticket_price: 10,
      total_tickets: 10,
      sold_tickets: 9,  // 已售9张,剩余1张
      status: 'ACTIVE',
      currency: 'CNY',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`创建测试夺宝失败: ${error.message}`)
  }
  
  console.log(`✅ 测试夺宝创建成功: ${data.id}`)
  return data.id
}

// 创建测试用户
async function createTestUsers(count: number) {
  console.log(`📝 创建 ${count} 个测试用户...`)
  
  const users = []
  
  for (let i = 0; i < count; i++) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        username: `test_user_${i}`,
        balance: 100,  // 每人100夺宝币
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      console.error(`创建用户 ${i} 失败:`, error)
      continue
    }
    
    users.push(data)
  }
  
  console.log(`✅ 创建了 ${users.length} 个测试用户`)
  return users
}

// 并发购买测试
async function testConcurrentPurchase(lotteryId: string, users: any[]) {
  console.log('\n🚀 开始并发购买测试...')
  console.log(`夺宝ID: ${lotteryId}`)
  console.log(`并发用户数: ${users.length}`)
  console.log(`每人购买: ${TEST_CONFIG.tickets_to_purchase} 张票`)
  console.log(`剩余票数: ${TEST_CONFIG.remaining_tickets} 张`)
  console.log('预期结果: 只有1人成功,其他人失败\n')
  
  // 所有用户同时发起购买请求
  const purchasePromises = users.map(async (user, index) => {
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase.rpc('place_lottery_order', {
        p_user_id: user.id,
        p_lottery_id: lotteryId,
        p_ticket_count: TEST_CONFIG.tickets_to_purchase,
      })
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      if (error) {
        return {
          user_index: index,
          user_id: user.id,
          success: false,
          error: error.message,
          duration,
        }
      }
      
      return {
        user_index: index,
        user_id: user.id,
        success: true,
        data,
        duration,
      }
    } catch (error) {
      const endTime = Date.now()
      const duration = endTime - startTime
      
      return {
        user_index: index,
        user_id: user.id,
        success: false,
        error: error.message,
        duration,
      }
    }
  })
  
  // 等待所有请求完成
  const results = await Promise.all(purchasePromises)
  
  // 统计结果
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  
  console.log('\n📊 测试结果:')
  console.log(`✅ 成功: ${successCount} 人`)
  console.log(`❌ 失败: ${failCount} 人`)
  console.log('\n详细结果:')
  
  results.forEach(result => {
    if (result.success) {
      console.log(`  ✅ 用户 ${result.user_index}: 成功购买,票号 ${result.data.ticket_numbers}, 耗时 ${result.duration}ms`)
    } else {
      console.log(`  ❌ 用户 ${result.user_index}: 失败 - ${result.error}, 耗时 ${result.duration}ms`)
    }
  })
  
  // 验证结果
  console.log('\n🔍 验证结果:')
  
  if (successCount === 1 && failCount === users.length - 1) {
    console.log('✅ 测试通过! 行锁机制正常工作,成功防止超卖')
  } else {
    console.log('❌ 测试失败! 行锁机制可能存在问题')
  }
  
  // 检查数据库状态
  const { data: lottery } = await supabase
    .from('lotteries')
    .select('sold_tickets, status')
    .eq('id', lotteryId)
    .single()
  
  console.log(`\n数据库状态:`)
  console.log(`  已售票数: ${lottery?.sold_tickets}`)
  console.log(`  夺宝状态: ${lottery?.status}`)
  
  if (lottery?.sold_tickets === 10 && lottery?.status === 'SOLD_OUT') {
    console.log('✅ 数据库状态正确')
  } else {
    console.log('❌ 数据库状态异常')
  }
  
  return results
}

// 清理测试数据
async function cleanup(lotteryId: string, userIds: string[]) {
  console.log('\n🧹 清理测试数据...')
  
  // 删除票记录
  await supabase.from('tickets').delete().eq('lottery_id', lotteryId)
  
  // 删除订单记录
  await supabase.from('orders').delete().eq('lottery_id', lotteryId)
  
  // 删除夺宝
  await supabase.from('lotteries').delete().eq('id', lotteryId)
  
  // 删除测试用户
  for (const userId of userIds) {
    await supabase.from('profiles').delete().eq('id', userId)
  }
  
  console.log('✅ 清理完成')
}

// 主函数
async function main() {
  console.log('🎯 并发购买测试开始\n')
  console.log('=' .repeat(60))
  
  try {
    // 1. 创建测试夺宝
    const lotteryId = await createTestLottery()
    
    // 2. 创建测试用户
    const users = await createTestUsers(TEST_CONFIG.concurrent_users)
    
    // 3. 执行并发购买测试
    await testConcurrentPurchase(lotteryId, users)
    
    // 4. 清理测试数据
    const userIds = users.map(u => u.id)
    await cleanup(lotteryId, userIds)
    
    console.log('\n' + '='.repeat(60))
    console.log('🎉 测试完成!')
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
  }
}

// 运行测试
if (import.meta.main) {
  main()
}

// 使用方法:
// deno run --allow-net concurrent_purchase_test.ts
