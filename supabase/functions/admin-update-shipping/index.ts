import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 管理后台: 更新发货状态
 * 需要管理员权限
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 获取用户信息
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Invalid token')
    }

    // 检查是否是管理员
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('telegram_id', user.id)
      .single()

    if (userError || !userData || userData.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required')
    }

    const {
      shippingId,
      status,
      trackingNumber,
      shippingCompany,
      shippingMethod,
      adminNotes
    } = await req.json()

    if (!shippingId || !status) {
      throw new Error('Missing required fields')
    }

    // 更新shipping记录
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (trackingNumber) updateData.tracking_number = trackingNumber
    if (shippingCompany) updateData.shipping_company = shippingCompany
    if (shippingMethod) updateData.shipping_method = shippingMethod
    if (adminNotes) updateData.admin_notes = adminNotes

    if (status === 'SHIPPED') {
      updateData.shipped_at = new Date().toISOString()
    } else if (status === 'DELIVERED') {
      updateData.delivered_at = new Date().toISOString()
    }

    const { data: shipping, error: updateError } = await supabaseClient
      .from('shipping')
      .update(updateData)
      .eq('id', shippingId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update shipping: ${updateError.message}`)
    }

    // 创建shipping历史记录
    await supabaseClient
      .from('shipping_history')
      .insert({
        shipping_id: shippingId,
        status,
        description: adminNotes || `状态更新为: ${status}`,
        operator_id: user.id,
        created_at: new Date().toISOString()
      })

    // 如果状态是SHIPPED或DELIVERED，更新prize状态
    if (status === 'SHIPPED' || status === 'DELIVERED') {
      const prizeStatus = status === 'SHIPPED' ? 'SHIPPED' : 'DELIVERED'
      await supabaseClient
        .from('prizes')
        .update({
          status: prizeStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', shipping.prize_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: shipping
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
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
