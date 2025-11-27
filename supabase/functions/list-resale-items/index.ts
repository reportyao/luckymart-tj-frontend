import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'ACTIVE'
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // 查询转售商品列表
    let query = supabaseClient
      .from('resale_items')
      .select(`
        *,
        lotteries (*),
        resales (*),
        seller:users!seller_id (
          id,
          telegram_username,
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status !== 'ALL') {
      query = query.eq('status', status)
    }

    const { data: resaleItems, error: resaleError } = await query

    if (resaleError) {
      throw new Error('获取转售商品列表失败: ' + resaleError.message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: resaleItems,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
