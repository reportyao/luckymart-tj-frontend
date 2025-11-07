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
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 获取当前用户
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('未授权')
    }

    const { amount, currency, paymentMethod, paymentProofImages, paymentReference, payerName, payerAccount } = await req.json()

    // 验证参数
    if (!amount || amount <= 0) {
      throw new Error('充值金额必须大于0')
    }

    if (!paymentMethod) {
      throw new Error('请选择支付方式')
    }

    // 生成订单号
    const orderNumber = `LM${Date.now()}`

    // 创建充值申请
    const { data: depositRequest, error: insertError } = await supabaseClient
      .from('deposit_requests')
      .insert({
        user_id: user.id,
        order_number: orderNumber,
        amount: amount,
        currency: currency || 'TJS',
        payment_method: paymentMethod,
        payment_proof_images: paymentProofImages || null,
        payment_reference: paymentReference || null,
        payer_name: payerName || null,
        payer_account: payerAccount || null,
        status: 'PENDING',
      })
      .select()
      .single()

    if (insertError) {
      console.error('创建充值申请失败:', insertError)
      throw new Error('创建充值申请失败')
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: depositRequest,
        message: '充值申请已提交,请等待审核',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('充值申请错误:', error)
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
