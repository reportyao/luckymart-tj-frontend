import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 通用的 session 验证函数
async function validateSession(sessionToken: string) {
  if (!sessionToken) {
    throw new Error('未授权：缺少认证令牌');
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('服务器配置错误');
  }

  const sessionResponse = await fetch(
    `${supabaseUrl}/rest/v1/user_sessions?session_token=eq.${sessionToken}&is_active=eq.true&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!sessionResponse.ok) {
    throw new Error('验证会话失败');
  }

  const sessions = await sessionResponse.json();
  
  if (sessions.length === 0) {
    throw new Error('未授权：会话不存在或已失效');
  }

  const session = sessions[0];

  const expiresAt = new Date(session.expires_at);
  const now = new Date();
  
  if (expiresAt < now) {
    throw new Error('未授权：会话已过期');
  }

  const userResponse = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${session.user_id}&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!userResponse.ok) {
    throw new Error('查询用户信息失败');
  }

  const users = await userResponse.json();
  
  if (users.length === 0) {
    throw new Error('未授权：用户不存在');
  }

  return {
    userId: session.user_id,
    telegramId: users[0].telegram_id,
    user: users[0],
    session: session
  };
}

// 生成唯一的6位数字提货码
async function generatePickupCode(supabase: any): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    // 生成6位随机数字
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 检查是否在prizes表中已存在
    const { data: existingPrize } = await supabase
      .from('prizes')
      .select('id')
      .eq('pickup_code', code)
      .single();
    
    // 检查是否在group_buy_results表中已存在
    const { data: existingGroupBuy } = await supabase
      .from('group_buy_results')
      .select('id')
      .eq('pickup_code', code)
      .single();
    
    if (!existingPrize && !existingGroupBuy) {
      return code;
    }
    
    attempts++;
  }
  
  throw new Error('生成提货码失败，请重试');
}

/**
 * 用户确认领取奖品，生成提货码
 * 支持两种类型：
 * - lottery: 积分商城中奖（prizes表）
 * - group_buy: 拼团中奖（group_buy_results表）
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { session_token, prize_id, order_type = 'lottery', pickup_point_id } = body

    console.log('[ClaimPrize] Received request:', { 
      prize_id,
      order_type,
      pickup_point_id,
      session_token: session_token ? 'present' : 'missing'
    });

    if (!session_token) {
      throw new Error('未授权：缺少 session_token');
    }

    if (!prize_id) {
      throw new Error('缺少奖品ID');
    }

    // 验证用户 session
    const { userId, telegramId } = await validateSession(session_token);
    
    console.log('[ClaimPrize] User validated:', { userId, telegramId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let prize: any = null;
    let tableName: string;
    let userIdField: string;
    let userIdValue: string;

    // 根据order_type确定表名和用户ID字段
    if (order_type === 'group_buy') {
      tableName = 'group_buy_results';
      userIdField = 'winner_id';
      userIdValue = telegramId; // 拼团使用telegram_id
    } else {
      tableName = 'prizes';
      userIdField = 'user_id';
      userIdValue = userId; // 积分商城使用users.id
    }

    // 1. 验证奖品是否属于该用户
    const { data: prizeData, error: prizeError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', prize_id)
      .eq(userIdField, userIdValue)
      .single();

    if (prizeError || !prizeData) {
      console.error('[ClaimPrize] Prize not found:', prizeError);
      throw new Error('奖品不存在或不属于您');
    }

    prize = prizeData;

    // 2. 检查是否已经领取过
    if (prize.pickup_code) {
      console.log('[ClaimPrize] Prize already claimed');
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            pickup_code: prize.pickup_code,
            expires_at: prize.expires_at,
            pickup_point_id: prize.pickup_point_id,
            message: '您已领取过该奖品'
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 3. 检查状态是否允许领取
    if (prize.pickup_status && prize.pickup_status !== 'PENDING_CLAIM') {
      throw new Error('该奖品当前状态不允许领取');
    }

    // 4. 验证自提点是否存在
    if (pickup_point_id) {
      const { data: pickupPoint, error: pointError } = await supabase
        .from('pickup_points')
        .select('id, status')
        .eq('id', pickup_point_id)
        .single();

      if (pointError || !pickupPoint) {
        throw new Error('自提点不存在');
      }

      if (pickupPoint.status !== 'ACTIVE') {
        throw new Error('该自提点当前不可用');
      }
    }

    // 5. 生成提货码
    const pickupCode = await generatePickupCode(supabase);
    
    // 6. 设置过期时间（30天后）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 7. 更新奖品记录
    const { data: updatedPrize, error: updateError } = await supabase
      .from(tableName)
      .update({
        pickup_code: pickupCode,
        pickup_status: 'PENDING_PICKUP',
        pickup_point_id: pickup_point_id || null,
        expires_at: expiresAt.toISOString(),
        claimed_at: new Date().toISOString(),
      })
      .eq('id', prize_id)
      .select()
      .single();

    if (updateError) {
      console.error('[ClaimPrize] Update error:', updateError);
      throw new Error('更新奖品状态失败');
    }

    // 8. 记录操作日志
    const { error: logError } = await supabase
      .from('pickup_logs')
      .insert({
        prize_id: prize_id,
        pickup_code: pickupCode,
        pickup_point_id: pickup_point_id || null,
        operation_type: 'CLAIM',
        notes: `用户确认领取${order_type === 'group_buy' ? '拼团' : '积分商城'}奖品，生成提货码`,
      });

    if (logError) {
      console.error('[ClaimPrize] Log error:', logError);
      // 不影响主流程，继续
    }

    // 9. 获取自提点详情（如果有）
    let pickupPointDetails = null;
    if (pickup_point_id) {
      const { data: pointData } = await supabase
        .from('pickup_points')
        .select('id, name, name_i18n, address, address_i18n, contact_phone, business_hours')
        .eq('id', pickup_point_id)
        .single();
      pickupPointDetails = pointData;
    }

    console.log('[ClaimPrize] Success:', { pickupCode, expiresAt });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          pickup_code: pickupCode,
          expires_at: expiresAt.toISOString(),
          pickup_point_id: pickup_point_id,
          pickup_point: pickupPointDetails,
          claimed_at: new Date().toISOString(),
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[ClaimPrize] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
