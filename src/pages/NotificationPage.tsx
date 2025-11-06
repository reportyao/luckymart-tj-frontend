import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useUser } from '../contexts/UserContext';
import {
  BellIcon,
  CheckIcon,
  TrophyIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  TicketIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  user_id: string;
  type: 'LOTTERY_RESULT' | 'LOTTERY_REMINDER' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 
        'MARKET_SOLD' | 'MARKET_PURCHASED' | 'REFERRAL_REWARD' | 'SYSTEM_ANNOUNCEMENT' | 'ACCOUNT_SECURITY';
  title: string;
  content: string;
  related_id?: string;
  related_type?: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

const NotificationPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    filterNotifications();
  }, [notifications, filter]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // TODO: 调用实际API获取通知
      // 这里使用mock数据
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockNotifications: Notification[] = [
        {
          id: '1',
          user_id: user?.id || '',
          type: 'LOTTERY_RESULT',
          title: '恭喜中奖!',
          content: '您在彩票 "iPhone 15 Pro Max 夺宝" 中获得1等奖,奖金 500.00 TJS',
          related_id: 'lottery1',
          related_type: 'lottery',
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          user_id: user?.id || '',
          type: 'PAYMENT_SUCCESS',
          title: '支付成功',
          content: '您的充值订单已完成,金额 100.00 TJS',
          related_id: 'order1',
          related_type: 'order',
          is_read: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          updated_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: '3',
          user_id: user?.id || '',
          type: 'REFERRAL_REWARD',
          title: '邀请奖励到账',
          content: '您的好友通过您的邀请码注册,您获得了 10.00 TJS 奖励',
          is_read: true,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '4',
          user_id: user?.id || '',
          type: 'LOTTERY_REMINDER',
          title: '开奖提醒',
          content: '"MacBook Pro 夺宝" 将在1小时后开奖,您购买的号码: 015, 016',
          related_id: 'lottery2',
          related_type: 'lottery',
          is_read: true,
          created_at: new Date(Date.now() - 172800000).toISOString(),
          updated_at: new Date(Date.now() - 172800000).toISOString()
        },
        {
          id: '5',
          user_id: user?.id || '',
          type: 'SYSTEM_ANNOUNCEMENT',
          title: '系统维护通知',
          content: '系统将于今晚23:00-01:00进行维护升级,期间部分功能可能暂时无法使用',
          is_read: true,
          created_at: new Date(Date.now() - 259200000).toISOString(),
          updated_at: new Date(Date.now() - 259200000).toISOString()
        },
        {
          id: '6',
          user_id: user?.id || '',
          type: 'ACCOUNT_SECURITY',
          title: '安全提示',
          content: '检测到您的账户在新设备登录,如非本人操作请及时修改密码',
          is_read: true,
          created_at: new Date(Date.now() - 345600000).toISOString(),
          updated_at: new Date(Date.now() - 345600000).toISOString()
        }
      ];

      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const filterNotifications = () => {
    let filtered = [...notifications];

    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.is_read);
    } else if (filter === 'read') {
      filtered = filtered.filter(n => n.is_read);
    }

    setFilteredNotifications(filtered);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // TODO: 调用API标记为已读
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      toast.success('已标记为已读');
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error(t('error.networkError'));
    }
  };

  const markAllAsRead = async () => {
    try {
      // TODO: 调用API标记全部为已读
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('全部标记为已读');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error(t('error.networkError'));
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      // TODO: 调用API删除通知
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('通知已删除');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error(t('error.networkError'));
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-6 h-6";
    switch (type) {
      case 'LOTTERY_RESULT':
        return <TrophyIcon className={`${iconClass} text-yellow-600`} />;
      case 'LOTTERY_REMINDER':
        return <TicketIcon className={`${iconClass} text-blue-600`} />;
      case 'PAYMENT_SUCCESS':
        return <BanknotesIcon className={`${iconClass} text-green-600`} />;
      case 'PAYMENT_FAILED':
        return <ExclamationTriangleIcon className={`${iconClass} text-red-600`} />;
      case 'MARKET_SOLD':
      case 'MARKET_PURCHASED':
        return <ShoppingBagIcon className={`${iconClass} text-purple-600`} />;
      case 'REFERRAL_REWARD':
        return <BanknotesIcon className={`${iconClass} text-green-600`} />;
      case 'SYSTEM_ANNOUNCEMENT':
        return <MegaphoneIcon className={`${iconClass} text-blue-600`} />;
      case 'ACCOUNT_SECURITY':
        return <ShieldCheckIcon className={`${iconClass} text-orange-600`} />;
      default:
        return <BellIcon className={`${iconClass} text-gray-600`} />;
    }
  };

  const getNotificationBgColor = (type: string): string => {
    switch (type) {
      case 'LOTTERY_RESULT':
        return 'bg-yellow-50';
      case 'LOTTERY_REMINDER':
        return 'bg-blue-50';
      case 'PAYMENT_SUCCESS':
        return 'bg-green-50';
      case 'PAYMENT_FAILED':
        return 'bg-red-50';
      case 'MARKET_SOLD':
      case 'MARKET_PURCHASED':
        return 'bg-purple-50';
      case 'REFERRAL_REWARD':
        return 'bg-green-50';
      case 'SYSTEM_ANNOUNCEMENT':
        return 'bg-blue-50';
      case 'ACCOUNT_SECURITY':
        return 'bg-orange-50';
      default:
        return 'bg-gray-50';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">{t('notification.notifications')}</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {t('notification.markAllRead')}
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2">
          {(['all', 'unread', 'read'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === filterType
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterType === 'all' && t('common.all')}
              {filterType === 'unread' && t('notification.unread')}
              {filterType === 'read' && t('notification.read')}
              {filterType === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <BellIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('notification.noNotifications')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${
                  !notification.is_read ? 'border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className={`p-3 rounded-lg ${getNotificationBgColor(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className={`font-semibold ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full ml-2 mt-2"></span>
                      )}
                    </div>
                    <p className={`text-sm mb-2 ${!notification.is_read ? 'text-gray-700' : 'text-gray-500'}`}>
                      {notification.content}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(notification.created_at)}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center space-x-3 mt-3">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="flex items-center space-x-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          <CheckIcon className="w-4 h-4" />
                          <span>标记已读</span>
                        </button>
                      )}
                      {notification.related_id && (
                        <button className="text-xs font-medium text-gray-600 hover:text-gray-700">
                          查看详情
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPage;
