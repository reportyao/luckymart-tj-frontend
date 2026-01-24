import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { order_id, order_type, pickup_point_id, user_id } = await req.json()

    if (!order_id || !pickup_point_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 验证自提点是否启用
    const { data: pickupPoint, error: pickupPointError } = await supabase
      .from('pickup_points')
      .select('id, is_active')
      .eq('id', pickup_point_id)
      .single()

    if (pickupPointError || !pickupPoint) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid pickup point' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pickupPoint.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pickup point is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 根据订单类型更新不同的表
    let tableName = 'prizes'
    if (order_type === 'full_purchase') {
      tableName = 'full_purchase_orders'
    } else if (order_type === 'group_buy') {
      tableName = 'group_buy_results'
    }

    // 验证订单所有权
    const ownerField = order_type === 'group_buy' ? 'winner_id' : 'user_id'
    const { data: orderCheck } = await supabase
      .from(tableName)
      .select('id')
      .eq('id', order_id)
      .eq(ownerField, user_id)
      .single()

    if (!orderCheck) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 更新自提点
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ pickup_point_id })
      .eq('id', order_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
