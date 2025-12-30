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
    telegramId: users[0].telegram_id,
    user: users[0],
    session: session
  };
}

/**
 * 获取用户的所有订单记录（拼团、积分商城、抽奖中奖）
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { session_token, order_type, page = 1, page_size = 20 } = body

    console.log('[GetMyOrders] Received request:', { 
      session_token: session_token ? 'present' : 'missing',
      order_type,
      page,
      page_size
    });

    if (!session_token) {
      throw new Error('未授权：缺少 session_token');
    }

    // 验证用户 session
    const { userId, telegramId } = await validateSession(session_token);
    
    console.log('[GetMyOrders] User validated:', { userId, telegramId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const orders: any[] = [];
    const offset = (page - 1) * page_size;

    // 1. 获取拼团订单
    if (!order_type || order_type === 'all' || order_type === 'group_buy') {
      console.log('[GetMyOrders] Fetching group buy orders for telegramId:', telegramId);
      
      const { data: groupBuyOrders, error: groupBuyError } = await supabase
        .from('group_buy_orders')
        .select(`
          id,
          user_id,
          session_id,
          product_id,
          amount,
          status,
          order_number,
          order_timestamp,
          refund_lucky_coins,
          created_at,
          session:group_buy_sessions(
            id,
            session_code,
            status,
            current_participants,
            group_size,
            expires_at
          ),
          product:group_buy_products(
            id,
            title,
            image_url,
            original_price,
            price_per_person
          )
        `)
        .eq('user_id', telegramId)
        .order('created_at', { ascending: false });

      if (groupBuyError) {
        console.error('[GetMyOrders] Group buy orders error:', groupBuyError);
      } else if (groupBuyOrders) {
        console.log('[GetMyOrders] Found group buy orders:', groupBuyOrders.length);
        
        groupBuyOrders.forEach((order: any) => {
          orders.push({
            id: order.id,
            order_type: 'group_buy',
            order_number: order.order_number,
            amount: order.amount,
            status: order.status,
            refund_lucky_coins: order.refund_lucky_coins,
            created_at: order.created_at,
            // 商品信息
            product_title: order.product?.title || {},
            product_image: order.product?.image_url || '',
            original_price: order.product?.original_price || 0,
            price_per_person: order.product?.price_per_person || 0,
            // 拼团会话信息
            session_status: order.session?.status || '',
            session_code: order.session?.session_code || '',
            current_participants: order.session?.current_participants || 0,
            group_size: order.session?.group_size || 3,
            expires_at: order.session?.expires_at || null,
            session_id: order.session_id,
          });
        });
      }
    }

    // 2. 获取抽奖中奖记录(积分商城)
    if (!order_type || order_type === 'all' || order_type === 'lottery') {
      console.log('[GetMyOrders] Fetching lottery prizes for userId:', userId);
      
      const { data: prizes, error: prizesError } = await supabase
        .from('prizes')
        .select(`
          id,
          lottery_id,
          winning_code,
          prize_value,
          status,
          won_at,
          created_at,
          pickup_code,
          pickup_status,
          pickup_point_id,
          expires_at,
          claimed_at,
          picked_up_at,
          lottery:lotteries(
            id,
            title,
            title_i18n,
            image_url,
            period,
            ticket_price
          ),
          shipping(*),
          resale_listing(*),
          pickup_point:pickup_points(
            id,
            name,
            name_i18n,
            address,
            address_i18n,
            contact_phone
          )
        `)
        .eq('user_id', userId)
        .order('won_at', { ascending: false });

      if (prizesError) {
        console.error('[GetMyOrders] Prizes error:', prizesError);
      } else if (prizes) {
        console.log('[GetMyOrders] Found prizes:', prizes.length);
        
        prizes.forEach((prize: any) => {
          // 确定状态
          let displayStatus = prize.status || 'PENDING';
          if (prize.resale_listing && prize.resale_listing.length > 0) {
            displayStatus = 'RESOLD';
          } else if (prize.shipping && prize.shipping.length > 0) {
            const shippingStatus = prize.shipping[0]?.status;
            if (shippingStatus === 'SHIPPED' || shippingStatus === 'DELIVERED') {
              displayStatus = 'SHIPPED';
            } else if (shippingStatus === 'PENDING' || shippingStatus === 'PROCESSING') {
              displayStatus = 'SHIPPING';
            }
          }

          orders.push({
            id: prize.id,
            order_type: 'lottery',
            order_number: prize.winning_code,
            amount: prize.prize_value,
            status: displayStatus,
            created_at: prize.won_at || prize.created_at,
            // 商品信息
            product_title: prize.lottery?.title_i18n || { zh: prize.lottery?.title || '奖品' },
            product_image: prize.lottery?.image_url || '',
            original_price: prize.prize_value || 0,
            price_per_person: prize.lottery?.ticket_price || 0,
            // 抽奖信息
            lottery_period: prize.lottery?.period || '',
            lottery_id: prize.lottery_id,
            // 物流信息
            shipping: prize.shipping?.[0] || null,
            resale_listing: prize.resale_listing?.[0] || null,
            // 自提信息
            pickup_code: prize.pickup_code || null,
            pickup_status: prize.pickup_status || 'PENDING_CLAIM',
            pickup_point: prize.pickup_point || null,
            expires_at: prize.expires_at || null,
            claimed_at: prize.claimed_at || null,
            picked_up_at: prize.picked_up_at || null,
          });
        });
      }
    }

    // 3. 获取积分兑换记录
    if (!order_type || order_type === 'all' || order_type === 'exchange') {
      console.log('[GetMyOrders] Fetching exchange records for userId:', userId);
      
      const { data: exchangeRecords, error: exchangeError } = await supabase
        .from('exchange_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (exchangeError) {
        console.error('[GetMyOrders] Exchange records error:', exchangeError);
      } else if (exchangeRecords) {
        console.log('[GetMyOrders] Found exchange records:', exchangeRecords.length);
        
        exchangeRecords.forEach((record: any) => {
          orders.push({
            id: record.id,
            order_type: 'exchange',
            order_number: `EX${record.id.slice(-8).toUpperCase()}`,
            amount: record.amount,
            status: 'COMPLETED',
            created_at: record.created_at,
            // 兑换信息
            exchange_type: record.exchange_type,
            exchange_rate: record.exchange_rate,
            currency: record.currency,
            product_title: { 
              zh: '余额兑换积分', 
              ru: 'Обмен баланса на баллы', 
              tg: 'Мубодилаи баланс ба холҳо' 
            },
            product_image: '',
          });
        });
      }
    }

    // 按时间排序
    orders.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    // 分页
    const totalCount = orders.length;
    const paginatedOrders = orders.slice(offset, offset + page_size);

    console.log('[GetMyOrders] Success, total orders:', totalCount, 'returning:', paginatedOrders.length);

    return new Response(
      JSON.stringify({
        success: true,
        data: paginatedOrders,
        pagination: {
          page,
          page_size,
          total: totalCount,
          total_pages: Math.ceil(totalCount / page_size),
        },
        summary: {
          group_buy_count: orders.filter(o => o.order_type === 'group_buy').length,
          lottery_count: orders.filter(o => o.order_type === 'lottery').length,
          exchange_count: orders.filter(o => o.order_type === 'exchange').length,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[GetMyOrders] Error:', error);
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
