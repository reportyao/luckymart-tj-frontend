import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  TrophyIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  TicketIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { formatDateTime, getLocalizedText } from '../lib/utils';
import toast from 'react-hot-toast';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useUser } from '@/contexts/UserContext';
import { Tables } from '@/types/supabase';
import { CountdownTimer } from '../components/CountdownTimer';
import { lotteryService } from '@/lib/supabase';

type Lottery = Tables<'lotteries'>;
type Ticket = Tables<'tickets'>;
type User = Tables<'users'>;

interface ParticipantWithTickets {
  user: User;
  tickets: number[];
  ticketCount: number;
}

// 转换为塔吉克斯坦时区 (UTC+5)
function toTajikistanTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  // 塔吉克斯坦时区是 UTC+5
  // JavaScript 的 Date 对象会自动处理本地时区，我们需要将其转换为 UTC，然后加上 5 小时
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const tajikTime = new Date(utcTime + (5 * 60 * 60 * 1000));
  
  const year = tajikTime.getFullYear();
  const month = String(tajikTime.getMonth() + 1).padStart(2, '0');
  const day = String(tajikTime.getDate()).padStart(2, '0');
  const hours = String(tajikTime.getHours()).padStart(2, '0');
  const minutes = String(tajikTime.getMinutes()).padStart(2, '0');
  const seconds = String(tajikTime.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const LotteryResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { supabase } = useSupabase();
  const { user: currentUser } = useUser();
  
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [participants, setParticipants] = useState<ParticipantWithTickets[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);

  // 获取夺宝信息
  const fetchLottery = useCallback(async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('lotteries')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setLottery(data);
    } catch (error: any) {
      console.error('Failed to fetch lottery:', error);
      toast.error(t('error.networkError'));
    }
  }, [id, supabase, t]);

  // 获取所有票据和参与用户 (支持 tickets 表和 lottery_entries 表)
  const fetchTicketsAndParticipants = useCallback(async () => {
    if (!id) return;

    try {
      // 从 lottery_entries 表获取参与记录（统一使用此表）
      const { data: entriesData, error: entriesError } = await supabase
        .from('lottery_entries')
        .select('*')
        .eq('lottery_id', id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: true });

      if (entriesError) throw entriesError;

      // 转换为统一格式
      const combinedTickets = (entriesData || []).map(e => {
        // 解析 numbers 字段（可能是jsonb字符串或数字）
        let ticketNumber: number;
        if (typeof e.numbers === 'string') {
          // 如果是带引号的字符串，去掉引号
          ticketNumber = parseInt(e.numbers.replace(/"/g, '')) || 0;
        } else {
          ticketNumber = Number(e.numbers) || 0;
        }
        
        return {
          id: e.id,
          user_id: e.user_id,
          lottery_id: e.lottery_id,
          ticket_number: ticketNumber, // 7位数参与码
          is_winning: e.is_winning,
          created_at: e.created_at
        };
      });

      console.log('[LotteryResult] Found entries:', combinedTickets.length);
      setTickets(combinedTickets as any || []);

      // 获取所有参与用户
      const userIds = [...new Set(combinedTickets?.map(t => t.user_id) || [])];
      
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('*')
          .in('id', userIds);

        if (usersError) throw usersError;

        // 组织参与者数据
        const participantsMap: { [key: string]: ParticipantWithTickets } = {};
        
        combinedTickets?.forEach(ticket => {
          const user = usersData?.find(u => u.id === ticket.user_id);
          if (!user) return;

          if (!participantsMap[user.id]) {
            participantsMap[user.id] = {
              user,
              tickets: [],
              ticketCount: 0
            };
          }

          participantsMap[user.id].tickets.push(ticket.ticket_number);
          participantsMap[user.id].ticketCount++;
        });

        setParticipants(Object.values(participantsMap));
      }
    } catch (error: any) {
      console.error('Failed to fetch tickets:', error);
    }
  }, [id, supabase]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchLottery(), fetchTicketsAndParticipants()]);
      setIsLoading(false);
    };

    loadData();
  }, [fetchLottery, fetchTicketsAndParticipants]);

  // 倒计时结束后执行开奖
  const handleDrawLottery = async () => {
    if (!id) return;

    setIsDrawing(true);
    try {
      console.log('开始开奖:', id);
      // 调用 Edge Function 进行开奖，而不是直接调用 RPC
      const { data, error } = await supabase.functions.invoke('auto-lottery-draw', {
        body: { lotteryId: id }
      });
      
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Draw failed');
      }
      
      console.log('Draw successful:', data);
      
      // 刷新数据
      await fetchLottery();
      toast.success(t('lottery.drawSuccess'));
    } catch (error: any) {
      console.error('Draw failed:', error);
      toast.error(t('lottery.drawFailed'));
      
      // 即使失败也刷新，可能已经开奖了
      await fetchLottery();
    } finally {
      setIsDrawing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}...</p>
        </div>
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{t('lottery.notFound')}</p>
          <button
            onClick={() => navigate('/lottery')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('lottery.backToHall')}
          </button>
        </div>
      </div>
    );
  }

  const isSoldOut = lottery.status === 'SOLD_OUT';
  const isCompleted = lottery.status === 'COMPLETED';
  // 获取中奖号码 - 优先使用 winning_numbers 数组中的7位数开奖码
  const winningTicketNumber = lottery.winning_numbers?.[0] 
    ? (typeof lottery.winning_numbers[0] === 'string' 
        ? parseInt(lottery.winning_numbers[0]) 
        : lottery.winning_numbers[0])
    : lottery.winning_ticket_number;
  const winningTicket = tickets.find(t => t.ticket_number === winningTicketNumber);
  const winningUser = participants.find(p => p.user.id === lottery.winning_user_id);
  const isCurrentUserWinner = currentUser?.id === lottery.winning_user_id;
  const myTickets = tickets.filter(t => t.user_id === currentUser?.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/lottery')}
            className="p-2 hover:bg-white/20 rounded-full transition"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <SparklesIcon className="w-6 h-6" />
            {isCompleted ? t('lottery.drawResult') : t('lottery.drawingPage')}
          </h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 夺宝信息卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <div className="flex items-start gap-4">
            <img
              src={lottery.image_url || '/placeholder.png'}
              alt={getLocalizedText(lottery.title_i18n, 'zh')}
              className="w-24 h-24 object-cover rounded-xl"
            />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {getLocalizedText(lottery.title_i18n, 'zh')}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <TicketIcon className="w-4 h-4" />
                  {t('lottery.period')}: {lottery.period}
                </span>
                <span className="flex items-center gap-1">
                  <UserGroupIcon className="w-4 h-4" />
                  {participants.length} {t('lottery.participants')}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 开奖倒计时 */}
        {isSoldOut && lottery.draw_time && !isCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-2xl shadow-lg p-8 text-center text-white"
          >
            <SparklesIcon className="w-16 h-16 mx-auto mb-4 animate-pulse" />
            <h3 className="text-2xl font-bold mb-4">{t('lottery.drawingCountdown')}</h3>
            <CountdownTimer
              drawTime={lottery.draw_time}
              onCountdownEnd={handleDrawLottery}
            />
            {isDrawing && (
              <p className="mt-4 text-sm animate-pulse">{t('lottery.drawing')}...</p>
            )}
          </motion.div>
        )}

        {/* 开奖结果 */}
        {isCompleted && winningTicketNumber && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl shadow-lg p-8 text-center ${
              isCurrentUserWinner
                ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 text-white'
                : 'bg-white'
            }`}
          >
            {isCurrentUserWinner ? (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.6 }}
                >
                  <CheckCircleIcon className="w-24 h-24 mx-auto mb-4" />
                </motion.div>
                <p className="text-xl mb-6">{t('lottery.itemIsYours')}</p>
              </>
            ) : (
              <>
                <XCircleIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('lottery.notThisTime')}</h2>
                <p className="text-gray-600 mb-6">{t('lottery.nextTimeForSure')}</p>
              </>
            )}

            <div className="bg-white/20 backdrop-blur rounded-xl p-6 mb-4">
              <p className={`text-sm mb-2 ${isCurrentUserWinner ? 'text-white/80' : 'text-gray-600'}`}>
                {t('lottery.winningNumber')}
              </p>
              <div className="text-5xl font-bold mb-4">
                #{String(winningTicketNumber).padStart(7, '0')}
              </div>
              {winningUser && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <img
                    src={winningUser.user.avatar_url || '/default-avatar.png'}
                    alt={winningUser.user.telegram_username || 'Winner'}
                    className="w-12 h-12 rounded-full border-4 border-white"
                  />
                  <div className={`text-left ${isCurrentUserWinner ? 'text-white' : 'text-gray-900'}`}>
                    <p className="font-semibold">
                      {winningUser.user.telegram_username || winningUser.user.telegram_id}
                    </p>
                    <p className={`text-sm ${isCurrentUserWinner ? 'text-white/70' : 'text-gray-600'}`}>
                      {t('lottery.winner')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {lottery.draw_time && (
              <p className={`text-sm ${isCurrentUserWinner ? 'text-white/70' : 'text-gray-500'}`}>
                {t('lottery.drawTime')}: {toTajikistanTime(lottery.draw_time)} (UTC+5)
              </p>
            )}
          </motion.div>
        )}

        {/* 参与用户 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5" />
            {t('lottery.allParticipants')} ({participants.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {participants.map((participant) => (
              <div
                key={participant.user.id}
                className={`flex flex-col items-center p-2 rounded-lg transition ${
                  participant.user.id === lottery.winning_user_id
                    ? 'bg-gradient-to-br from-yellow-100 to-orange-100 ring-2 ring-yellow-400'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="relative">
                  <img
                    src={participant.user.avatar_url || '/default-avatar.png'}
                    alt={participant.user.telegram_username || 'User'}
                    className="w-10 h-10 rounded-full mb-1"
                  />
                  {participant.user.id === lottery.winning_user_id && (
                    <TrophyIcon className="w-6 h-6 text-yellow-500 absolute -top-1 -right-1 bg-white rounded-full p-1" />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 text-center truncate w-full">
                  {participant.user.telegram_username || participant.user.telegram_id}
                </p>
                <p className="text-xs text-gray-500">
                  {participant.ticketCount} {t('lottery.tickets')}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 所有参与码 - 移除外框，直接显示号码 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TicketIcon className="w-5 h-5" />
            {t('lottery.allTickets')} ({tickets.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {tickets.map((ticket) => {
              const isWinning = ticket.ticket_number === winningTicketNumber;
              const isMine = ticket.user_id === currentUser?.id;
              
              return (
                <span
                  key={ticket.id}
                  className={`
                    px-3 py-1 rounded-lg font-mono text-sm font-semibold
                    ${isWinning
                      ? 'bg-gradient-to-br from-yellow-400 to-orange-400 text-white ring-2 ring-yellow-300'
                      : isMine
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                    }
                  `}
                >
                  {String(ticket.ticket_number).padStart(7, '0')}
                </span>
              );
            })}
          </div>
        </motion.div>

        {/* 算法说明 & 验证数据 */}
        {isCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                {t('lottery.fairnessTitle')}
              </h3>
              
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <span className="text-blue-600 mr-2">📊</span>
                  {t('lottery.algorithmIntro')}
                </h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                  {t('lottery.algorithmDescription')}
                </p>
              </div>

              {/* 验证数据 */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-300">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="text-gray-600 mr-2">🔍</span>
                  {t('lottery.verificationData')}
                </h4>
                <div className="space-y-2 font-mono text-sm">
                  {(() => {
                    try {
                      let algorithmData: any = lottery.draw_algorithm_data;
                      if (typeof algorithmData === 'string') {
                        try {
                          algorithmData = JSON.parse(algorithmData);
                        } catch (e) {
                          console.error('Failed to parse algorithm data:', e);
                        }
                      }
                      
                      console.log('[LotteryResult] Algorithm data:', algorithmData);
                      
                      // 如果没有算法数据，显示不可用
                      if (!algorithmData) {
                        return (
                          <p className="text-gray-500 text-center py-2">
                            {t('lottery.verificationDataUnavailable')}
                          </p>
                        );
                      }
                      
                      const timestampSum = algorithmData.timestamp_sum || '0';
                      const totalEntries = algorithmData.total_entries || 0;
                      const winningIndex = algorithmData.winning_index;
                      const formula = algorithmData.formula;
                      
                      return (
                        <>
                          <div className="flex justify-between py-1 border-b border-gray-200">
                            <span className="text-gray-500">总参与条目</span>
                            <span className="text-gray-900 font-bold">{totalEntries}</span>
                          </div>
                          <div className="flex flex-col py-1 border-b border-gray-200">
                            <span className="text-gray-500 mb-1">{t('lottery.timestampSum')}</span>
                            <span className="text-gray-900 break-all">{timestampSum}</span>
                          </div>
                          <div className="flex flex-col py-1">
                            <span className="text-gray-500 mb-1">验证公式</span>
                            <span className="text-blue-600 font-bold break-words">{formula}</span>
                          </div>
                        </>
                      );
                    } catch (e) {
                      console.error('Error rendering algorithm data:', e);
                      return (
                        <p className="text-gray-500 text-center py-2">
                          {t('lottery.verificationDataUnavailable')}
                        </p>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LotteryResultPage;
