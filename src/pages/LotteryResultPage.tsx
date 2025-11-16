
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  TrophyIcon,
  ArrowLeftIcon,
  CalendarIcon,
  TicketIcon,
  UsersIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';
import { useSupabase } from '@/contexts/SupabaseContext';
import FairnessExplanation from '@/components/lottery/FairnessExplanation';
import { Database } from '@/types/supabase';

type LotteryRound = Database['public']['Tables']['lottery_rounds']['Row'];
type LotteryEntry = Database['public']['Tables']['lottery_entries']['Row'];

interface Winner extends LotteryEntry {
  profiles: {
    username: string;
    avatar_url: string;
  } | null;
}

interface LotteryResult extends LotteryRound {
  winners: Winner[];
  my_entries: LotteryEntry[];
  timestamp_sum: string;
}

const LotteryResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { lotteryService } = useSupabase();
  const [result, setResult] = useState<LotteryResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLotteryResult = useCallback(async (lotteryId: string) => {
    if (!lotteryService) return;
    setIsLoading(true);
    try {
      const data = await lotteryService.getLotteryResult(lotteryId);
      setResult(data as any);
    } catch (error: any) {
      console.error('Failed to fetch lottery result:', error);
      toast.error(error.message || t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  }, [lotteryService, t]);

  useEffect(() => {
    if (id) {
      fetchLotteryResult(id as string);
    }
  }, [id, fetchLotteryResult]);

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
          <p className="text-gray-500 mb-4">{t('lottery.drawResultNotFound')}</p>
          <button
            onClick={() => navigate('/lottery')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            {t('lottery.backToHall')}
          </button>
        </div>
      </div>
    );
  }

  const myWinningEntry = result.my_entries?.find(e => e.id === result.winner_entry_id);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 mb-4 text-white/90 hover:text-white"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>{t('common.back')}</span>
        </button>

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-3">
            <TrophyIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-1">{result.product_name}</h1>
          <p className="text-white/80">{t('lottery.period')}: {result.id}</p>
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
              <div className="text-center text-white">
                <h2 className="text-2xl font-bold">{t('lottery.congratulations')}</h2>
                <p className="mt-1">{t('lottery.youWon')}</p>
                <div className="mt-4 text-4xl font-bold">{formatCurrency(result.prize_amount || 0, result.currency)}</div>
              </div>
            ) : (
              <div className="text-center text-gray-700">
                <h2 className="text-xl font-bold">{t('lottery.notWinning')}</h2>
                <p className="mt-1 text-gray-500">{t('lottery.betterLuckNextTime')}</p>
                <p className="mt-3 font-semibold">{t('lottery.myNumbers')}:</p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {result.my_entries.flatMap(e => e.lottery_numbers).map((num, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 rounded-md text-sm">{num}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Winner Info */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">{t('lottery.drawResult')}</h2>
          {result.winners.map((winner, index) => (
            <div key={index} className="text-center border-t pt-4 mt-4 first:mt-0 first:border-t-0">
              <p className="text-sm text-gray-500">{t('lottery.luckyNumber')}</p>
              <p className="text-4xl font-bold text-blue-600 my-2">{result.lucky_number}</p>
              <p className="text-sm text-gray-500">{t('lottery.winner')}</p>
              <div className="flex items-center justify-center space-x-2 mt-2">
                <img src={winner.profiles?.avatar_url || '/avatar-placeholder.png'} alt="winner avatar" className="w-8 h-8 rounded-full" />
                <span className="font-semibold text-gray-800">{winner.profiles?.username || 'Anonymous'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lottery Details */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-6 grid grid-cols-2 gap-4 text-center">
          <div className="flex flex-col items-center">
            <CalendarIcon className="w-6 h-6 text-gray-500 mb-1" />
            <p className="text-sm text-gray-500">{t('lottery.drawTime')}</p>
            <p className="font-semibold">{formatDateTime(result.draw_time || '')}</p>
          </div>
          <div className="flex flex-col items-center">
            <TicketIcon className="w-6 h-6 text-gray-500 mb-1" />
            <p className="text-sm text-gray-500">{t('lottery.totalTickets')}</p>
            <p className="font-semibold">{result.total_numbers}</p>
          </div>
          <div className="flex flex-col items-center">
            <UsersIcon className="w-6 h-6 text-gray-500 mb-1" />
            <p className="text-sm text-gray-500">{t('lottery.participants')}</p>
            <p className="font-semibold">{result.participant_count}</p>
          </div>
          <div className="flex flex-col items-center">
            <BanknotesIcon className="w-6 h-6 text-gray-500 mb-1" />
            <p className="text-sm text-gray-500">{t('lottery.ticketPrice')}</p>
            <p className="font-semibold">{formatCurrency(result.price_per_share || 0, result.currency)}</p>
          </div>
        </div>
      </div>

      {/* Fairness Explanation */}
      <div className="px-4">
        <FairnessExplanation 
          timestampSum={result.timestamp_sum}
          totalShares={result.total_numbers || 0}
          drawTime={result.draw_time || ''}
        />
      </div>
    </div>
  );
};

export default LotteryResultPage;
