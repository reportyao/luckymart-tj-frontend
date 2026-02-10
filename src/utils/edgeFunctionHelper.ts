import { FunctionsHttpError } from '@supabase/supabase-js'

/**
 * 从 Supabase Edge Function 错误中提取实际的业务错误信息
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
  if (error instanceof FunctionsHttpError) {
    try {
      const response = error.context as Response
      if (response && typeof response.json === 'function') {
        const body = await response.json()
        if (body?.error) return body.error
        if (body?.message) return body.message
      }
    } catch {
      // JSON 解析失败时回退到原始消息
    }
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
