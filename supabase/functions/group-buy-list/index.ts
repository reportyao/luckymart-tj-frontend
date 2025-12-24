import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://owyitxwxmxwbkqgzffdw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'products'; // products, sessions, my-orders

    if (type === 'products') {
      // 获取所有活跃的拼团商品
      const { data: products, error } = await supabase
        .from('group_buy_products')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 为每个商品获取活跃的拼团会话数量
      const productsWithSessions = await Promise.all(
        products.map(async (product) => {
          const { data: sessions } = await supabase
            .from('group_buy_sessions')
            .select('id, current_participants, max_participants, expires_at')
            .eq('product_id', product.id)
            .eq('status', 'ACTIVE')
            .gt('expires_at', new Date().toISOString());

          return {
            ...product,
            active_sessions: sessions || [],
            active_sessions_count: sessions?.length || 0,
          };
        })
      );

      return new Response(
        JSON.stringify({ success: true, data: productsWithSessions }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else if (type === 'sessions') {
      // 获取指定商品的所有活跃拼团会话
      const productId = url.searchParams.get('product_id');
      if (!productId) {
        return new Response(JSON.stringify({ success: false, error: 'Product ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { data: sessions, error } = await supabase
        .from('group_buy_sessions')
        .select(`
          *,
          product:group_buy_products(*),
          orders:group_buy_orders(id, user_id, created_at)
        `)
        .eq('product_id', productId)
        .eq('status', 'ACTIVE')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ success: true, data: sessions }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else if (type === 'my-orders') {
      // 获取用户的拼团订单
      const userId = url.searchParams.get('user_id');
      if (!userId) {
        return new Response(JSON.stringify({ success: false, error: 'User ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { data: orders, error } = await supabase
        .from('group_buy_orders')
        .select(`
          *,
          session:group_buy_sessions(*),
          product:group_buy_products(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ success: true, data: orders }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Invalid type parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Group buy list error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
