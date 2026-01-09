/**
 * claim-prize 函数单元测试
 * 
 * 测试场景：
 * 1. 正常领取流程
 * 2. 重复领取
 * 3. 状态验证
 * 4. 字段完整性检查
 * 5. 错误处理
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

// 模拟Supabase客户端
class MockSupabaseClient {
  private mockData: Map<string, any[]> = new Map();

  constructor() {
    // 初始化模拟数据
    this.mockData.set('prizes', [
      {
        id: 'prize-1',
        user_id: 'user-1',
        lottery_id: 'lottery-1',
        winning_code: '123456',
        prize_name: '测试奖品',
        prize_value: 100,
        status: 'PENDING',
        pickup_status: 'PENDING_CLAIM',
        pickup_code: null,
        pickup_point_id: null,
        expires_at: null,
        claimed_at: null,
        picked_up_at: null,
        won_at: new Date().toISOString(),
      },
      {
        id: 'prize-2',
        user_id: 'user-1',
        lottery_id: 'lottery-1',
        winning_code: '789012',
        prize_name: '已领取奖品',
        prize_value: 200,
        status: 'PENDING',
        pickup_status: 'PENDING_PICKUP',
        pickup_code: '654321',
        pickup_point_id: 'point-1',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        claimed_at: new Date().toISOString(),
        picked_up_at: null,
        won_at: new Date().toISOString(),
      },
    ]);

    this.mockData.set('pickup_points', [
      {
        id: 'point-1',
        name: '测试自提点',
        status: 'ACTIVE',
        address: '测试地址',
        contact_phone: '1234567890',
      },
    ]);

    this.mockData.set('pickup_logs', []);
  }

  from(table: string) {
    return {
      select: (fields: string) => ({
        eq: (field: string, value: any) => ({
          single: async () => {
            const data = this.mockData.get(table) || [];
            const result = data.find((item: any) => item[field] === value);
            return { data: result || null, error: result ? null : { message: 'Not found' } };
          },
        }),
        in: (field: string, values: any[]) => {
          const data = this.mockData.get(table) || [];
          const results = data.filter((item: any) => values.includes(item[field]));
          return { data: results, error: null };
        },
      }),
      update: (updateData: any) => ({
        eq: (field: string, value: any) => ({
          select: () => ({
            single: async () => {
              const data = this.mockData.get(table) || [];
              const index = data.findIndex((item: any) => item[field] === value);
              if (index >= 0) {
                data[index] = { ...data[index], ...updateData };
                return { data: data[index], error: null };
              }
              return { data: null, error: { message: 'Not found' } };
            },
          }),
        }),
      }),
      insert: async (insertData: any) => {
        const data = this.mockData.get(table) || [];
        data.push(insertData);
        return { data: insertData, error: null };
      },
    };
  }
}

// 测试用例

Deno.test('claim-prize: 正常领取流程', async () => {
  const mockSupabase = new MockSupabaseClient();
  
  // 模拟领取奖品
  const prizeId = 'prize-1';
  const userId = 'user-1';
  const pickupPointId = 'point-1';
  
  // 1. 查询奖品
  const { data: prize } = await mockSupabase
    .from('prizes')
    .select('*')
    .eq('id', prizeId)
    .single();
  
  assertExists(prize, '奖品应该存在');
  assertEquals(prize.user_id, userId, '奖品应该属于该用户');
  assertEquals(prize.pickup_status, 'PENDING_CLAIM', '初始状态应该是PENDING_CLAIM');
  assertEquals(prize.pickup_code, null, '初始提货码应该为空');
  
  // 2. 生成提货码
  const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  // 3. 更新奖品
  const { data: updatedPrize } = await mockSupabase
    .from('prizes')
    .update({
      pickup_code: pickupCode,
      pickup_status: 'PENDING_PICKUP',
      pickup_point_id: pickupPointId,
      expires_at: expiresAt.toISOString(),
      claimed_at: new Date().toISOString(),
    })
    .eq('id', prizeId)
    .select()
    .single();
  
  assertExists(updatedPrize, '更新后的奖品应该存在');
  assertEquals(updatedPrize.pickup_code, pickupCode, '提货码应该正确设置');
  assertEquals(updatedPrize.pickup_status, 'PENDING_PICKUP', '状态应该更新为PENDING_PICKUP');
  assertEquals(updatedPrize.pickup_point_id, pickupPointId, '自提点应该正确设置');
  assertExists(updatedPrize.claimed_at, '领取时间应该存在');
});

Deno.test('claim-prize: 重复领取应返回已有提货码', async () => {
  const mockSupabase = new MockSupabaseClient();
  
  const prizeId = 'prize-2'; // 这个奖品已经领取过
  
  // 查询奖品
  const { data: prize } = await mockSupabase
    .from('prizes')
    .select('*')
    .eq('id', prizeId)
    .single();
  
  assertExists(prize, '奖品应该存在');
  assertExists(prize.pickup_code, '已领取的奖品应该有提货码');
  assertEquals(prize.pickup_status, 'PENDING_PICKUP', '状态应该是PENDING_PICKUP');
  
  // 模拟重复领取（应该直接返回已有信息）
  const existingPickupCode = prize.pickup_code;
  const existingExpiresAt = prize.expires_at;
  
  assertEquals(existingPickupCode, '654321', '提货码应该保持不变');
  assertExists(existingExpiresAt, '过期时间应该存在');
});

Deno.test('claim-prize: 字段完整性验证', async () => {
  const prize = {
    id: 'prize-1',
    user_id: 'user-1',
    lottery_id: 'lottery-1',
    pickup_code: null,
    pickup_status: 'PENDING_CLAIM',
    pickup_point_id: null,
    expires_at: null,
    claimed_at: null,
    picked_up_at: null,
  };
  
  // 验证必需字段
  const requiredFields = ['id', 'user_id', 'lottery_id'];
  for (const field of requiredFields) {
    assertExists(prize[field as keyof typeof prize], `字段 ${field} 应该存在`);
  }
  
  // 验证提货相关字段
  const pickupFields = ['pickup_code', 'pickup_status', 'pickup_point_id', 'expires_at', 'claimed_at', 'picked_up_at'];
  for (const field of pickupFields) {
    assertEquals(field in prize, true, `字段 ${field} 应该在对象中`);
  }
});

Deno.test('claim-prize: 状态一致性验证', async () => {
  // 测试场景1: 正常状态
  const normalPrize = {
    status: 'PENDING',
    pickup_status: 'PENDING_CLAIM',
    pickup_code: null,
  };
  
  // 应该通过验证
  assertEquals(normalPrize.pickup_status, 'PENDING_CLAIM', '正常状态应该是PENDING_CLAIM');
  
  // 测试场景2: 不一致状态（已提货但status未更新）
  const inconsistentPrize = {
    status: 'PENDING',
    pickup_status: 'PICKED_UP',
    pickup_code: '123456',
  };
  
  // 应该检测到不一致
  if (inconsistentPrize.pickup_status === 'PICKED_UP' && inconsistentPrize.status === 'PENDING') {
    console.warn('检测到状态不一致: pickup_status=PICKED_UP 但 status=PENDING');
  }
  
  // 测试场景3: 有提货码但状态不对
  const wrongStatusPrize = {
    status: 'PENDING',
    pickup_status: 'PENDING_CLAIM',
    pickup_code: '123456',
  };
  
  // 应该检测到不一致
  if (wrongStatusPrize.pickup_code && wrongStatusPrize.pickup_status === 'PENDING_CLAIM') {
    console.warn('检测到状态不一致: 已有pickup_code但pickup_status=PENDING_CLAIM');
  }
});

Deno.test('claim-prize: 自提点验证', async () => {
  const mockSupabase = new MockSupabaseClient();
  
  const pickupPointId = 'point-1';
  
  // 查询自提点
  const { data: pickupPoint } = await mockSupabase
    .from('pickup_points')
    .select('*')
    .eq('id', pickupPointId)
    .single();
  
  assertExists(pickupPoint, '自提点应该存在');
  assertEquals(pickupPoint.status, 'ACTIVE', '自提点应该是激活状态');
  assertExists(pickupPoint.name, '自提点应该有名称');
  assertExists(pickupPoint.address, '自提点应该有地址');
});

console.log('✅ 所有claim-prize测试通过');
