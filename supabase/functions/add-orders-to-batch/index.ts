/**
 * 将订单加入批次 Edge Function
 * 
 * 功能：将选中的订单加入到指定批次
 * 权限：仅管理员可调用
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { sendBatchShippedNotification } from '../_shared/batchNotification.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderItem {
  order_id: string
  order_type: 'FULL_PURCHASE' | 'LOTTERY_PRIZE' | 'GROUP_BUY'
}

interface AddOrdersRequest {
  batch_id: string
  orders: OrderItem[]
  admin_id: string
  send_notification?: boolean
}

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body: AddOrdersRequest = await req.json()
    const { batch_id, orders, admin_id, send_notification = true } = body

    if (!batch_id || !orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少必要参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 验证批次是否存在
    const { data: batch, error: batchError } = await supabase
      .from('shipment_batches')
      .select('id, batch_no, status, estimated_arrival_date')
      .eq('id', batch_id)
      .single()

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ success: false, error: '批次不存在' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 检查批次状态
    if (batch.status !== 'IN_TRANSIT_CHINA') {
      return new Response(
        JSON.stringify({ success: false, error: '只能向运输中（中国段）的批次添加订单' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = {
      success: [] as string[],
      failed: [] as { order_id: string; error: string }[],
      notifications_sent: 0,
    }

    for (const order of orders) {
      try {
        // 获取订单详情
        let orderData: any = null
        let productName = ''
        let productNameI18n: Record<string, string> = {}
        let productImage = ''
        let productSku = ''
        let userId = ''
        let userTelegramId = ''
        let userName = ''

        if (order.order_type === 'FULL_PURCHASE') {
          const { data, error } = await supabase
            .from('full_purchase_orders')
            .select(`
              id, user_id, metadata, batch_id,
              lotteries:lottery_id (title, title_i18n, image_url, inventory_product_id),
              users:user_id (first_name, telegram_username, telegram_id)
            `)
            .eq('id', order.order_id)
            .single()

          if (error || !data) {
            results.failed.push({ order_id: order.order_id, error: '订单不存在' })
            continue
          }

          if (data.batch_id) {
            results.failed.push({ order_id: order.order_id, error: '订单已加入其他批次' })
            continue
          }

          orderData = data
          const lottery = data.lotteries as any
          const user = data.users as any
          productName = lottery?.title || data.metadata?.product_title || '未知商品'
          productNameI18n = lottery?.title_i18n || {}
          productImage = lottery?.image_url || data.metadata?.product_image
          productSku = lottery?.inventory_product_id
          userId = data.user_id
          userName = user?.first_name || user?.telegram_username
          userTelegramId = user?.telegram_id

        } else if (order.order_type === 'LOTTERY_PRIZE') {
          const { data, error } = await supabase
            .from('prizes')
            .select(`
              id, user_id, prize_name, batch_id,
              lotteries:lottery_id (title, title_i18n, image_url, inventory_product_id),
              users:user_id (first_name, telegram_username, telegram_id)
            `)
            .eq('id', order.order_id)
            .single()

          if (error || !data) {
            results.failed.push({ order_id: order.order_id, error: '订单不存在' })
            continue
          }

          if (data.batch_id) {
            results.failed.push({ order_id: order.order_id, error: '订单已加入其他批次' })
            continue
          }

          orderData = data
          const lottery = data.lotteries as any
          const user = data.users as any
          productName = lottery?.title || data.prize_name || '未知商品'
          productNameI18n = lottery?.title_i18n || {}
          productImage = lottery?.image_url
          productSku = lottery?.inventory_product_id
          userId = data.user_id
          userName = user?.first_name || user?.telegram_username
          userTelegramId = user?.telegram_id

        } else if (order.order_type === 'GROUP_BUY') {
          // 先查询拼团结果
          const { data, error } = await supabase
            .from('group_buy_results')
            .select(`
              id, winner_id, product_id, batch_id,
              group_buy_products:product_id (name, name_i18n, image_urls)
            `)
            .eq('id', order.order_id)
            .single()

          if (error || !data) {
            results.failed.push({ order_id: order.order_id, error: '订单不存在' })
            continue
          }

          if (data.batch_id) {
            results.failed.push({ order_id: order.order_id, error: '订单已加入其他批次' })
            continue
          }

          // 单独查询用户信息（因为winner_id没有外键约束）
          let user: any = null
          if (data.winner_id) {
            const { data: userData } = await supabase
              .from('users')
              .select('first_name, telegram_username, telegram_id')
              .eq('id', data.winner_id)
              .single()
            user = userData
          }

          orderData = data
          const product = data.group_buy_products as any
          
          if (product?.name_i18n) {
            productNameI18n = product.name_i18n
            productName = product.name_i18n.zh || product.name_i18n.ru || product.name || '未知商品'
          } else if (product?.name) {
            productName = product.name
          }
          productImage = product?.image_urls?.[0]
          productSku = data.product_id
          userId = data.winner_id
          userName = user?.first_name || user?.telegram_username
          userTelegramId = user?.telegram_id
        }

        // 创建批次订单关联记录
        const { error: insertError } = await supabase
          .from('batch_order_items')
          .insert({
            batch_id: batch_id,
            order_type: order.order_type,
            order_id: order.order_id,
            product_name: productName,
            product_name_i18n: productNameI18n,
            product_sku: productSku,
            product_image: productImage,
            quantity: 1,
            user_id: userId,
            user_telegram_id: userTelegramId ? parseInt(userTelegramId) : null,
            user_name: userName,
            arrival_status: 'PENDING',
          })

        if (insertError) {
          // 检查是否是唯一约束冲突
          if (insertError.code === '23505') {
            results.failed.push({ order_id: order.order_id, error: '订单已在批次中' })
          } else {
            results.failed.push({ order_id: order.order_id, error: insertError.message })
          }
          continue
        }

        // 更新订单的批次ID和物流状态
        const updateData = {
          batch_id: batch_id,
          logistics_status: 'IN_TRANSIT_CHINA',
        }

        if (order.order_type === 'FULL_PURCHASE') {
          await supabase
            .from('full_purchase_orders')
            .update(updateData)
            .eq('id', order.order_id)
        } else if (order.order_type === 'LOTTERY_PRIZE') {
          await supabase
            .from('prizes')
            .update(updateData)
            .eq('id', order.order_id)
        } else if (order.order_type === 'GROUP_BUY') {
          await supabase
            .from('group_buy_results')
            .update(updateData)
            .eq('id', order.order_id)
        }

        results.success.push(order.order_id)

        // 发送通知
        if (send_notification && userId && batch.estimated_arrival_date) {
          try {
            const sent = await sendBatchShippedNotification(
              supabase,
              userId,
              batch.batch_no,
              batch.estimated_arrival_date
            )
            if (sent) {
              results.notifications_sent++
            }
          } catch (notifyError) {
            console.error('Failed to send notification:', notifyError)
          }
        }

      } catch (error) {
        console.error('Error processing order:', order.order_id, error)
        results.failed.push({ order_id: order.order_id, error: '处理失败' })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        message: `成功添加 ${results.success.length} 个订单，失败 ${results.failed.length} 个`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: '服务器内部错误' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
