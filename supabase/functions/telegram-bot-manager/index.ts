// Telegram Bot 管理器
// 设置 Bot webhook，管理命令菜单，提供管理功能

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface BotCommand {
  command: string;
  description: string;
}

// Bot 命令菜单配置
const botCommands: BotCommand[] = [
  { command: "start", description: "开始使用" },
  { command: "help", description: "帮助信息" },
  { command: "balance", description: "查看钱包余额" },
  { command: "tickets", description: "查看我的彩票" },
  { command: "history", description: "交易历史" },
  { command: "withdraw", description: "提现申请" },
  { command: "deposit", description: "充值说明" },
  { command: "referral", description: "推广信息" },
  { command: "language", description: "切换语言" },
  { command: "support", description: "客服支持" }
];

// 调用 Telegram Bot API
async function callTelegramAPI(method: string, params: any, botToken: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${result.description || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    console.error(`Error calling Telegram API ${method}:`, error);
    throw error;
  }
}

// 设置 Webhook
async function setWebhook(botToken: string, webhookUrl: string) {
  return await callTelegramAPI('setWebhook', {
    url: webhookUrl,
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query']
  }, botToken);
}

// 删除 Webhook
async function deleteWebhook(botToken: string) {
  return await callTelegramAPI('deleteWebhook', {
    drop_pending_updates: true
  }, botToken);
}

// 获取 Webhook 信息
async function getWebhookInfo(botToken: string) {
  return await callTelegramAPI('getWebhookInfo', {}, botToken);
}

// 设置 Bot 命令菜单
async function setBotCommands(botToken: string, commands: BotCommand[]) {
  return await callTelegramAPI('setMyCommands', {
    commands: commands
  }, botToken);
}

// 获取 Bot 信息
async function getBotInfo(botToken: string) {
  return await callTelegramAPI('getMe', {}, botToken);
}

// 发送测试消息
async function sendTestMessage(botToken: string, chatId: number) {
  const testMessage = `🤖 LuckyMartTJ Bot 测试消息

✅ Bot 已成功配置！
🕐 时间: ${new Date().toLocaleString('zh-CN')}

功能状态:
• Webhook: 已配置
• 命令菜单: 已设置
• 通知系统: 正常运行

输入 /help 查看所有可用命令。`;

  return await callTelegramAPI('sendMessage', {
    chat_id: chatId,
    text: testMessage,
    parse_mode: 'HTML'
  }, botToken);
}

// 创建通知到队列
async function createNotification(
  supabase: any,
  userId: string,
  telegramChatId: number,
  notificationType: string,
  title: string,
  message: string,
  data: any = {},
  priority: number = 2
) {
  try {
    const { error } = await supabase
      .from('notification_queue')
      .insert({
        user_id: userId,
        telegram_chat_id: telegramChatId,
        notification_type: notificationType,
        title: title,
        message: message,
        data: data,
        priority: priority
      });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
}

// 获取 Bot 统计信息
async function getBotStats(supabase: any) {
  try {
    // 获取 Bot 用户数量
    const { count: totalUsers } = await supabase
      .from('bot_user_settings')
      .select('*', { count: 'exact', head: true });

    // 获取今日消息数量
    const today = new Date().toISOString().split('T')[0];
    const { count: todayMessages } = await supabase
      .from('bot_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    // 获取待发送通知数量
    const { count: pendingNotifications } = await supabase
      .from('notification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // 获取最常用命令
    const { data: topCommands } = await supabase
      .from('bot_command_stats')
      .select('command, usage_count')
      .order('usage_count', { ascending: false })
      .limit(5);

    // 获取活跃用户 (最近7天)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: activeUsers } = await supabase
      .from('bot_messages')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    return {
      totalUsers: totalUsers || 0,
      todayMessages: todayMessages || 0,
      pendingNotifications: pendingNotifications || 0,
      activeUsers: activeUsers || 0,
      topCommands: topCommands || []
    };
  } catch (error) {
    console.error('Error getting bot stats:', error);
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8074258399:AAG1WdyCJe4vphx9YB3B6z60nTE3dhBBP-Q';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop() || '';

    // 获取请求体
    let requestData = {};
    try {
      requestData = await req.json();
    } catch {
      // 忽略无法解析的请求体
    }

    switch (action) {
      case 'setup': {
        // 完整设置 Bot
        const webhookUrl = `${supabaseUrl}/functions/v1/telegram-bot-webhook`;
        
        try {
          // 1. 设置 Webhook
          const webhookResult = await setWebhook(botToken, webhookUrl);
          console.log('Webhook setup result:', webhookResult);

          // 2. 设置命令菜单
          const commandsResult = await setBotCommands(botToken, botCommands);
          console.log('Commands setup result:', commandsResult);

          // 3. 获取 Bot 信息
          const botInfo = await getBotInfo(botToken);
          console.log('Bot info:', botInfo);

          return new Response(JSON.stringify({
            success: true,
            message: 'Bot setup completed successfully',
            data: {
              webhook: webhookResult,
              commands: commandsResult,
              botInfo: botInfo
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
           }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })        }
        break;
      }

      case 'webhook-info': {
        // 获取 Webhook 信息
        try {
          const webhookInfo = await getWebhookInfo(botToken);
          return new Response(JSON.stringify({
            success: true,
            data: webhookInfo
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        break;
      }

      case 'delete-webhook': {
        // 删除 Webhook
        try {
          const result = await deleteWebhook(botToken);
          return new Response(JSON.stringify({
            success: true,
            data: result
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        break;
      }

      case 'test-message': {
        // 发送测试消息
        const { chatId } = requestData as { chatId: number };
        
        if (!chatId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'chatId is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const result = await sendTestMessage(botToken, chatId);
          return new Response(JSON.stringify({
            success: true,
            data: result
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        break;
      }

      case 'create-notification': {
        // 创建通知
        const {
          userId,
          telegramChatId,
          notificationType,
          title,
          message,
          data,
          priority
        } = requestData as {
          userId: string;
          telegramChatId: number;
          notificationType: string;
          title: string;
          message: string;
          data?: any;
          priority?: number;
        };

        if (!userId || !telegramChatId || !notificationType || !title || !message) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const notificationResult = await createNotification(
          supabase,
          userId,
          telegramChatId,
          notificationType,
          title,
          message,
          data || {},
          priority || 2
        );

        return new Response(JSON.stringify(notificationResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        break;
      }

      case 'stats': {
        // 获取 Bot 统计信息
        const stats = await getBotStats(supabase);
        
        return new Response(JSON.stringify({
          success: true,
          data: stats
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        break;
      }

      case 'bot-info': {
        // 获取 Bot 基本信息
        try {
          const botInfo = await getBotInfo(botToken);
          return new Response(JSON.stringify({
            success: true,
            data: botInfo
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        break;
      }

      default:
        // 默认返回可用操作列表
        return new Response(JSON.stringify({
          success: true,
          message: 'Telegram Bot Manager',
          availableActions: [
            'setup - 完整设置Bot (webhook + commands)',
            'webhook-info - 获取webhook信息', 
            'delete-webhook - 删除webhook',
            'test-message - 发送测试消息',
            'create-notification - 创建通知',
            'stats - 获取Bot统计信息',
            'bot-info - 获取Bot基本信息'
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Bot manager error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});