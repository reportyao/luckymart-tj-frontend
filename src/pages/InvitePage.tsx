import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useUser } from '../contexts/UserContext';
import {
  UserPlusIcon,
  GiftIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  UsersIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface InviteStats {
  total_invites: number;
  active_invites: number;
  total_commission: number;
  pending_commission: number;
  level1_count: number;
  level2_count: number;
  level3_count: number;
}

interface InvitedUser {
  id: string;
  username: string;
  avatar_url?: string;
  level: number;
  status: 'ACTIVE' | 'INACTIVE';
  total_spent: number;
  commission_earned: number;
  created_at: string;
}

const InvitePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const inviteCode = user?.referral_code || 'LOADING...';
  const inviteLink = `https://t.me/luckymart_bot?start=${inviteCode}`;

  useEffect(() => {
    fetchInviteData();
  }, []);

  const fetchInviteData = async () => {
    setIsLoading(true);
    try {
      // TODO: 调用实际API获取邀请数据
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockStats: InviteStats = {
        total_invites: 15,
        active_invites: 12,
        total_commission: 450.50,
        pending_commission: 85.20,
        level1_count: 8,
        level2_count: 5,
        level3_count: 2
      };

      const mockUsers: InvitedUser[] = [
        {
          id: '1',
          username: 'User***123',
          level: 1,
          status: 'ACTIVE',
          total_spent: 500,
          commission_earned: 50,
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          username: 'User***456',
          level: 1,
          status: 'ACTIVE',
          total_spent: 300,
          commission_earned: 30,
          created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '3',
          username: 'User***789',
          level: 2,
          status: 'ACTIVE',
          total_spent: 200,
          commission_earned: 10,
          created_at: new Date(Date.now() - 172800000).toISOString()
        }
      ];

      setStats(mockStats);
      setInvitedUsers(mockUsers);
    } catch (error) {
      console.error('Failed to fetch invite data:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('邀请链接已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('邀请码已复制到剪贴板');
  };

  const shareInvite = () => {
    const text = `🎁 加入LuckyMart夺宝平台!\n使用我的邀请码: ${inviteCode}\n或点击链接: ${inviteLink}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'LuckyMart邀请',
        text: text,
        url: inviteLink
      }).catch(err => console.log('分享失败:', err));
    } else {
      copyInviteLink();
    }
  };

  const getLevelBadge = (level: number) => {
    const colors = {
      1: 'bg-blue-100 text-blue-700',
      2: 'bg-purple-100 text-purple-700',
      3: 'bg-orange-100 text-orange-700'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getCommissionRate = (level: number) => {
    const rates = { 1: 10, 2: 5, 3: 2 };
    return rates[level as keyof typeof rates] || 0;
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-3">
            <GiftIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('invite.inviteFriends')}</h1>
          <p className="text-white/90">邀请好友,赚取丰厚佣金</p>
        </div>

        {/* Invite Code Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <p className="text-white/80 text-sm mb-2 text-center">我的邀请码</p>
          <div className="flex items-center justify-center space-x-3 mb-4">
            <span className="text-3xl font-bold tracking-wider">{inviteCode}</span>
            <button
              onClick={copyInviteCode}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <ClipboardDocumentIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={copyInviteLink}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-white text-purple-600 rounded-xl font-medium hover:bg-white/90 transition-colors"
            >
              {copied ? (
                <>
                  <CheckIcon className="w-5 h-5" />
                  <span>已复制</span>
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-5 h-5" />
                  <span>复制链接</span>
                </>
              )}
            </button>
            <button
              onClick={shareInvite}
              className="px-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
            >
              <ShareIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="px-4 -mt-6 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UsersIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_invites}</p>
                  <p className="text-xs text-gray-500">总邀请人数</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BanknotesIcon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(stats.total_commission)}
                  </p>
                  <p className="text-xs text-gray-500">累计佣金</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <ChartBarIcon className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.active_invites}</p>
                  <p className="text-xs text-gray-500">活跃用户</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <GiftIcon className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(stats.pending_commission)}
                  </p>
                  <p className="text-xs text-gray-500">待结算</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Commission Rules */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">佣金规则</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold">
                  1
                </span>
                <div>
                  <p className="font-medium text-gray-900">一级好友</p>
                  <p className="text-xs text-gray-500">直接邀请的用户</p>
                </div>
              </div>
              <span className="text-lg font-bold text-blue-600">10%</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">
                  2
                </span>
                <div>
                  <p className="font-medium text-gray-900">二级好友</p>
                  <p className="text-xs text-gray-500">好友邀请的用户</p>
                </div>
              </div>
              <span className="text-lg font-bold text-purple-600">5%</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 bg-orange-600 text-white rounded-full text-sm font-bold">
                  3
                </span>
                <div>
                  <p className="font-medium text-gray-900">三级好友</p>
                  <p className="text-xs text-gray-500">二级好友邀请的用户</p>
                </div>
              </div>
              <span className="text-lg font-bold text-orange-600">2%</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              💡 <strong>佣金说明:</strong> 当您邀请的用户在平台消费时,您将获得相应比例的佣金奖励。
              佣金实时到账,可随时提现。
            </p>
          </div>
        </div>
      </div>

      {/* Level Distribution */}
      {stats && (
        <div className="px-4 mb-4">
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">邀请层级分布</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">一级好友</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(stats.level1_count / stats.total_invites) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8">{stats.level1_count}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">二级好友</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full"
                      style={{ width: `${(stats.level2_count / stats.total_invites) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8">{stats.level2_count}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">三级好友</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-600 rounded-full"
                      style={{ width: `${(stats.level3_count / stats.total_invites) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8">{stats.level3_count}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invited Users List */}
      <div className="px-4 mb-4">
        <h3 className="font-semibold text-gray-900 mb-3">我的邀请</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : invitedUsers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <UserPlusIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">还没有邀请任何好友</p>
            <p className="text-sm text-gray-400 mt-2">分享您的邀请码开始赚取佣金</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitedUsers.map((invitedUser, index) => (
              <motion.div
                key={invitedUser.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                      {invitedUser.username.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">{invitedUser.username}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLevelBadge(invitedUser.level)}`}>
                          L{invitedUser.level}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{formatDateTime(invitedUser.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">已赚</p>
                    <p className="text-lg font-bold text-green-600">
                      +{formatCurrency(invitedUser.commission_earned)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                  <span className="text-gray-600">消费金额</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(invitedUser.total_spent)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
