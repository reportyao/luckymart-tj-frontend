/**
 * 钱包类型定义和常量
 * 
 * ============================================================
 * 重要说明：钱包字段规范
 * ============================================================
 * 
 * 数据库 wallets 表有两个关键字段：
 * - type: 钱包类型枚举 (WalletType: 'TJS' | 'LUCKY_COIN')
 * - currency: 货币类型文本 ('TJS' | 'POINTS')
 * 
 * 标准组合（必须严格遵守）：
 * ┌─────────────┬──────────┬─────────────────────────────────┐
 * │ type        │ currency │ 业务含义                        │
 * ├─────────────┼──────────┼─────────────────────────────────┤
 * │ TJS         │ TJS      │ 现金余额钱包（充值、提现、购买）│
 * │ LUCKY_COIN  │ POINTS   │ 积分钱包（积分商城、抽奖、奖励）│
 * └─────────────┴──────────┴─────────────────────────────────┘
 * 
 * 历史遗留说明：
 * - LUCKY_COIN 是历史名称（幸运币），现在前端统一显示为"积分"
 * - 积分钱包的 currency 必须是 'POINTS'，不能是 'TJS' 或 'LUCKY_COIN'
 * - 曾经有代码错误地将积分钱包的 currency 设为 'TJS' 或 'LUCKY_COIN'
 * 
 * 查询钱包时的正确方式：
 * - 现金钱包: .eq('type', 'TJS').eq('currency', 'TJS')
 * - 积分钱包: .eq('type', 'LUCKY_COIN').eq('currency', 'POINTS')
 * 
 * 或者使用本文件导出的常量：
 * - 现金钱包: .eq('type', WALLET_TYPES.CASH.type).eq('currency', WALLET_TYPES.CASH.currency)
 * - 积分钱包: .eq('type', WALLET_TYPES.POINTS.type).eq('currency', WALLET_TYPES.POINTS.currency)
 * 
 * ============================================================
 */

/**
 * 钱包类型常量
 * 使用这些常量可以避免硬编码字符串导致的错误
 */
export const WALLET_TYPES = {
  /**
   * 现金余额钱包
   * - 用于充值、提现、购买商品
   * - type: 'TJS' (塔吉克斯坦索莫尼)
   * - currency: 'TJS'
   */
  CASH: {
    type: 'TJS' as const,
    currency: 'TJS' as const,
    displayName: '余额',
    displayNameRu: 'Баланс',
    displayNameTg: 'Баланс',
  },
  
  /**
   * 积分钱包（历史名称：幸运币 LUCKY_COIN）
   * - 用于积分商城、抽奖、签到奖励等
   * - type: 'LUCKY_COIN' (数据库枚举值，不可更改)
   * - currency: 'POINTS' (积分单位)
   * 
   * 注意：虽然 type 是 LUCKY_COIN，但前端显示为"积分"
   */
  POINTS: {
    type: 'LUCKY_COIN' as const,
    currency: 'POINTS' as const,
    displayName: '积分',
    displayNameRu: 'Баллы',
    displayNameTg: 'Холҳо',
  },
} as const;

/**
 * 支付方式常量
 */
export const PAYMENT_METHODS = {
  /** 使用现金余额支付 */
  BALANCE_WALLET: 'BALANCE_WALLET' as const,
  /** 使用积分支付 */
  LUCKY_COIN_WALLET: 'LUCKY_COIN_WALLET' as const,
  /** 外部支付（如银行卡） */
  EXTERNAL_PAYMENT: 'EXTERNAL_PAYMENT' as const,
} as const;

/**
 * 根据支付方式获取对应的钱包类型
 * @param paymentMethod 支付方式
 * @returns 钱包类型配置
 */
export function getWalletTypeByPaymentMethod(paymentMethod: string) {
  switch (paymentMethod) {
    case PAYMENT_METHODS.LUCKY_COIN_WALLET:
      return WALLET_TYPES.POINTS;
    case PAYMENT_METHODS.BALANCE_WALLET:
    default:
      return WALLET_TYPES.CASH;
  }
}

/**
 * 钱包查询条件生成器
 * 用于生成正确的钱包查询条件，避免 type/currency 不匹配的问题
 */
export const WALLET_QUERY = {
  /** 现金钱包查询条件 */
  cash: (userId: string) => ({
    user_id: userId,
    type: WALLET_TYPES.CASH.type,
    currency: WALLET_TYPES.CASH.currency,
  }),
  
  /** 积分钱包查询条件 */
  points: (userId: string) => ({
    user_id: userId,
    type: WALLET_TYPES.POINTS.type,
    currency: WALLET_TYPES.POINTS.currency,
  }),
};
