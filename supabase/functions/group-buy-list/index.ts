import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// 使用环境变量获取Supabase配置（移除硬编码fallback以避免连接到错误的数据库）
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Helper function to create response with CORS headers
function createResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Helper function to map database fields to frontend expected fields
function mapProductToFrontend(product: any) {
  if (!product) return null;
  
  return {
    id: product.id,
    title: product.name_i18n || { zh: product.name || '', ru: '', tg: '' },
    description: product.description_i18n || { zh: product.description || '', ru: '', tg: '' },
    image_url: product.image_url,
    images: product.image_urls || (product.image_url ? [product.image_url] : []),
    original_price: product.original_price,
    price_per_person: product.group_price, // 数据库: group_price -> 前端: price_per_person
    group_size: product.max_participants || product.min_participants, // 数据库: max_participants -> 前端: group_size
    timeout_hours: product.duration_hours, // 数据库: duration_hours -> 前端: timeout_hours
    product_type: product.status || 'ACTIVE',
    price_comparisons: product.price_comparisons || [],
    currency: product.currency || 'TJS',
    stock: product.stock,
    status: product.status,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { type, product_id, session_id, user_id } = await req.json();

    if (type === 'product') {
      // 获取单个商品信息
      if (!product_id) {
        return createResponse({ success: false, error: 'Product ID required' }, 400);
      }

      const { data: product, error } = await supabase
        .from('group_buy_products')
        .select('*')
        .eq('id', product_id)
        .eq('status', 'ACTIVE')
        .single();

      if (error) {
        return createResponse({ success: false, error: error.message }, 500);
      }

      return createResponse({ success: true, data: mapProductToFrontend(product) });
    } else if (type === 'products') {
      // 获取所有活跃的拼团商品
      const { data: products, error } = await supabase
        .from('group_buy_products')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (error) {
        return createResponse({ success: false, error: error.message }, 500);
      }

      // 为每个商品获取活跃的拼团会话数量
      const productsWithSessions = await Promise.all(
        products.map(async (product) => {
          const { data: sessions } = await supabase
            .from('group_buy_sessions')
            .select('id, current_participants, group_size, expires_at')
            .eq('product_id', product.id)
            .eq('status', 'ACTIVE')
            .gt('expires_at', new Date().toISOString());

          return {
            ...mapProductToFrontend(product),
            active_sessions: sessions || [],
            active_sessions_count: sessions?.length || 0,
          };
        })
      );

      return createResponse({ success: true, data: productsWithSessions });
    } else if (type === 'sessions') {
      // 获取指定商品的所有活跃拼团会话
      if (!product_id) {
        return createResponse({ success: false, error: 'Product ID required' }, 400);
      }

      const { data: sessions, error } = await supabase
        .from('group_buy_sessions')
        .select(`
          *,
          product:group_buy_products(*),
          orders:group_buy_orders(id, user_id, created_at)
        `)
        .eq('product_id', product_id)
        .eq('status', 'ACTIVE')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        return createResponse({ success: false, error: error.message }, 500);
      }

      // 获取所有参与者的用户信息
      const allUserIds = new Set<string>();
      sessions?.forEach((session: any) => {
        session.orders?.forEach((order: any) => {
          if (order.user_id) allUserIds.add(order.user_id);
        });
      });

      // 查询用户信息（同时支持 id 和 telegram_id 匹配）
      let usersMap: Record<string, any> = {};
      if (allUserIds.size > 0) {
        const userIdArray = Array.from(allUserIds);
        
        // 先尝试用 id 匹配（UUID）
        const { data: usersByUuid } = await supabase
          .from('users')
          .select('id, telegram_id, telegram_username, first_name, last_name, avatar_url')
          .in('id', userIdArray);
        
        // 再尝试用 telegram_id 匹配
        const { data: usersByTelegramId } = await supabase
          .from('users')
          .select('id, telegram_id, telegram_username, first_name, last_name, avatar_url')
          .in('telegram_id', userIdArray);
        
        // 合并结果
        usersByUuid?.forEach((u: any) => {
          usersMap[u.id] = u;
        });
        usersByTelegramId?.forEach((u: any) => {
          usersMap[u.telegram_id] = u;
        });
      }

      // 将用户信息添加到订单中
      const sessionsWithUsers = sessions?.map((session: any) => ({
        ...session,
        orders: session.orders?.map((order: any) => ({
          ...order,
          users: usersMap[order.user_id] || null,
        })),
      }));

      return createResponse({ success: true, data: sessionsWithUsers });
    } else if (type === 'session-result') {
      // 获取拼团会话的开奖结果
      if (!session_id) {
        return createResponse({ success: false, error: 'Session ID required' }, 400);
      }

      const { data: result, error: resultError } = await supabase
        .from('group_buy_results')
        .select(`
          *,
          session:group_buy_sessions(*),
          product:group_buy_products(*),
          pickup_point:pickup_points(
            id,
            name,
            name_i18n,
            address,
            address_i18n,
            contact_phone
          )
        `)
        .eq('session_id', session_id)
        .single();

      if (resultError) {
        return createResponse({ success: false, error: resultError.message }, 500);
      }

      // 获取所有参与者订单
      const { data: orders, error: ordersError } = await supabase
        .from('group_buy_orders')
        .select('user_id, order_number, order_timestamp, created_at')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true });

      if (ordersError) {
        return createResponse({ success: false, error: ordersError.message }, 500);
      }

      // 获取参与者的用户信息
      const userIds = orders?.map(o => o.user_id) || [];
      const { data: users } = await supabase
        .from('users')
        .select('telegram_id, telegram_username, first_name, last_name')
        .in('telegram_id', userIds);

      // 合并用户信息到订单
      const participants = orders?.map(order => {
        const user = users?.find(u => u.telegram_id === order.user_id);
        return {
          user_id: order.user_id,
          username: user?.telegram_username || user?.first_name || `User ${order.user_id.slice(-4)}`,
          order_number: order.order_number,
          created_at: order.created_at,
        };
      }) || [];

      // 获取中奖者用户名
      const winner = users?.find(u => u.telegram_id === result.winner_id);
      const winnerUsername = winner?.telegram_username || winner?.first_name || `User ${result.winner_id?.slice(-4) || 'Unknown'}`;

      return createResponse({ 
        success: true, 
        data: { 
          ...result, 
          winner_username: winnerUsername,
          participants,
          product: result.product ? mapProductToFrontend(result.product) : null,
        } 
      });
    } else if (type === 'my-orders') {
      // 获取用户的拼团订单
      if (!user_id) {
        return createResponse({ success: false, error: 'User ID required' }, 400);
      }

      const { data: orders, error } = await supabase
        .from('group_buy_orders')
        .select(`
          *,
          session:group_buy_sessions(*),
          product:group_buy_products(*)
        `)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      if (error) {
        return createResponse({ success: false, error: error.message }, 500);
      }

      // Map products to frontend format
      const mappedOrders = orders?.map(order => ({
        ...order,
        product: order.product ? mapProductToFrontend(order.product) : null,
      })) || [];

      return createResponse({ success: true, data: mappedOrders });
    } else {
      return createResponse({ success: false, error: 'Invalid type parameter' }, 400);
    }
  } catch (error) {
    console.error('Group buy list error:', error);
    return createResponse({ success: false, error: error.message }, 500);
  }
});
