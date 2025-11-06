import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  TrophyIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
  CalendarIcon,
  TicketIcon,
  UsersIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { VRFVerificationModal } from '../components/lottery/VRFVerificationModal';
import { formatCurrency, formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface LotteryResult {
  id: string;
  title: string;
  period: string;
  status: string;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  currency: string;
  draw_time: string;
  winning_numbers?: string;
  vrf_seed?: string;
  vrf_proof?: string;
  winners: {
    rank: number;
    user_name: string;
    numbers: string;
    prize_amount: number;
  }[];
  my_entries?: {
    numbers: string;
    is_winning: boolean;
    prize_rank?: number;
    prize_amount?: number;
  }[];
}

const LotteryResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [result, setResult] = useState<LotteryResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showVRFModal, setShowVRFModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLotteryResult(id);
    }
  }, [id]);

  const fetchLotteryResult = async (lotteryId: string) => {
    setIsLoading(true);
    try {
      // TODO: 调用实际API获取开奖结果
      // 这里使用mock数据
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockResult: LotteryResult = {
        id: lotteryId,
        title: 'iPhone 15 Pro Max 夺宝',
        period: 'TEST2025001',
        status: 'COMPLETED',
        ticket_price: 10,
        total_tickets: 100,
        sold_tickets: 100,
        currency: 'TJS',
        draw_time: new Date().toISOString(),
        winning_numbers: '001,015,042',
        vrf_seed: 'a7f3c9e2b8d4f1a6c5e9b2d8f4a1c7e3b9d5f2a8c4e1b7d3f9a5c2e8b4d1f6a3c9e5b2d8f4a1c7e3',
        vrf_proof: 'b2d8f4a1c7e3b9d5f2a8c4e1b7d3f9a5c2e8b4d1f6a3c9e5b2d8f4a1c7e3a7f3c9e2b8d4f1a6c5e9',
        winners: [
          {
            rank: 1,
            user_name: 'User***123',
            numbers: '001',
            prize_amount: 500
          },
          {
            rank: 2,
            user_name: 'User***456',
            numbers: '015',
            prize_amount: 250
          },
          {
            rank: 3,
            user_name: 'User***789',
            numbers: '042',
            prize_amount: 150
          }
        ],
        my_entries: [
          {
            numbers: '001',
            is_winning: true,
            prize_rank: 1,
            prize_amount: 500
          },
          {
            numbers: '023',
            is_winning: false
          }
        ]
      };

      setResult(mockResult);
    } catch (error) {
      console.error('Failed to fetch lottery result:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const getRankColor = (rank: number): string => {
    switch (rank) {
      case 1:
        return 'from-yellow-400 to-orange-500';
      case 2:
        return 'from-gray-300 to-gray-400';
      case 3:
        return 'from-orange-400 to-orange-600';
      default:
        return 'from-blue-400 to-blue-600';
    }
  };

  const getRankLabel = (rank: number): string => {
    return `${rank}等奖`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">未找到开奖结果</p>
          <button
            onClick={() => navigate('/lottery')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            返回夺宝大厅
          </button>
        </div>
      </div>
    );
  }

  const myWinningEntry = result.my_entries?.find(e => e.is_winning);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 mb-4 text-white/90 hover:text-white"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>返回</span>
        </button>

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-3">
            <TrophyIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-1">{result.title}</h1>
          <p className="text-white/80">期号: {result.period}</p>
        </div>
      </div>

      {/* My Result (if participated) */}
      {result.my_entries && result.my_entries.length > 0 && (
        <div className="px-4 -mt-6 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-6 ${
              myWinningEntry
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                : 'bg-white border-2 border-gray-200'
            }`}
          >
            {myWinningEntry ? (
              <div className="text-center">
                <TrophyIcon className="w-12 h-12 text-white mx-auto mb-3" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  🎉 恭喜中奖! 🎉
                </h2>
                <p className="text-white/90 mb-4">
                  您获得了 {getRankLabel(myWinningEntry.prize_rank!)}
                </p>
                <div className="bg-white/20 rounded-xl p-4 backdrop-blur-sm">
                  <p className="text-white/80 text-sm mb-1">中奖号码</p>
                  <p className="text-3xl font-bold text-white mb-3">{myWinningEntry.numbers}</p>
                  <p className="text-white/80 text-sm mb-1">奖金金额</p>
                  <p className="text-4xl font-bold text-white">
                    {formatCurrency(myWinningEntry.prize_amount!, result.currency)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 mb-3">很遗憾,本期未中奖</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {result.my_entries.map((entry, index) => (
                    <span
                      key={index}
                      className="px-4 py-2 bg-gray-100 rounded-lg font-medium text-gray-700"
                    >
                      {entry.numbers}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-3">继续努力,下次好运!</p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Lottery Info */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-600">
              <CalendarIcon className="w-5 h-5" />
              <span className="text-sm">开奖时间</span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {formatDateTime(result.draw_time)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-600">
              <TicketIcon className="w-5 h-5" />
              <span className="text-sm">票价</span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(result.ticket_price, result.currency)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-600">
              <UsersIcon className="w-5 h-5" />
              <span className="text-sm">参与人数</span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {result.sold_tickets} / {result.total_tickets}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-600">
              <BanknotesIcon className="w-5 h-5" />
              <span className="text-sm">奖金池</span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(result.ticket_price * result.sold_tickets * 0.8, result.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Winning Numbers */}
      <div className="px-4 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">中奖号码</h2>
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-6">
          <div className="flex flex-wrap justify-center gap-3">
            {result.winning_numbers?.split(',').map((number, index) => (
              <div
                key={index}
                className="w-16 h-16 bg-white rounded-xl shadow-md flex items-center justify-center"
              >
                <span className="text-2xl font-bold text-orange-600">{number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Winners List */}
      <div className="px-4 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">中奖名单</h2>
        <div className="space-y-3">
          {result.winners.map((winner, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${getRankColor(winner.rank)} rounded-lg flex items-center justify-center`}>
                    <span className="text-white font-bold">{winner.rank}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{winner.user_name}</p>
                    <p className="text-sm text-gray-500">号码: {winner.numbers}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{getRankLabel(winner.rank)}</p>
                  <p className="text-lg font-bold text-green-600">
                    +{formatCurrency(winner.prize_amount, result.currency)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* VRF Verification */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setShowVRFModal(true)}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl p-4 flex items-center justify-center space-x-2 transition-all shadow-lg"
        >
          <ShieldCheckIcon className="w-6 h-6" />
          <span className="font-semibold">查看VRF验证信息</span>
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          点击查看可验证随机函数证明,确保开奖公平公正
        </p>
      </div>

      {/* VRF Modal */}
      <VRFVerificationModal
        isOpen={showVRFModal}
        onClose={() => setShowVRFModal(false)}
        lotteryData={{
          id: result.id,
          title: result.title,
          draw_time: result.draw_time,
          winning_numbers: result.winning_numbers,
          vrf_seed: result.vrf_seed,
          vrf_proof: result.vrf_proof,
          total_entries: result.sold_tickets
        }}
      />
    </div>
  );
};

export default LotteryResultPage;
