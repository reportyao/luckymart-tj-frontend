// Telegram Bot 通知发送器
// 处理通知队列并发送通知给用户

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NotificationData {
  lottery_id?: string;
  lottery_title?: string;
  winning_number?: string;
  prize_amount?: number;
  transaction_amount?: number;
  transaction_type?: string;
  referral_amount?: number;
  ticket_number?: string;
}

// 多语言通知模板
const notificationTemplates = {
  // 彩票相关通知
  lottery_win: {
    zh: (data: NotificationData) => 
      `🎉 恭喜中奖！\n\n🎫 彩票: ${data.lottery_title}\n🎯 中奖号码: ${data.winning_number}\n💰 奖金: ${data.prize_amount}元\n\n奖金已自动发放到您的余额钱包！`,
    ru: (data: NotificationData) => 
      `🎉 Поздравляем с выигрышем!\n\n🎫 Лотерея: ${data.lottery_title}\n🎯 Выигрышный номер: ${data.winning_number}\n💰 Приз: ${data.prize_amount} сом\n\nПриз автоматически зачислен на ваш основной кошелек!`,
    tg: (data: NotificationData) => 
      `🎉 Муборак бо бурдан!\n\n🎫 Лотерея: ${data.lottery_title}\n🎯 Рақами бурдан: ${data.winning_number}\n💰 Ҷоиза: ${data.prize_amount} сомонӣ\n\nҶоиза ба ҳамёни асосии шумо худкор гузошта шуд!`
  },
  lottery_lost: {
    zh: (data: NotificationData) => 
      `😔 很遗憾未中奖\n\n🎫 彩票: ${data.lottery_title}\n🎯 开奖号码: ${data.winning_number}\n🎫 您的号码: ${data.ticket_number}\n\n不要气馁，继续参与更多夺宝！`,
    ru: (data: NotificationData) => 
      `😔 К сожалению, вы не выиграли\n\n🎫 Лотерея: ${data.lottery_title}\n🎯 Выигрышный номер: ${data.winning_number}\n🎫 Ваш номер: ${data.ticket_number}\n\nНе расстраивайтесь, участвуйте в новых розыгрышах!`,
    tg: (data: NotificationData) => 
      `😔 Мутаассифона шумо набурдед\n\n🎫 Лотерея: ${data.lottery_title}\n🎯 Рақами бурдан: ${data.winning_number}\n🎫 Рақами шумо: ${data.ticket_number}\n\nДилгир нашавед, дар бахтозмоиҳои нав иштирок кунед!`
  },
  lottery_draw_soon: {
    zh: (data: NotificationData) => 
      `⏰ 即将开奖提醒\n\n🎫 ${data.lottery_title}\n🎫 您的号码: ${data.ticket_number}\n⏱️ 10分钟后开奖\n\n准备好见证激动人心的时刻！`,
    ru: (data: NotificationData) => 
      `⏰ Напоминание о скором розыгрыше\n\n🎫 ${data.lottery_title}\n🎫 Ваш номер: ${data.ticket_number}\n⏱️ Розыгрыш через 10 минут\n\nПриготовьтесь к захватывающему моменту!`,
    tg: (data: NotificationData) => 
      `⏰ Эслотдиҳӣ дар бораи бахтозмоии наздик\n\n🎫 ${data.lottery_title}\n🎫 Рақами шумо: ${data.ticket_number}\n⏱️ Баъд аз 10 дақиқа бахтозмоӣ\n\nБарои лаҳзаи ҳаяҷонангез омода шавед!`
  },

  // 钱包相关通知
  wallet_deposit: {
    zh: (data: NotificationData) => 
      `💰 充值成功\n\n💵 金额: +${data.transaction_amount}元\n🕒 时间: ${new Date().toLocaleString('zh-CN')}\n\n您的余额已更新，可以继续参与夺宝！`,
    ru: (data: NotificationData) => 
      `💰 Пополнение успешно\n\n💵 Сумма: +${data.transaction_amount} сом\n🕒 Время: ${new Date().toLocaleString('ru-RU')}\n\nВаш баланс обновлен, можете продолжать участие в розыгрышах!`,
    tg: (data: NotificationData) => 
      `💰 Пурсозӣ муваффақият\n\n💵 Маблағ: +${data.transaction_amount} сомонӣ\n🕒 Вақт: ${new Date().toLocaleString('tg-TJ')}\n\nБоқимондаи шумо навсозӣ шуд, метавонед дар бахтозмоӣ идома диҳед!`
  },
  wallet_withdraw_pending: {
    zh: (data: NotificationData) => 
      `⏳ 提现申请已提交\n\n💵 金额: ${data.transaction_amount}元\n📝 状态: 审核中\n\n我们将在24小时内处理您的提现申请。`,
    ru: (data: NotificationData) => 
      `⏳ Заявка на вывод подана\n\n💵 Сумма: ${data.transaction_amount} сом\n📝 Статус: На рассмотрении\n\nМы обработаем вашу заявку в течение 24 часов.`,
    tg: (data: NotificationData) => 
      `⏳ Дархости баровардан пешниҳод шуд\n\n💵 Маблағ: ${data.transaction_amount} сомонӣ\n📝 Ҳолат: Дар баррасӣ\n\nМо дархости шуморо дар давоми 24 соат коркард мекунем.`
  },
  wallet_withdraw_completed: {
    zh: (data: NotificationData) => 
      `✅ 提现完成\n\n💵 金额: ${data.transaction_amount}元\n✅ 状态: 已到账\n\n资金已成功转至您的账户！`,
    ru: (data: NotificationData) => 
      `✅ Вывод завершен\n\n💵 Сумма: ${data.transaction_amount} сом\n✅ Статус: Зачислено\n\nСредства успешно переведены на ваш счет!`,
    tg: (data: NotificationData) => 
      `✅ Баровардан анҷом ёфт\n\n💵 Маблағ: ${data.transaction_amount} сомонӣ\n✅ Ҳолат: Гузошта шуд\n\nМаблағ ба ҳисоби шумо муваффақият гузошта шуд!`
  },

  // 推荐奖励通知
  referral_reward: {
    zh: (data: NotificationData) => 
      `🎁 推荐奖励到账\n\n💰 奖励金额: +${data.referral_amount}元\n👥 来源: 好友邀请奖励\n\n感谢您推广LuckyMartTJ！`,
    ru: (data: NotificationData) => 
      `🎁 Реферальная награда получена\n\n💰 Размер награды: +${data.referral_amount} сом\n👥 Источник: Награда за приглашение друзей\n\nСпасибо за продвижение LuckyMartTJ!`,
    tg: (data: NotificationData) => 
      `🎁 Ҷоизаи реферал дарёфт\n\n💰 Андозаи ҷоиза: +${data.referral_amount} сомонӣ\n👥 Манбаъ: Ҷоизаи таклифи дӯстон\n\nТашаккур барои таблиғи LuckyMartTJ!`
  },

  // 系统通知
  system_maintenance: {
    zh: () => 
      `🔧 系统维护通知\n\n⏰ 维护时间: 今晚 02:00-04:00\n🛠️ 内容: 系统升级优化\n\n维护期间暂停服务，感谢理解！`,
    ru: () => 
      `🔧 Уведомление о техническом обслуживании\n\n⏰ Время: сегодня 02:00-04:00\n🛠️ Содержание: Обновление и оптимизация системы\n\nВо время обслуживания сервис приостановлен, спасибо за понимание!`,
    tg: () => 
      `🔧 Огоҳии таъмироти техникӣ\n\n⏰ Вақт: имшаб 02:00-04:00\n🛠️ Мундариҷа: Навсозӣ ва беҳтарсозии система\n\nДар вақти таъмирот хидмот таваққуф карда мешавад, ташаккур барои фаҳмиш!`
  },
  system_update: {
    zh: () => 
      `🆕 功能更新\n\n✨ 新增功能:\n• 优化夺宝体验\n• 提升转账速度\n• 增强安全防护\n\n立即体验新功能！`,
    ru: () => 
      `🆕 Обновление функций\n\n✨ Новые возможности:\n• Улучшенный опыт розыгрышей\n• Повышенная скорость переводов\n• Усиленная защита\n\nОпробуйте новые функции прямо сейчас!`,
    tg: () => 
      `🆕 Навсозии функсияҳо\n\n✨ Имкониятҳои нав:\n• Таҷрибаи беҳтари бахтозмоӣ\n• Суръати баланди интиқол\n• Ҳифзи мустаҳкам\n\nФунксияҳои навро ҳозир санҷед!`
  }
};

// 发送消息到 Telegram
async function sendTelegramMessage(
  chatId: number, 
  text: string, 
  botToken: string,
  parseMode: string = 'HTML'
): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Telegram API error:', result);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

// 检查用户的静默时间设置
function isQuietTime(settings: any): boolean {
  if (!settings.quiet_hours_start || !settings.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  
  // 简单的时间比较 (可以进一步优化考虑跨天情况)
  const start = settings.quiet_hours_start;
  const end = settings.quiet_hours_end;
  
  if (start < end) {
    return currentTime >= start && currentTime <= end;
  } else {
    // 跨天的情况
    return currentTime >= start || currentTime <= end;
  }
}

// 格式化通知文本
function formatNotificationText(
  notificationType: string,
  language: string,
  data: NotificationData
): string {
  const template = notificationTemplates[notificationType as keyof typeof notificationTemplates];
  
  if (!template) {
    return `通知: ${JSON.stringify(data)}`;
  }

  const formatter = template[language as keyof typeof template] || template['zh'];
  
  if (typeof formatter === 'function') {
    return formatter(data);
  }
  
  return `通知: ${notificationType}`;
}

// 处理单个通知
async function processNotification(supabase: any, notification: any, botToken: string) {
  try {
    // 获取用户的Bot设置
    const { data: settings } = await supabase
      .from('bot_user_settings')
      .select('*')
      .eq('telegram_chat_id', notification.telegram_chat_id)
      .single();

    if (!settings) {
      throw new Error('Bot settings not found for user');
    }

    // 检查通知设置
    const notificationType = notification.notification_type;
    let notificationEnabled = settings.notifications_enabled;

    // 根据通知类型检查具体设置
    if (notificationType.startsWith('lottery_')) {
      notificationEnabled = notificationEnabled && settings.lottery_notifications;
    } else if (notificationType.startsWith('wallet_')) {
      notificationEnabled = notificationEnabled && settings.wallet_notifications;
    } else if (notificationType.startsWith('system_')) {
      notificationEnabled = notificationEnabled && settings.system_notifications;
    } else if (notificationType.startsWith('referral_')) {
      notificationEnabled = notificationEnabled && settings.referral_notifications;
    }

    if (!notificationEnabled) {
      console.log(`Notification disabled for user ${notification.user_id}, type: ${notificationType}`);
      
      // 标记为已取消
      await supabase
        .from('notification_queue')
        .update({ 
          status: 'cancelled',
          error_message: 'User disabled this notification type'
        })
        .eq('id', notification.id);
      
      return { success: true, cancelled: true };
    }

    // 检查静默时间
    if (isQuietTime(settings) && notification.priority > 1) {
      // 高优先级通知忽略静默时间
      console.log(`Quiet time active for user ${notification.user_id}, postponing notification`);
      
      // 延迟到静默时间结束
      const quietEndTime = new Date();
      const [endHour, endMinute] = settings.quiet_hours_end.split(':');
      quietEndTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
      
      if (quietEndTime <= new Date()) {
        quietEndTime.setDate(quietEndTime.getDate() + 1);
      }

      await supabase
        .from('notification_queue')
        .update({ 
          scheduled_at: quietEndTime.toISOString(),
          error_message: 'Postponed due to quiet hours'
        })
        .eq('id', notification.id);
      
      return { success: true, postponed: true };
    }

    // 格式化通知文本
    const notificationText = formatNotificationText(
      notificationType,
      settings.language_code,
      notification.data || {}
    );

    // 发送通知
    const sent = await sendTelegramMessage(
      notification.telegram_chat_id,
      notificationText,
      botToken
    );

    if (sent) {
      // 标记为已发送
      await supabase
        .from('notification_queue')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      
      return { success: true, sent: true };
    } else {
      throw new Error('Failed to send Telegram message');
    }

  } catch (error) {
    console.error(`Error processing notification ${notification.id}:`, error);
    
    // 更新重试计数
    const newRetryCount = notification.retry_count + 1;
    const maxRetries = notification.max_retries || 3;
    
    if (newRetryCount >= maxRetries) {
      // 达到最大重试次数，标记为失败
      await supabase
        .from('notification_queue')
        .update({ 
          status: 'failed',
          error_message: error.message,
          retry_count: newRetryCount
        })
        .eq('id', notification.id);
    } else {
      // 增加重试计数，稍后重试
      const nextRetryTime = new Date(Date.now() + Math.pow(2, newRetryCount) * 60000); // 指数退避
      
      await supabase
        .from('notification_queue')
        .update({ 
          retry_count: newRetryCount,
          error_message: error.message,
          scheduled_at: nextRetryTime.toISOString()
        })
        .eq('id', notification.id);
    }
    
    return { success: false, error: error.message };
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

    if (req.method === 'GET') {
      // 健康检查端点
      return new Response(JSON.stringify({ 
        status: 'ok',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 处理通知队列
    const { batchSize = 50 } = await req.json().catch(() => ({}));

    // 获取待发送的通知 (按优先级和时间排序)
    const { data: notifications, error } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('scheduled_at', { ascending: true })
      .limit(batchSize);

    if (error) {
      throw error;
    }

    if (!notifications || notifications.length === 0) {
      return new Response(JSON.stringify({ 
        processed: 0,
        message: 'No notifications to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${notifications.length} notifications`);

    const results = {
      processed: 0,
      sent: 0,
      cancelled: 0,
      postponed: 0,
      failed: 0,
      errors: [] as string[]
    };

    // 处理每个通知
    for (const notification of notifications) {
      try {
        const result = await processNotification(supabase, notification, botToken);
        results.processed++;
        
        if (result.sent) results.sent++;
        else if (result.cancelled) results.cancelled++;
        else if (result.postponed) results.postponed++;
        else if (!result.success) results.failed++;
        
      } catch (error) {
        results.failed++;
        results.errors.push(`Notification ${notification.id}: ${error.message}`);
        console.error(`Failed to process notification ${notification.id}:`, error);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Notification processor error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});