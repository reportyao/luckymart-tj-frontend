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

    // 尝试从不同的表中查询订单
    let orderType = null
    let orderData = null

    // 1. 首先尝试从 full_purchase_orders 查询
    const { data: fullPurchaseOrder, error: fullPurchaseError } = await supabase
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
      .maybeSingle()

    if (fullPurchaseOrder) {
      orderType = 'full_purchase'
      orderData = fullPurchaseOrder
    }

    // 2. 如果没找到,尝试从 prizes 查询
    if (!orderData) {
      const { data: prize, error: prizeError } = await supabase
        .from('prizes')
        .select(`
          id,
          lottery_id,
          created_at,
          status,
          logistics_status,
          pickup_code,
          pickup_status,
          claimed_at,
          batch_id,
          pickup_point_id
        `)
        .eq('id', order_id)
        .eq('user_id', user_id)
        .maybeSingle()

      if (prize) {
        orderType = 'prize'
        orderData = {
          ...prize,
          order_number: `PRIZE-${prize.id.substring(0, 8).toUpperCase()}`,
          total_amount: 0,
          currency: 'TJS',
          metadata: { type: 'prize' }
        }
      }
    }

    // 3. 如果还没找到,尝试从 group_buy_results 查询
    if (!orderData) {
      const { data: groupBuyResult, error: groupBuyError } = await supabase
        .from('group_buy_results')
        .select(`
          id,
          product_id,
          session_id,
          winner_order_id,
          created_at,
          status,
          logistics_status,
          pickup_code,
          pickup_status,
          claimed_at,
          batch_id,
          pickup_point_id
        `)
        .eq('id', order_id)
        .eq('winner_id', user_id)
        .maybeSingle()

      if (groupBuyResult) {
        orderType = 'group_buy'
        
        // 获取拼团订单金额
        let orderAmount = 0
        if (groupBuyResult.winner_order_id) {
          const { data: orderData } = await supabase
            .from('group_buy_orders')
            .select('amount')
            .eq('id', groupBuyResult.winner_order_id)
            .single()
          
          if (orderData) {
            orderAmount = orderData.amount
          }
        }

        orderData = {
          id: groupBuyResult.id,
          order_number: `GB-${groupBuyResult.session_id?.substring(0, 8).toUpperCase() || 'UNKNOWN'}`,
          status: groupBuyResult.status,
          total_amount: orderAmount,
          currency: 'TJS',
          pickup_code: groupBuyResult.pickup_code,
          claimed_at: groupBuyResult.claimed_at,
          created_at: groupBuyResult.created_at,
          metadata: { 
            type: 'group_buy',
            session_id: groupBuyResult.session_id,
            winner_order_id: groupBuyResult.winner_order_id
          },
          lottery_id: groupBuyResult.product_id,
          pickup_point_id: groupBuyResult.pickup_point_id,
          logistics_status: groupBuyResult.logistics_status,
          batch_id: groupBuyResult.batch_id
        }
      }
    }

    // 如果所有表都没找到订单
    if (!orderData) {
      return new Response(
        JSON.stringify({ 
          error: 'Order not found', 
          details: 'No order found in any table with the given ID and user ID' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 查询关联的商品信息
    let lottery = null
    if (orderData.lottery_id) {
      const tableName = orderType === 'group_buy' ? 'group_buy_products' : 'lotteries'
      const selectFields = orderType === 'group_buy' 
        ? 'id, name as title, name_i18n as title_i18n, image_url, image_urls, price_per_person as original_price'
        : 'title, title_i18n, image_url, image_urls, original_price'

      const { data: lotteryData } = await supabase
        .from(tableName)
        .select(selectFields)
        .eq('id', orderData.lottery_id)
        .single()
      
      lottery = lotteryData
    }

    // 查询自提点信息
    let pickupPoint = null
    if (orderData.pickup_point_id) {
      const { data: pointData } = await supabase
        .from('pickup_points')
        .select('name, name_i18n, address, address_i18n, contact_phone')
        .eq('id', orderData.pickup_point_id)
        .single()
      pickupPoint = pointData
    }

    // 查询批次信息
    let shipmentBatch = null
    if (orderData.batch_id) {
      const { data: batchData } = await supabase
        .from('shipment_batches')
        .select('batch_no, china_tracking_no, tajikistan_tracking_no, estimated_arrival_date, status')
        .eq('id', orderData.batch_id)
        .single()
      shipmentBatch = batchData
    }

    // 计算 pickup_status
    const pickup_status = orderData.pickup_code 
      ? (orderData.claimed_at ? 'PICKED_UP' : 'PENDING_PICKUP') 
      : orderData.status

    // 组装返回数据
    const result = {
      ...orderData,
      pickup_status,
      order_type: orderType, // 添加订单类型标识
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
