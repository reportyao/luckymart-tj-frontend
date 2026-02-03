/**
 * TezBarakat 管理员通知系统 - 飞书发送器
 * 
 * 功能: 将通知消息发送到飞书群机器人
 * 支持: 纯文本消息 和 交互式卡片消息
 * 
 * @author Manus AI
 * @version 1.0.0
 * @date 2026-02-03
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 事件类型到卡片颜色的映射
const EVENT_TYPE_COLORS: Record<string, string> = {
  'new_deposit_request': 'blue',      // 充值 - 蓝色
  'new_withdrawal_request': 'orange', // 提现 - 橙色
  'new_group_buy_join': 'green',      // 拼团 - 绿色
  'new_lottery_purchase': 'purple',   // 积分商城 - 紫色
}

// 事件类型到标题的映射
const EVENT_TYPE_TITLES: Record<string, string> = {
  'new_deposit_request': '🔔 充值审核提醒',
  'new_withdrawal_request': '💰 提现审核提醒',
  'new_group_buy_join': '🛒 拼团动态',
  'new_lottery_purchase': '🎰 积分商城动态',
}

interface FeishuRequest {
  webhook_url: string
  message: string
  event_type?: string
  event_data?: Record<string, any>
  use_card?: boolean  // 是否使用卡片消息
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[admin-dispatch-feishu] 收到发送请求')

  try {
    const { webhook_url, message, event_type, event_data, use_card }: FeishuRequest = await req.json()

    if (!webhook_url) {
      throw new Error('Missing webhook_url')
    }

    if (!message) {
      throw new Error('Missing message')
    }

    console.log('[admin-dispatch-feishu] Webhook URL:', webhook_url.substring(0, 50) + '...')
    console.log('[admin-dispatch-feishu] 事件类型:', event_type)

    // 构建飞书消息体
    let payload: any

    // 对于充值和提现审核，使用交互式卡片（如果需要）
    if (use_card && event_type && ['new_deposit_request', 'new_withdrawal_request'].includes(event_type)) {
      payload = buildInteractiveCard(message, event_type, event_data)
    } else {
      // 默认使用富文本消息
      payload = buildRichTextMessage(message, event_type)
    }

    console.log('[admin-dispatch-feishu] 发送消息类型:', payload.msg_type)

    // 发送到飞书
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    // 飞书返回 code: 0 表示成功
    if (result.code !== 0 && result.StatusCode !== 0) {
      console.error('[admin-dispatch-feishu] 飞书返回错误:', result)
      return new Response(
        JSON.stringify({
          success: false,
          error: result.msg || result.StatusMessage || 'Feishu API error',
          response: result,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[admin-dispatch-feishu] 发送成功')

    return new Response(
      JSON.stringify({
        success: true,
        response: result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-dispatch-feishu] 错误:', error.message)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * 构建富文本消息
 */
function buildRichTextMessage(message: string, eventType?: string): any {
  // 将消息按行分割，转换为飞书富文本格式
  const lines = message.split('\n')
  const content: any[][] = []

  for (const line of lines) {
    if (line.trim()) {
      // 检查是否是链接行
      const linkMatch = line.match(/https?:\/\/[^\s]+/)
      if (linkMatch) {
        const beforeLink = line.substring(0, line.indexOf(linkMatch[0]))
        content.push([
          { tag: 'text', text: beforeLink },
          { tag: 'a', text: linkMatch[0], href: linkMatch[0] },
        ])
      } else {
        content.push([{ tag: 'text', text: line }])
      }
    } else {
      // 空行
      content.push([{ tag: 'text', text: '' }])
    }
  }

  return {
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title: EVENT_TYPE_TITLES[eventType || ''] || '📢 TezBarakat 通知',
          content: content,
        },
      },
    },
  }
}

/**
 * 构建交互式卡片消息 (用于需要审核的事件)
 */
function buildInteractiveCard(
  message: string,
  eventType: string,
  eventData?: Record<string, any>
): any {
  const title = EVENT_TYPE_TITLES[eventType] || '📢 TezBarakat 通知'
  const color = EVENT_TYPE_COLORS[eventType] || 'blue'

  // 解析消息内容，提取关键信息
  const elements: any[] = []

  // 添加消息内容
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: message.replace(/\n/g, '\n'),
    },
  })

  // 添加分割线
  elements.push({ tag: 'hr' })

  // 添加操作按钮 (仅用于充值和提现)
  if (eventType === 'new_deposit_request' || eventType === 'new_withdrawal_request') {
    elements.push({
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '📋 前往后台处理',
          },
          type: 'primary',
          url: 'https://tezbarakat.com/admin',
        },
      ],
    })
  }

  // 添加备注
  elements.push({
    tag: 'note',
    elements: [
      {
        tag: 'plain_text',
        content: `TezBarakat 管理系统 · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Dushanbe' })}`,
      },
    ],
  })

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: title,
        },
        template: color,
      },
      elements: elements,
    },
  }
}
