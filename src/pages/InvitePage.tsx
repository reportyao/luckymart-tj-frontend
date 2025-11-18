import React, { useState, useEffect, useCallback } from 'react';
import { referralService, InviteStats, InvitedUser } from '../lib/supabase';
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

// 接口已在 src/lib/supabase.ts 中定义
const InvitePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [isActivating, setIsActivating] = useState(false);
  const inviteCode = user?.invite_code || 'LOADING...'; // 使用 invite_code 字段
  const inviteLink = `https://t.me/luckymart_bot?start=${inviteCode}`;

  const fetchInviteData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!user) return;

      // 使用抽象服务层获取数据
      const statsData = await referralService.getInviteStats();
      const invitedUsersData = await referralService.getInvitedUsers();

      setStats(statsData);
      setInvitedUsers(invitedUsersData);
    } catch (error) {
      console.error('Failed to fetch invite data:', error);
      toast.error(t('error.networkError'));
      setStats(null);
      setInvitedUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, t]);

  const handleShare = async () => {
    try {
      // 记录分享事件
      await referralService.logShareEvent('activation', 'telegram_group', { /* share details */ });
      toast.success(t('invite.shareSuccess'));
      // 重新获取数据以更新分享计数
      fetchInviteData();
    } catch (error) {
      toast.error(t('invite.shareFailed'));
    }
  };

  const handleActivateBonus = async () => {
    setIsActivating(true);
    try {
      const result = await referralService.activateFirstDepositBonus();
      if (result.success) {
        toast.success(t('invite.activationSuccess', { amount: result.bonus_amount }));
        fetchInviteData(); // 重新获取数据以更新状态
      } else {
        toast.error(t('invite.activationFailed'));
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsActivating(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInviteData();
    }
  }, [user, fetchInviteData]);

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
    const text = t('invite.shareText', { inviteCode, inviteLink });
    
    if (navigator.share) {
      navigator.share({
        title: t('invite.shareTitle'),
        text: text,
        url: inviteLink
      }).then(() => {
        // 假设分享成功后，调用记录分享事件的函数
        handleShare();
      }).catch(err => console.log('分享失败:', err));
    } else {
      copyInviteLink();
      handleShare(); // 如果不支持原生分享，复制链接后也记录一次
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



  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-3">
            <GiftIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('invite.inviteFriends')}</h1>
          <p className="text-white/90">{t("invite.subtitle")}</p>
        </div>

        {/* Invite Code Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <p className="text-white/80 text-sm mb-2 text-center">{t("invite.myInviteCode")}</p>
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
                  <span>{t("invite.copied")}</span>
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-5 h-5" />
                  <span>{t("invite.copyLink")}</span>
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

      {/* First Deposit Bonus Card (New) */}
      {stats && stats.first_deposit_bonus_status !== 'none' && (
        <div className="px-4 -mt-6 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-lg border-l-4 border-yellow-500">
            <h3 className="font-bold text-lg text-yellow-800 mb-2">{t('invite.firstDepositBonus')}</h3>
            <p className="text-sm text-gray-600 mb-3">
              {t('invite.bonusAmount', { amount: stats.first_deposit_bonus_amount })}
            </p>

            {stats.first_deposit_bonus_status === 'pending' && (
              <>
                <p className="text-xs text-red-500 mb-3">
                  {t('invite.activationDeadline', { date: formatDateTime(stats.first_deposit_bonus_expire_at) })}
                </p>
                <div className="space-y-2 mb-3">
                  <p className="font-medium text-gray-700">{t('invite.activationCondition')}</p>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">
                      {t('invite.shareCount', { count: stats.activation_share_count })}
                    </span>
                    <button
                      onClick={handleShare}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {t('invite.goShare')}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">
                      {t('invite.inviteCount', { count: stats.activation_invite_count })}
                    </span>
                    <span className="text-sm text-gray-500">{t('invite.inviteHint')}</span>
                  </div>
                </div>
                <button
                  onClick={handleActivateBonus}
                  disabled={isActivating}
                  className="w-full py-3 bg-green-500 text-white rounded-xl font-bold disabled:bg-green-300 transition-colors"
                >
                  {isActivating ? t('invite.activating') : t('invite.activateNow')}
                </button>
              </>
            )}

            {stats.first_deposit_bonus_status === 'activated' && (
              <p className="text-green-600 font-bold">{t('invite.activated')}</p>
            )}

            {stats.first_deposit_bonus_status === 'expired' && (
              <p className="text-red-600 font-bold">{t('invite.expired')}</p>
            )}
          </div>
        </div>
      )}

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
                  <p className="text-2xl font-bold text-gray-900">{stats.total_referrals}</p>
                  <p className="text-xs text-gray-500">{t('invite.totalInvited')}</p>
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
                    {formatCurrency('TJS', stats.total_commission)}
                  </p>
                  <p className="text-xs text-gray-500">{t('invite.totalCommission')}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{stats.level1_referrals}</p>
                  <p className="text-xs text-gray-500">{t('invite.level1Users')}</p>
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
                    {formatCurrency('TJS', stats.bonus_balance)}
                  </p>
                  <p className="text-xs text-gray-500">{t('invite.bonusBalance')}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Commission Rules (New Rates) */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">{t('invite.commissionRules')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold">
                  1
                </span>
                <div>
                  <p className="font-medium text-gray-900">{t('invite.level1')}</p>
                  <p className="text-xs text-gray-500">{t('invite.level1Desc')}</p>
                </div>
              </div>
              <span className="text-lg font-bold text-blue-600">3%</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">
                  2
                </span>
                <div>
                  <p className="font-medium text-gray-900">{t('invite.level2')}</p>
                  <p className="text-xs text-gray-500">{t('invite.level2Desc')}</p>
                </div>
              </div>
              <span className="text-lg font-bold text-purple-600">1%</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 bg-orange-600 text-white rounded-full text-sm font-bold">
                  3
                </span>
                <div>
                  <p className="font-medium text-gray-900">{t('invite.level3')}</p>
                  <p className="text-xs text-gray-500">{t('invite.level3Desc')}</p>
                </div>
              </div>
              <span className="text-lg font-bold text-orange-600">0.5%</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              💡 <strong>{t('invite.commissionNoteTitle')}:</strong> {t('invite.commissionNoteContent')}
            </p>
          </div>
        </div>
      </div>

      {/* Level Distribution */}
      {stats && stats.total_referrals > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{t('invite.levelDistribution')}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('invite.level1')}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(stats.level1_referrals / stats.total_referrals) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8">{stats.level1_referrals}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('invite.level2')}</span>
                <div className="flex items-center space-x-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full"
                      style={{ width: `${(stats.level2_referrals / stats.total_referrals) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8">{stats.level2_referrals}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('invite.level3')}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-600 rounded-full"
                      style={{ width: `${(stats.level3_referrals / stats.total_referrals) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8">{stats.level3_referrals}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invited Users List */}
      <div className="px-4 mb-4">
        <h3 className="font-semibold text-gray-900 mb-3">{t('invite.myInvitations')}</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : invitedUsers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <UserPlusIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('invite.noInvitations')}</p>
            <p className="text-sm text-gray-400 mt-2">{t('invite.shareToEarn')}</p>
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
                    <img
                      src={invitedUser.avatar_url || 'default-avatar.png'}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{invitedUser.username || t('invite.anonymousUser')}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelBadge(invitedUser.level)}`}>
                        {t('invite.levelXFriend', { level: invitedUser.level })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{t('invite.contributedCommission')}</p>
                    <p className="font-bold text-green-600">
                      {formatCurrency('TJS', invitedUser.commission_earned)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                  <span>{t('invite.registrationTime')}: {formatDateTime(invitedUser.created_at)}</span>
                  <span>{t('invite.totalConsumption')}: {formatCurrency('TJS', invitedUser.total_spent)}</span>
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
