import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

  // 查询 user_sessions 表验证 session
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

  // 检查 session 是否过期
  const expiresAt = new Date(session.expires_at);
  const now = new Date();
  
  if (expiresAt < now) {
    throw new Error('未授权：会话已过期');
  }

  // 单独查询用户数据
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
    user: users[0],
    session: session
  };
}

serve(async (req) => {
  // 允许 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 从 body 中获取 session_token
    const body = await req.json()
    const { session_token } = body

    console.log('[GetInvitedUsers] Received request:', { session_token: session_token ? 'present' : 'missing' });

    if (!session_token) {
      throw new Error('未授权：缺少 session_token');
    }

    // 验证用户 session
    const { userId } = await validateSession(session_token);
    
    console.log('[GetInvitedUsers] User validated:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 2. 获取一级好友 (referred_by_id = userId)
    const level1Response = await fetch(
      `${supabaseUrl}/rest/v1/users?referred_by_id=eq.${userId}&select=id,telegram_username,avatar_url,created_at`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!level1Response.ok) {
      throw new Error('获取一级好友失败');
    }

    const level1Users = await level1Response.json();

    // 3. 获取二级好友 (referred_by_id = level1Users.id)
    const level1Ids = level1Users?.map((u: any) => u.id) || []
    let level2Users: any[] = []
    if (level1Ids.length > 0) {
      const level2Response = await fetch(
        `${supabaseUrl}/rest/v1/users?referred_by_id=in.(${level1Ids.join(',')})&select=id,telegram_username,avatar_url,created_at,referred_by_id`,
        {
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (level2Response.ok) {
        level2Users = await level2Response.json();
      }
    }

    // 4. 获取三级好友 (referred_by_id = level2Users.id)
    const level2Ids = level2Users.map((u: any) => u.id)
    let level3Users: any[] = []
    if (level2Ids.length > 0) {
      const level3Response = await fetch(
        `${supabaseUrl}/rest/v1/users?referred_by_id=in.(${level2Ids.join(',')})&select=id,telegram_username,avatar_url,created_at,referred_by_id`,
        {
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (level3Response.ok) {
        level3Users = await level3Response.json();
      }
    }

    // 5. 整合数据并计算统计
    const allInvitedUsers = [...(level1Users || []), ...level2Users, ...level3Users]
      .map((u: any) => {
        // 确定层级
        let userLevel = 0
        if (level1Users?.some((l1: any) => l1.id === u.id)) userLevel = 1
        else if (level2Users.some((l2: any) => l2.id === u.id)) userLevel = 2
        else if (level3Users.some((l3: any) => l3.id === u.id)) userLevel = 3

        return {
          id: u.id,
          username: u.telegram_username || `User${u.id.slice(-4)}`,
          avatar_url: u.avatar_url,
          created_at: u.created_at,
          level: userLevel,
          commission_earned: 0, // TODO: 查询佣金
          total_spent: 0, // TODO: 查询总消费
        }
      })

    console.log('[GetInvitedUsers] Success, found users:', allInvitedUsers.length);

    return new Response(
      JSON.stringify({ success: true, data: allInvitedUsers }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
    )

  } catch (error) {
    console.error('[GetInvitedUsers] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
    )
  }
})
