/**
 * AI 服务层
 * 与 Supabase Edge Functions 通信
 */

import { supabase } from './supabase';

// AI 配额类型
export interface AIQuota {
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
  base_quota: number;
  bonus_quota: number;
}

// AI 聊天响应类型
export interface AIChatResponse {
  message: string;
  remaining_quota: number;
}

// 错误类型
export type AIErrorCode = 'SENSITIVE_CONTENT' | 'QUOTA_EXCEEDED' | 'AI_ERROR' | 'UNAUTHORIZED';

export class AIServiceError extends Error {
  code: AIErrorCode;
  
  constructor(code: AIErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AIServiceError';
  }
}

/**
 * AI 服务
 */
export const aiService = {
  /**
   * 发送消息到 AI
   * @param message 用户消息
   * @returns AI 回复和剩余配额
   */
  async chat(message: string): Promise<AIChatResponse> {
    const sessionToken = localStorage.getItem('custom_session_token');
    
    if (!sessionToken) {
      throw new AIServiceError('UNAUTHORIZED', '请先登录');
    }

    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: { 
        session_token: sessionToken,
        message: message.trim()
      }
    });

    if (error) {
      console.error('[AIService] Chat error:', error);
      throw new AIServiceError('AI_ERROR', error.message || 'AI 服务暂时不可用');
    }

    if (!data.success) {
      const errorCode = data.error as AIErrorCode;
      throw new AIServiceError(errorCode, data.message || '请求失败');
    }

    return data.data as AIChatResponse;
  },

  /**
   * 获取用户 AI 配额
   * @returns 配额信息
   */
  async getQuota(): Promise<AIQuota> {
    const sessionToken = localStorage.getItem('custom_session_token');
    
    if (!sessionToken) {
      // 未登录时返回默认配额
      return {
        total_quota: 10,
        used_quota: 0,
        remaining_quota: 10,
        base_quota: 10,
        bonus_quota: 0
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-get-quota', {
        body: { session_token: sessionToken }
      });

      if (error) {
        console.error('[AIService] GetQuota error:', error);
        return {
          total_quota: 10,
          used_quota: 0,
          remaining_quota: 10,
          base_quota: 10,
          bonus_quota: 0
        };
      }

      if (!data || !data.success) {
        console.error('[AIService] GetQuota failed:', data?.error || 'Unknown error');
        return {
          total_quota: 10,
          used_quota: 0,
          remaining_quota: 10,
          base_quota: 10,
          bonus_quota: 0
        };
      }

      return data.data as AIQuota;
    } catch (err) {
      console.error('[AIService] GetQuota exception:', err);
      return {
        total_quota: 10,
        used_quota: 0,
        remaining_quota: 10,
        base_quota: 10,
        bonus_quota: 0
      };
    }
  },

  /**
   * 添加奖励配额 (内部使用)
   * @param userId 用户ID
   * @param amount 奖励数量
   * @param reason 奖励原因
   */
  async addBonus(userId: string, amount: number, reason: string = 'bonus'): Promise<boolean> {
    const sessionToken = localStorage.getItem('custom_session_token');

    const { data, error } = await supabase.functions.invoke('ai-add-bonus', {
      body: { 
        session_token: sessionToken,
        user_id: userId,
        amount,
        reason
      }
    });

    if (error) {
      console.error('[AIService] AddBonus error:', error);
      return false;
    }

    return data.success === true;
  }
};
