import { FunctionsHttpError } from '@supabase/supabase-js'
import { errorMonitor } from '../services/ErrorMonitorService'

/**
 * 从 Supabase Edge Function 错误中提取实际的业务错误信息，
 * 并自动上报到错误监控系统（ErrorMonitorService → error_logs 表 → 管理后台）。
 * 
 * 问题背景：
 * 当 Edge Function 返回非 2xx 状态码时，Supabase 客户端抛出 FunctionsHttpError，
 * 其 message 固定为 "Edge Function returned a non-2xx status code"，
 * 而实际的业务错误信息（如"奖品不存在"、"会话已过期"）在 error.context（Response 对象）中。
 * 
 * 使用方式：
 * 将 `if (error) throw error` 替换为：
 * `if (error) throw new Error(await extractEdgeFunctionError(error))`
 */
export async function extractEdgeFunctionError(error: unknown): Promise<string> {
  let errorMessage = 'Unknown error'
  let apiEndpoint = ''
  let statusCode = 0

  if (error instanceof FunctionsHttpError) {
    try {
      const response = error.context as Response
      if (response) {
        apiEndpoint = response.url || ''
        statusCode = response.status || 0

        if (typeof response.json === 'function') {
          const body = await response.json()
          if (body?.error) {
            errorMessage = body.error
          } else if (body?.message) {
            errorMessage = body.message
          } else {
            errorMessage = error.message
          }
        } else {
          errorMessage = error.message
        }
      } else {
        errorMessage = error.message
      }
    } catch {
      // JSON 解析失败时回退到原始消息
      errorMessage = error.message
    }
  } else if (error instanceof Error) {
    errorMessage = error.message
  } else {
    errorMessage = String(error)
  }

  // 自动上报到错误监控系统（异步，不阻塞业务流程）
  try {
    errorMonitor.captureApiError(
      apiEndpoint || 'edge-function',
      'POST',
      statusCode,
      errorMessage,
    )
  } catch {
    // 上报失败不影响业务
  }

  return errorMessage
}
