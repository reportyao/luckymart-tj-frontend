import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 验证session
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

  return {
    userId: session.user_id,
    session: session
  };
}

// 获取或创建今日配额
async function getOrCreateQuota(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const today = new Date().toISOString().split('T')[0];
  
  // 查询今日配额
  const quotaResponse = await fetch(
    `${supabaseUrl}/rest/v1/ai_chat_quota?user_id=eq.${userId}&date=eq.${today}&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    }
  );

  const quotas = await quotaResponse.json();
  
  if (quotas.length > 0) {
    return quotas[0];
  }

  // 创建新配额
  const createResponse = await fetch(
    `${supabaseUrl}/rest/v1/ai_chat_quota`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId,
        date: today,
        base_quota: 10,
        bonus_quota: 0,
        used_quota: 0
      })
    }
  );

  const newQuota = await createResponse.json();
  return newQuota[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { session_token } = body;

    console.log('[AI-GetQuota] Received request');

    if (!session_token) {
      throw new Error('未授权：缺少 session_token');
    }

    // 1. 验证用户
    const { userId } = await validateSession(session_token);
    console.log('[AI-GetQuota] User validated:', userId);

    // 2. 获取配额
    const quota = await getOrCreateQuota(userId);
    
    const totalQuota = quota.base_quota + quota.bonus_quota;
    const remainingQuota = Math.max(0, totalQuota - quota.used_quota);

    console.log('[AI-GetQuota] Success:', { totalQuota, remainingQuota });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          total_quota: totalQuota,
          used_quota: quota.used_quota,
          remaining_quota: remainingQuota,
          base_quota: quota.base_quota,
          bonus_quota: quota.bonus_quota
        }
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
    );

  } catch (error) {
    console.error('[AI-GetQuota] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
    );
  }
});
