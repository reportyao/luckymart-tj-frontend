/**
 * 统一的日志工具
 * 在开发环境中输出所有日志，在生产环境中只输出错误和警告
 */

const isDev = import.meta.env.DEV

export const logger = {
  /**
   * 普通日志 - 仅在开发环境输出
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log('[LOG]', ...args)
    }
  },

  /**
   * 错误日志 - 始终输出
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args)
  },

  /**
   * 警告日志 - 仅在开发环境输出
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn('[WARN]', ...args)
    }
  },

  /**
   * 信息日志 - 仅在开发环境输出
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info('[INFO]', ...args)
    }
  },

  /**
   * 调试日志 - 仅在开发环境输出
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug('[DEBUG]', ...args)
    }
  },

  /**
   * 组织相关日志
   */
  group: (label: string) => {
    if (isDev) {
      console.group(label)
    }
  },

  /**
   * 结束日志组
   */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd()
    }
  },

  /**
   * 计时开始
   */
  time: (label: string) => {
    if (isDev) {
      console.time(label)
    }
  },

  /**
   * 计时结束
   */
  timeEnd: (label: string) => {
    if (isDev) {
      console.timeEnd(label)
    }
  },
}
