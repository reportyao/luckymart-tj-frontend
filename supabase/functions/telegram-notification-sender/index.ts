// Telegram Bot 通知发送器
// 处理通知队列并发送通知给用户

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NotificationData {
  // 一元夺宝相关
  product_name?: string;
  ticket_number?: string;  // 参与码
  winning_number?: string; // 幸运号码
  
  // 拼团相关
  session_code?: string;
  won_at?: string;
  refund_amount?: number;
  balance?: number;
  
  // 钱包相关
  transaction_amount?: number;
  deposit_amount?: number;
  bonus_amount?: number;
  bonus_percent?: number;
  total_amount?: number;
  estimated_arrival?: string;
  failure_reason?: string;
  current_balance?: number;
  
  // 订单物流相关
  tracking_number?: string;
  pickup_location?: string;
  pickup_code?: string;
  
  // 晒单相关
  reward_amount?: number;
  reason?: string;
  
  // 转盘相关
  prize_name?: string;
  prize_amount?: number;
  
  // 推荐相关
  referral_amount?: number;
  level?: string;
  source?: string;
  invitee_name?: string;  // 被邀请人名称
}

// 多语言通知模板 - 根据用户确认的文案
const notificationTemplates = {
  // ==================== 1. 一元夺宝活动通知 ====================
  
  // 幸运入选通知
  lucky_draw_win: {
    zh: (data: NotificationData) => 
      `🎉 恭喜您幸运入选！\n\n🎁 商品: ${data.product_name}\n🔢 您的参与码: ${data.ticket_number}\n🎯 幸运号码: ${data.winning_number}\n\n恭喜您获得此商品，请尽快填写收货地址！`,
    ru: (data: NotificationData) => 
      `🎉 Поздравляем, вы счастливый победитель!\n\n🎁 Товар: ${data.product_name}\n🔢 Ваш код участия: ${data.ticket_number}\n🎯 Счастливый номер: ${data.winning_number}\n\nПоздравляем с получением товара! Пожалуйста, заполните адрес доставки!`,
    tg: (data: NotificationData) => 
      `🎉 Табрик, шумо ғолиби хушбахт ҳастед!\n\n🎁 Мол: ${data.product_name}\n🔢 Рамзи иштироки шумо: ${data.ticket_number}\n🎯 Рақами хушбахт: ${data.winning_number}\n\nТабрик барои гирифтани мол! Лутфан суроғаи расониданро пур кунед!`
  },

  // ==================== 2. 拼团活动通知 ====================
  
  // 拼团成功通知
  group_buy_win: {
    zh: (data: NotificationData) => 
      `🎉 恭喜拼团成功！\n\n🎁 商品: ${data.product_name}\n🔢 拼团编号: ${data.session_code}\n⏰ 成功时间: ${data.won_at}\n\n请尽快填写收货地址，我们将为您发货！`,
    ru: (data: NotificationData) => 
      `🎉 Поздравляем с успешной групповой покупкой!\n\n🎁 Товар: ${data.product_name}\n🔢 Номер группы: ${data.session_code}\n⏰ Время успеха: ${data.won_at}\n\nПожалуйста, заполните адрес доставки как можно скорее!`,
    tg: (data: NotificationData) => 
      `🎉 Табрик бо харидии гурӯҳии муваффақ!\n\n🎁 Мол: ${data.product_name}\n🔢 Рақами гурӯҳ: ${data.session_code}\n⏰ Вақти муваффақият: ${data.won_at}\n\nЛутфан суроғаи расонидани молро пур кунед!`
  },
  
  // 拼团退款通知（未拼中）
  group_buy_refund: {
    zh: (data: NotificationData) => 
      `😔 很遗憾本次未拼中\n\n🎁 商品: ${data.product_name}\n🔢 拼团编号: ${data.session_code}\n💰 退款金额: ${data.refund_amount} TJS\n💵 当前余额: ${data.balance}\n\n退款已退回您的余额钱包，欢迎继续参与！`,
    ru: (data: NotificationData) => 
      `😔 К сожалению, в этот раз не повезло\n\n🎁 Товар: ${data.product_name}\n🔢 Номер группы: ${data.session_code}\n💰 Возврат: ${data.refund_amount} TJS\n💵 Текущий баланс: ${data.balance}\n\nСредства возвращены на ваш баланс, продолжайте участвовать!`,
    tg: (data: NotificationData) => 
      `😔 Мутаассифона ин дафъа насиб нашуд\n\n🎁 Мол: ${data.product_name}\n🔢 Рақами гурӯҳ: ${data.session_code}\n💰 Баргардонидан: ${data.refund_amount} TJS\n💵 Боқимондаи ҷорӣ: ${data.balance}\n\nМаблағ ба боқимондаи шумо баргардонида шуд, идома диҳед!`
  },
  
  // 拼团超时/取消通知
  group_buy_timeout: {
    zh: (data: NotificationData) => 
      `⏰ 拼团已取消\n\n🎁 商品: ${data.product_name}\n🔢 拼团编号: ${data.session_code}\n💰 退款金额: ${data.refund_amount} TJS\n💵 当前余额: ${data.balance}\n\n拼团未能凑齐人数，参与金额已退回您的余额钱包。`,
    ru: (data: NotificationData) => 
      `⏰ Групповая покупка отменена\n\n🎁 Товар: ${data.product_name}\n🔢 Номер группы: ${data.session_code}\n💰 Возврат: ${data.refund_amount} TJS\n💵 Текущий баланс: ${data.balance}\n\nГруппа не набралась, средства возвращены на ваш баланс.`,
    tg: (data: NotificationData) => 
      `⏰ Харидии гурӯҳӣ бекор карда шуд\n\n🎁 Мол: ${data.product_name}\n🔢 Рақами гурӯҳ: ${data.session_code}\n💰 Баргардонидан: ${data.refund_amount} TJS\n💵 Боқимондаи ҷорӣ: ${data.balance}\n\nГурӯҳ пур нашуд, маблағ ба боқимондаи шумо баргардонида шуд.`
  },

  // ==================== 3. 钱包相关通知 ====================
  
  // 充值到账通知（管理后台审核通过后触发）
  wallet_deposit: {
    zh: (data: NotificationData) => 
      `💰 充值已到账\n\n💵 金额: +${data.transaction_amount} TJS\n🕒 时间: ${new Date().toLocaleString('zh-CN')}\n\n您的余额已更新，可以继续参与活动！`,
    ru: (data: NotificationData) => 
      `💰 Пополнение зачислено\n\n💵 Сумма: +${data.transaction_amount} TJS\n🕒 Время: ${new Date().toLocaleString('ru-RU')}\n\nВаш баланс обновлен, можете продолжать участие!`,
    tg: (data: NotificationData) => 
      `💰 Пурсозӣ гузошта шуд\n\n💵 Маблағ: +${data.transaction_amount} TJS\n🕒 Вақт: ${new Date().toLocaleString('tg-TJ')}\n\nБоқимондаи шумо навсозӣ шуд, метавонед дар фаъолият идома диҳед!`
  },
  
  // 首充奖励到账通知
  first_deposit_bonus: {
    zh: (data: NotificationData) => 
      `🎁 首充奖励到账\n\n💵 充值金额: ${data.deposit_amount} TJS\n🎉 首充奖励: +${data.bonus_amount} TJS（${data.bonus_percent}%）\n💰 实际到账: ${data.total_amount} TJS\n\n感谢您对 TezBarakatTJ 的支持！`,
    ru: (data: NotificationData) => 
      `🎁 Бонус за первое пополнение\n\n💵 Сумма пополнения: ${data.deposit_amount} TJS\n🎉 Бонус: +${data.bonus_amount} TJS (${data.bonus_percent}%)\n💰 Итого зачислено: ${data.total_amount} TJS\n\nСпасибо за поддержку TezBarakatTJ!`,
    tg: (data: NotificationData) => 
      `🎁 Ҷоизаи пурсозии аввал\n\n💵 Маблағи пурсозӣ: ${data.deposit_amount} TJS\n🎉 Ҷоиза: +${data.bonus_amount} TJS (${data.bonus_percent}%)\n💰 Ҳамагӣ гузошта шуд: ${data.total_amount} TJS\n\nТашаккур барои дастгирии TezBarakatTJ!`
  },
  
  // 提现申请已提交
  wallet_withdraw_pending: {
    zh: (data: NotificationData) => 
      `⏳ 提现申请已提交\n\n💵 金额: ${data.transaction_amount} TJS\n📝 状态: 审核中\n\n我们将在24小时内处理您的提现申请。`,
    ru: (data: NotificationData) => 
      `⏳ Заявка на вывод подана\n\n💵 Сумма: ${data.transaction_amount} TJS\n📝 Статус: На рассмотрении\n\nМы обработаем вашу заявку в течение 24 часов.`,
    tg: (data: NotificationData) => 
      `⏳ Дархости баровардан пешниҳод шуд\n\n💵 Маблағ: ${data.transaction_amount} TJS\n📝 Ҳолат: Дар баррасӣ\n\nМо дархости шуморо дар давоми 24 соат коркард мекунем.`
  },
  
  // 提现完成通知
  wallet_withdraw_completed: {
    zh: (data: NotificationData) => 
      `✅ 提现完成\n\n💵 金额: ${data.transaction_amount} TJS\n✅ 状态: 已到账\n⏰ 到账时间: ${data.estimated_arrival || '已到账'}\n\n资金已成功转至您的账户！`,
    ru: (data: NotificationData) => 
      `✅ Вывод завершен\n\n💵 Сумма: ${data.transaction_amount} TJS\n✅ Статус: Зачислено\n⏰ Время зачисления: ${data.estimated_arrival || 'Зачислено'}\n\nСредства успешно переведены на ваш счет!`,
    tg: (data: NotificationData) => 
      `✅ Баровардан анҷом ёфт\n\n💵 Маблағ: ${data.transaction_amount} TJS\n✅ Ҳолат: Гузошта шуд\n⏰ Вақти гузоштан: ${data.estimated_arrival || 'Гузошта шуд'}\n\nМаблағ ба ҳисоби шумо муваффақият гузошта шуд!`
  },
  
  // 提现失败通知
  wallet_withdraw_failed: {
    zh: (data: NotificationData) => 
      `❌ 提现失败\n\n💵 金额: ${data.transaction_amount} TJS\n❌ 状态: 失败\n📝 失败原因: ${data.failure_reason}\n💰 当前余额: ${data.current_balance} TJS\n\n资金已退回您的余额钱包，请重新提交申请。`,
    ru: (data: NotificationData) => 
      `❌ Вывод не удался\n\n💵 Сумма: ${data.transaction_amount} TJS\n❌ Статус: Не удалось\n📝 Причина: ${data.failure_reason}\n💰 Текущий баланс: ${data.current_balance} TJS\n\nСредства возвращены на ваш баланс, пожалуйста, подайте заявку снова.`,
    tg: (data: NotificationData) => 
      `❌ Баровардан ноком\n\n💵 Маблағ: ${data.transaction_amount} TJS\n❌ Ҳолат: Ноком\n📝 Сабаб: ${data.failure_reason}\n💰 Боқимондаи ҷорӣ: ${data.current_balance} TJS\n\nМаблағ ба боқимондаи шумо баргардонида шуд, лутфан дархостро дубора пешниҳод кунед.`
  },

  // ==================== 4. 订单物流通知 ====================
  // 只推送关键节点：到达塔国路段、到达自提点生成提货码
  
  // 订单到达塔吉克斯坦
  order_arrived_tajikistan: {
    zh: (data: NotificationData) => 
      `🚚 订单已到达塔吉克斯坦\n\n🎁 商品: ${data.product_name}\n📮 物流单号: ${data.tracking_number}\n📍 当前状态: 已到达塔吉克斯坦\n\n您的订单即将送达自提点，请留意后续通知。`,
    ru: (data: NotificationData) => 
      `🚚 Заказ прибыл в Таджикистан\n\n🎁 Товар: ${data.product_name}\n📮 Трек-номер: ${data.tracking_number}\n📍 Текущий статус: Прибыл в Таджикистан\n\nВаш заказ скоро будет доставлен в пункт выдачи.`,
    tg: (data: NotificationData) => 
      `🚚 Фармоиш ба Тоҷикистон расид\n\n🎁 Мол: ${data.product_name}\n📮 Рақами пайгирӣ: ${data.tracking_number}\n📍 Ҳолати ҷорӣ: Ба Тоҷикистон расид\n\nФармоиши шумо ба зудӣ ба нуқтаи гирифтан мерасад.`
  },
  
  // 订单已到达自提点
  order_ready_pickup: {
    zh: (data: NotificationData) => 
      `✅ 订单已到达自提点\n\n🎁 商品: ${data.product_name}\n📍 自提点: ${data.pickup_location}\n🔢 提货码: ${data.pickup_code}\n\n请携带提货码前往自提点提货！`,
    ru: (data: NotificationData) => 
      `✅ Заказ прибыл в пункт выдачи\n\n🎁 Товар: ${data.product_name}\n📍 Пункт выдачи: ${data.pickup_location}\n🔢 Код получения: ${data.pickup_code}\n\nПридите с кодом получения!`,
    tg: (data: NotificationData) => 
      `✅ Фармоиш ба нуқтаи гирифтан расид\n\n🎁 Мол: ${data.product_name}\n📍 Нуқтаи гирифтан: ${data.pickup_location}\n🔢 Рамзи гирифтан: ${data.pickup_code}\n\nБо рамзи гирифтан биёед!`
  },
  
  // 订单已完成
  order_completed: {
    zh: (data: NotificationData) => 
      `🎊 订单已完成\n\n🎁 商品: ${data.product_name}\n✅ 状态: 已提货\n\n感谢您的使用，期待您的下次光临！`,
    ru: (data: NotificationData) => 
      `🎊 Заказ завершен\n\n🎁 Товар: ${data.product_name}\n✅ Статус: Получено\n\nСпасибо за использование, ждем вас снова!`,
    tg: (data: NotificationData) => 
      `🎊 Фармоиш анҷом ёфт\n\n🎁 Мол: ${data.product_name}\n✅ Ҳолат: Гирифта шуд\n\nТашаккур барои истифода, интизори шумо ҳастем!`
  },

  // ==================== 5. 晒单审核通知 ====================
  
  // 晒单审核通过
  showoff_approved: {
    zh: (data: NotificationData) => 
      `✅ 晒单审核通过\n\n💰 奖励: +${data.reward_amount} TJS\n\n感谢您的分享！`,
    ru: (data: NotificationData) => 
      `✅ Отзыв одобрен\n\n💰 Награда: +${data.reward_amount} TJS\n\nСпасибо за ваш отзыв!`,
    tg: (data: NotificationData) => 
      `✅ Шарҳ тасдиқ шуд\n\n💰 Ҷоиза: +${data.reward_amount} TJS\n\nТашаккур барои шарҳи шумо!`
  },
  
  // 晒单审核未通过
  showoff_rejected: {
    zh: (data: NotificationData) => 
      `❌ 晒单审核未通过\n\n📝 原因: ${data.reason}\n\n请重新提交符合要求的晒单。`,
    ru: (data: NotificationData) => 
      `❌ Отзыв не одобрен\n\n📝 Причина: ${data.reason}\n\nПожалуйста, отправьте отзыв, соответствующий требованиям.`,
    tg: (data: NotificationData) => 
      `❌ Шарҳ тасдиқ нашуд\n\n📝 Сабаб: ${data.reason}\n\nЛутфан шарҳи мувофиқ пешниҳод кунед.`
  },

  // ==================== 6. 转盘抽奖通知 ====================
  
  // 转盘获奖通知
  spin_win: {
    zh: (data: NotificationData) => 
      `🎰 转盘获奖\n\n🎁 奖品: ${data.prize_name}\n💰 金额: ${data.prize_amount} TJS\n\n奖励已发放到您的账户！`,
    ru: (data: NotificationData) => 
      `🎰 Приз в колесе фортуны\n\n🎁 Приз: ${data.prize_name}\n💰 Сумма: ${data.prize_amount} TJS\n\nНаграда зачислена на ваш счет!`,
    tg: (data: NotificationData) => 
      `🎰 Ҷоиза дар чархи бахт\n\n🎁 Ҷоиза: ${data.prize_name}\n💰 Маблағ: ${data.prize_amount} TJS\n\nҶоиза ба ҳисоби шумо гузошта шуд!`
  },

  // ==================== 7. 邀请好友通知 ====================
  
  // 邀请好友注册成功通知（邀请者获得轮盘抽奖机会）
  referral_success: {
    zh: (data: NotificationData) => 
      `🎉 好友注册成功\n\n👥 您邀请的好友 ${data.invitee_name || '新用户'} 已成功注册\n🎰 奖励: 获得1次轮盘抽奖机会\n\n立即前往轮盘抽奖，赢取更多奖励！`,
    ru: (data: NotificationData) => 
      `🎉 Друг успешно зарегистрировался\n\n👥 Ваш приглашенный друг ${data.invitee_name || 'новый пользователь'} успешно зарегистрировался\n🎰 Награда: 1 бесплатный спин колеса фортуны\n\nКрутите колесо и выигрывайте больше призов!`,
    tg: (data: NotificationData) => 
      `🎉 Дӯст бомуваффақият сабти ном шуд\n\n👥 Дӯсти даъватшудаи шумо ${data.invitee_name || 'корбари нав'} бомуваффақият сабти ном шуд\n🎰 Ҷоиза: 1 чархиши ройгони чархи бахт\n\nЧархро бигардонед ва ҷоизаҳои бештар бурдед!`
  },
  
  // 推荐奖励到账通知
  referral_reward: {
    zh: (data: NotificationData) => 
      `🎁 推荐奖励到账\n\n💰 奖励金额: +${data.referral_amount} TJS\n👥 来源: ${data.source || data.level || '好友邀请奖励'}\n\n感谢您推广 TezBarakatTJ！`,
    ru: (data: NotificationData) => 
      `🎁 Реферальная награда получена\n\n💰 Размер награды: +${data.referral_amount} TJS\n👥 Источник: ${data.source || data.level || 'Награда за приглашение друзей'}\n\nСпасибо за продвижение TezBarakatTJ!`,
    tg: (data: NotificationData) => 
      `🎁 Ҷоизаи реферал дарёфт\n\n💰 Андозаи ҷоиза: +${data.referral_amount} TJS\n👥 Манбаъ: ${data.source || data.level || 'Ҷоизаи таклифи дӯстон'}\n\nТашаккур барои таблиғи TezBarakatTJ!`
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

// 格式化通知文本
function formatNotificationText(
  notificationType: string,
  language: string,
  data: NotificationData
): string {
  const template = notificationTemplates[notificationType as keyof typeof notificationTemplates];
  
  if (!template) {
    console.warn(`Unknown notification type: ${notificationType}`);
    return `通知: ${JSON.stringify(data)}`;
  }

  // 默认使用中文，如果没有对应语言则使用中文
  const languageCode = ['zh', 'ru', 'tg'].includes(language) ? language : 'zh';
  const formatter = template[languageCode as keyof typeof template] || template['zh'];
  
  if (typeof formatter === 'function') {
    return formatter(data);
  }
  
  return `通知: ${notificationType}`;
}

// 处理单个通知
async function processNotification(supabase: any, notification: any, botToken: string) {
  try {
    // 获取用户信息和语言偏好
    const { data: user } = await supabase
      .from('users')
      .select('preferred_language, telegram_id')
      .eq('id', notification.user_id)
      .single();

    const language = user?.preferred_language || 'zh';
    
    // 获取 telegram_chat_id，优先使用通知中的，否则从用户表查询
    let chatId = notification.telegram_chat_id;
    if (!chatId && user?.telegram_id) {
      chatId = parseInt(user.telegram_id);
    }
    
    // 如果仍然没有 chat_id，尝试从 bot_user_settings 查询
    if (!chatId) {
      const { data: botSettings } = await supabase
        .from('bot_user_settings')
        .select('telegram_chat_id')
        .eq('user_id', notification.user_id)
        .single();
      
      if (botSettings?.telegram_chat_id) {
        chatId = botSettings.telegram_chat_id;
      }
    }
    
    // 如果没有有效的 chat_id，标记为失败
    if (!chatId) {
      console.warn(`No telegram_chat_id found for user ${notification.user_id}`);
      await supabase
        .from('notification_queue')
        .update({ 
          status: 'failed',
          error_message: 'No telegram_chat_id found for user',
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      return { success: false, error: 'No telegram_chat_id' };
    }

    // 格式化通知文本
    const notificationText = formatNotificationText(
      notification.notification_type || notification.type,
      language,
      notification.data || notification.payload || {}
    );

    // 发送通知
    const sent = await sendTelegramMessage(
      chatId,
      notificationText,
      botToken
    );

    if (sent) {
      // 标记为已发送
      await supabase
        .from('notification_queue')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      
      return { success: true, sent: true };
    } else {
      throw new Error('Failed to send Telegram message');
    }

  } catch (error) {
    console.error(`Error processing notification ${notification.id}:`, error);
    
    // 更新重试计数
    const newRetryCount = (notification.retry_count || notification.attempts || 0) + 1;
    const maxRetries = notification.max_retries || 3;
    
    if (newRetryCount >= maxRetries) {
      // 达到最大重试次数，标记为失败
      await supabase
        .from('notification_queue')
        .update({ 
          status: 'failed',
          error_message: error.message,
          retry_count: newRetryCount,
          attempts: newRetryCount,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);
    } else {
      // 增加重试计数，稍后重试
      const nextRetryTime = new Date(Date.now() + Math.pow(2, newRetryCount) * 60000); // 指数退避
      
      await supabase
        .from('notification_queue')
        .update({ 
          retry_count: newRetryCount,
          attempts: newRetryCount,
          error_message: error.message,
          scheduled_at: nextRetryTime.toISOString(),
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
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
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';

    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN is not set');
      return new Response(JSON.stringify({ 
        error: 'Bot token not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
      .in('status', ['pending', 'PENDING'])
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
      failed: 0,
      errors: [] as string[]
    };

    // 处理每个通知
    for (const notification of notifications) {
      try {
        const result = await processNotification(supabase, notification, botToken);
        results.processed++;
        
        if (result.sent) results.sent++;
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
