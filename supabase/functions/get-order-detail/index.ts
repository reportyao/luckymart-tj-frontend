import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 创建单例 Supabase 客户端(复用连接,提升性能)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,
  },
})

// 缓存配置 - 使用30秒缓存(更安全,减少数据不一致风险)
const CACHE_TTL = 30 * 1000 // 30秒缓存
const MAX_CACHE_SIZE = 500 // 最大缓存条目数
const cache = new Map<string, { data: unknown; timestamp: number }>()

// 缓存辅助函数 - 获取缓存
function getCached(key: string): unknown | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  // 过期则删除
  if (cached) {
    cache.delete(key)
  }
  return null
}

// 缓存辅助函数 - 设置缓存(带LRU淘汰)
function setCache(key: string, data: unknown): void {
  // LRU淘汰:如果缓存满了,删除最旧的条目
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }
  cache.set(key, { data, timestamp: Date.now() })
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 解析请求体
    let requestBody: { order_id?: string; user_id?: string }
    try {
      requestBody = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { order_id, user_id } = requestBody

    if (!order_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id or user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 检查缓存
    const cacheKey = `order:${user_id}:${order_id}`
    const cachedResult = getCached(cacheKey)
    if (cachedResult) {
      return new Response(
        JSON.stringify(cachedResult),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Cache': 'HIT' // 标记缓存命中
          } 
        }
      )
    }

    // 尝试从不同的表中查询订单
    let orderType: string | null = null
    let orderData: Record<string, unknown> | null = null

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

    if (fullPurchaseError) {
      console.error('Error querying full_purchase_orders:', fullPurchaseError)
    }

    if (fullPurchaseOrder) {
      orderType = 'full_purchase'
      orderData = fullPurchaseOrder as Record<string, unknown>
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

      if (prizeError) {
        console.error('Error querying prizes:', prizeError)
      }

      if (prize) {
        orderType = 'prize'
        const prizeData = prize as Record<string, unknown>
        orderData = {
          ...prizeData,
          order_number: `PRIZE-${(prizeData.id as string).substring(0, 8).toUpperCase()}`,
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

      if (groupBuyError) {
        console.error('Error querying group_buy_results:', groupBuyError)
      }

      if (groupBuyResult) {
        orderType = 'group_buy'
        const gbResult = groupBuyResult as Record<string, unknown>
        
        // 获取拼团订单金额
        let orderAmount = 0
        if (gbResult.winner_order_id) {
          const { data: gbOrderData, error: gbOrderError } = await supabase
            .from('group_buy_orders')
            .select('amount')
            .eq('id', gbResult.winner_order_id)
            .maybeSingle()
          
          if (gbOrderError) {
            console.error('Error querying group_buy_orders:', gbOrderError)
          }
          
          if (gbOrderData) {
            orderAmount = (gbOrderData as Record<string, unknown>).amount as number
          }
        }

        const sessionId = gbResult.session_id as string | null
        orderData = {
          id: gbResult.id,
          order_number: `GB-${sessionId?.substring(0, 8).toUpperCase() || 'UNKNOWN'}`,
          status: gbResult.status,
          total_amount: orderAmount,
          currency: 'TJS',
          pickup_code: gbResult.pickup_code,
          claimed_at: gbResult.claimed_at,
          created_at: gbResult.created_at,
          metadata: { 
            type: 'group_buy',
            session_id: gbResult.session_id,
            winner_order_id: gbResult.winner_order_id
          },
          lottery_id: gbResult.product_id,
          pickup_point_id: gbResult.pickup_point_id,
          logistics_status: gbResult.logistics_status,
          batch_id: gbResult.batch_id
        }
      }
    }

    // 如果所有表都没找到订单
    if (!orderData) {
      // 缓存404结果,防止缓存穿透(缓存时间较短:10秒)
      const notFoundResult = { 
        error: 'Order not found', 
        details: 'No order found in any table with the given ID and user ID' 
      }
      return new Response(
        JSON.stringify(notFoundResult),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 并行查询关联数据(使用 Promise.all 提升性能)
    const [lotteryData, pickupPointData, shipmentBatchData] = await Promise.all([
      // 查询商品信息
      orderData.lottery_id ? (async () => {
        const tableName = orderType === 'group_buy' ? 'group_buy_products' : 'lotteries'
        const selectFields = orderType === 'group_buy' 
          ? 'id, name as title, name_i18n as title_i18n, image_url, image_urls, price_per_person as original_price'
          : 'title, title_i18n, image_url, image_urls, original_price'

        const { data, error } = await supabase
          .from(tableName)
          .select(selectFields)
          .eq('id', orderData!.lottery_id)
          .maybeSingle()
        
        if (error) {
          console.error(`Error querying ${tableName}:`, error)
        }
        return data
      })() : Promise.resolve(null),

      // 查询自提点信息
      orderData.pickup_point_id ? (async () => {
        const { data, error } = await supabase
          .from('pickup_points')
          .select('name, name_i18n, address, address_i18n, contact_phone')
          .eq('id', orderData!.pickup_point_id)
          .maybeSingle()
        
        if (error) {
          console.error('Error querying pickup_points:', error)
        }
        return data
      })() : Promise.resolve(null),

      // 查询批次信息
      orderData.batch_id ? (async () => {
        const { data, error } = await supabase
          .from('shipment_batches')
          .select('batch_no, china_tracking_no, tajikistan_tracking_no, estimated_arrival_date, status')
          .eq('id', orderData!.batch_id)
          .maybeSingle()
        
        if (error) {
          console.error('Error querying shipment_batches:', error)
        }
        return data
      })() : Promise.resolve(null),
    ])

    // 计算 pickup_status
    const pickup_status = orderData.pickup_code 
      ? (orderData.claimed_at ? 'PICKED_UP' : 'PENDING_PICKUP') 
      : orderData.status

    // 组装返回数据
    const result = {
      ...orderData,
      pickup_status,
      order_type: orderType, // 添加订单类型标识
      lotteries: lotteryData,
      pickup_point: pickupPointData,
      shipment_batch: shipmentBatchData
    }

    // 缓存结果
    setCache(cacheKey, result)

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache': 'MISS' // 标记缓存未命中
        } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
