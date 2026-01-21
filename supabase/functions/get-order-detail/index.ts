import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 创建 Supabase 客户端（使用 service_role key 绕过 RLS）
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 解析请求体
    const { order_id, user_id } = await req.json()

    if (!order_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id or user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 查询订单详情
    const { data: order, error: orderError } = await supabase
      .from('full_purchase_orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        currency,
        pickup_code,
        claimed_at,
        created_at,
        metadata,
        lottery_id,
        pickup_point_id,
        logistics_status,
        batch_id
      `)
      .eq('id', order_id)
      .eq('user_id', user_id)
      .single()

    if (orderError) {
      console.error('Error fetching order:', orderError)
      return new Response(
        JSON.stringify({ error: 'Order not found', details: orderError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 查询关联的抽奖商品信息
    let lottery = null
    if (order.lottery_id) {
      const { data: lotteryData } = await supabase
        .from('lotteries')
        .select('title, title_i18n, image_url, image_urls, original_price')
        .eq('id', order.lottery_id)
        .single()
      lottery = lotteryData
    }

    // 查询自提点信息（只查询启用的自提点）
    let pickupPoint = null
    if (order.pickup_point_id) {
      const { data: pointData } = await supabase
        .from('pickup_points')
        .select('name, name_i18n, address, address_i18n, contact_phone, status')
        .eq('id', order.pickup_point_id)
        .eq('status', 'ACTIVE')  // 只查询启用的自提点
        .single()
      pickupPoint = pointData
    }

    // 查询批次信息
    let shipmentBatch = null
    if (order.batch_id) {
      const { data: batchData } = await supabase
        .from('shipment_batches')
        .select('batch_no, china_tracking_no, tajikistan_tracking_no, estimated_arrival_date, status')
        .eq('id', order.batch_id)
        .single()
      shipmentBatch = batchData
    }

    // 计算 pickup_status
    const pickup_status = order.pickup_code 
      ? (order.claimed_at ? 'PICKED_UP' : 'PENDING_PICKUP') 
      : order.status

    // 组装返回数据
    const result = {
      ...order,
      pickup_status,
      lotteries: lottery,
      pickup_point: pickupPoint,
      shipment_batch: shipmentBatch
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
