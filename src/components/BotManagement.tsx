import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, MessageCircle, Bell, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { extractEdgeFunctionError } from '../utils/edgeFunctionHelper'

interface BotStats {
  totalUsers: number;
  todayMessages: number;
  pendingNotifications: number;
  activeUsers: number;
  topCommands: Array<{ command: string; usage_count: number }>;
}

interface BotStatus {
  isConfigured: boolean;
  webhookUrl?: string;
  botInfo?: {
    id: number;
    first_name: string;
    username: string;
  };
}

export default function BotManagement() {
  const [botStats, setBotStats] = useState<BotStats | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus>({ isConfigured: false });
  const [loading, setLoading] = useState(true);
  const [testChatId, setTestChatId] = useState('');

  useEffect(() => {
    loadBotData();
  }, []);

  const loadBotData = async () => {
    try {
      setLoading(true);
      
      // 获取 Bot 统计信息
      const { data: statsData } = await supabase.functions.invoke('telegram-bot-manager/stats');

      if (statsData?.success) {
        setBotStats(statsData.data);
      }

      // 获取 Bot 状态信息
      const { data: webhookData } = await supabase.functions.invoke('telegram-bot-manager/webhook-info');
      const { data: botInfoData } = await supabase.functions.invoke('telegram-bot-manager/bot-info');

      setBotStatus({
        isConfigured: webhookData?.success && webhookData?.data?.result?.url,
        webhookUrl: webhookData?.data?.result?.url,
        botInfo: botInfoData?.data?.result
      });

    } catch (error) {
      console.error('Error loading bot data:', error);
      toast('加载Bot数据失败', { icon: '❌' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetupBot = async () => {
    try {
      setLoading(true);
      toast('正在设置Bot...', { icon: '⚙️' });

      const { data, error } = await supabase.functions.invoke('telegram-bot-manager/setup');

      if (error) throw new Error(await extractEdgeFunctionError(error));

      if (data?.success) {
        toast('Bot设置成功！', { icon: '✅' });
        loadBotData();
      } else {
        throw new Error(data?.error || 'Bot设置失败');
      }
    } catch (error) {
      console.error('Error setting up bot:', error);
      toast('Bot设置失败', { icon: '❌' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testChatId || !testChatId.trim()) {
      toast('请输入Chat ID', { icon: '⚠️' });
      return;
    }

    try {
      toast('正在发送测试消息...', { icon: '📤' });

      const { data, error } = await supabase.functions.invoke('telegram-bot-manager/test-message', {
        body: {
          chatId: parseInt(testChatId)
        }
      });

      if (error) throw new Error(await extractEdgeFunctionError(error));

      if (data?.success) {
        toast('测试消息发送成功！', { icon: '✅' });
      } else {
        throw new Error(data?.error || '发送失败');
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      toast('发送测试消息失败', { icon: '❌' });
    }
  };

  const handleProcessNotifications = async () => {
    try {
      toast('正在处理通知队列...', { icon: '⚙️' });

      const { data, error } = await supabase.functions.invoke('telegram-notification-sender', {
        body: { batchSize: 50 }
      });

      if (error) throw new Error(await extractEdgeFunctionError(error));

      if (data?.processed !== undefined) {
        toast(`处理完成：发送${data.sent}条，取消${data.cancelled}条，失败${data.failed}条`, { icon: '📊' });
        loadBotData();
      } else {
        throw new Error('处理失败');
      }
    } catch (error) {
      console.error('Error processing notifications:', error);
      toast('处理通知失败', { icon: '❌' });
    }
  };

  if (loading && !botStats) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bot 状态卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Telegram Bot 状态</h3>
              <p className="text-sm text-gray-500">
                {botStatus.isConfigured ? 'Bot已配置并运行中' : 'Bot未配置'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {botStatus.isConfigured ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span className={`text-sm font-medium ${
              botStatus.isConfigured ? 'text-green-600' : 'text-red-600'
            }`}>
              {botStatus.isConfigured ? '正常运行' : '需要配置'}
            </span>
          </div>
        </div>

        {botStatus.botInfo && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-500">Bot名称</p>
              <p className="font-medium">{botStatus.botInfo.first_name}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-500">用户名</p>
              <p className="font-medium">@{botStatus.botInfo.username}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-500">Bot ID</p>
              <p className="font-medium">{botStatus.botInfo.id}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {!botStatus.isConfigured && (
            <button
              onClick={handleSetupBot}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '设置中...' : '配置Bot'}
            </button>
          )}
          
          <button
            onClick={loadBotData}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            刷新状态
          </button>
        </div>
      </motion.div>

      {/* Bot 统计信息 */}
      {botStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Bot className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">总用户数</p>
                <p className="text-xl font-bold text-gray-900">{botStats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">今日消息</p>
                <p className="text-xl font-bold text-gray-900">{botStats.todayMessages}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Bell className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">待发通知</p>
                <p className="text-xl font-bold text-gray-900">{botStats.pendingNotifications}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">活跃用户</p>
                <p className="text-xl font-bold text-gray-900">{botStats.activeUsers}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 操作面板 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bot 管理操作</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 测试消息 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">发送测试消息</h4>
            <div className="flex space-x-2">
              <input
                type="text"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                placeholder="输入Chat ID"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSendTestMessage}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                发送
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Chat ID可以通过用户发送消息给Bot获取
            </p>
          </div>

          {/* 处理通知 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">通知队列管理</h4>
            <button
              onClick={handleProcessNotifications}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              立即处理通知队列
            </button>
            <p className="text-xs text-gray-500">
              手动触发通知处理，系统每5分钟自动处理一次
            </p>
          </div>
        </div>
      </motion.div>

      {/* 热门命令统计 */}
      {botStats?.topCommands && botStats.topCommands.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">热门命令统计</h3>
          <div className="space-y-2">
            {botStats.topCommands.map((cmd) => (
              <div key={cmd.command} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="font-medium">/{cmd.command}</span>
                <span className="text-sm text-gray-600">{cmd.usage_count} 次使用</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}