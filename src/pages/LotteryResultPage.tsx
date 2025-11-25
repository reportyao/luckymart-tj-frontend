
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
import { formatCurrency, formatDateTime, getLocalizedText } from '../lib/utils';
import toast from 'react-hot-toast';
import { useSupabase } from '@/contexts/SupabaseContext';
import { FairnessExplanation } from '../components/FairnessExplanation';
import { Database } from '@/types/supabase';
import { Lottery } from '../lib/supabase';

type LotteryResultRow = Database['public']['Tables']['lottery_results']['Row'];
type TicketRow = Database['public']['Tables']['tickets']['Row'];

interface Winner extends TicketRow {
  profiles: {
    username: string;
    avatar_url: string;
  } | null;
}

interface LotteryResult extends LotteryResultRow {
  winning_number: number;
  draw_time: string;
  timestamp_sum: string;
  total_shares: number;
  winner: Winner;
  my_tickets: TicketRow[];
  lottery: Lottery;
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

  const myWinningTicket = result.my_tickets?.find(t => t.ticket_number === result.winning_number);

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
          <h1 className="text-2xl font-bold mb-1">{getLocalizedText(result.lottery.name_i18n as Record<string, string> | null, t('language')) || result.lottery.title}</h1>
          <p className="text-white/80">{t('lottery.period')}: {result.lottery.id}</p>
        </div>
      </div>

      {/* My Result (if participated) */}
      {result.my_tickets && result.my_tickets.length > 0 && (
        <div className="px-4 -mt-6 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-6 text-white ${
              myWinningTicket
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-xl'
                : 'bg-white border-2 border-gray-200'
            }`}
          >
            {myWinningTicket ? (
              <div className="text-center text-white">
                <h2 className="text-2xl font-bold">{t('lottery.congratulations')}</h2>
                <p className="mt-1">{t('lottery.youWon')}</p>
                <div className="mt-4 text-4xl font-bold">{formatCurrency('TJS', result.lottery.ticket_price * result.lottery.total_tickets)}</div>
              </div>
            ) : (
              <div className="text-center text-gray-700">
                <h2 className="text-xl font-bold">{t('lottery.notWinning')}</h2>
                <p className="mt-1 text-gray-500">{t('lottery.betterLuckNextTime')}</p>
                <p className="mt-3 font-semibold">{t('lottery.myTickets')}:</p>
                <div className="flex flex-wrap justify-center gap-2 mt-2 max-h-24 overflow-y-auto">
                 {result.my_tickets.map((ticket, i) => (
	                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-sm">{ticket.ticket_number}</span>
	                  ))}        </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Winner Info */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">{t('lottery.drawResult')}</h2>
	          {result.winner && (
	            <div className="text-center border-t pt-4 mt-4 first:mt-0 first:border-t-0">
	              <p className="text-sm text-gray-500">{t('lottery.winningNumber')}</p>
	              <p className="text-4xl font-bold text-blue-600 my-2">{result.winning_number}</p>
	              <p className="text-sm text-gray-500">{t('lottery.winner')}</p>
	              <div className="flex items-center justify-center space-x-2 mt-2">
	                <img src={result.winner.profiles?.avatar_url || '/avatar-placeholder.png'} alt="winner avatar" className="w-8 h-8 rounded-full" />
	                <span className="font-semibold text-gray-800">{result.winner.profiles?.telegram_username || 'Anonymous'}</span>
              </div>
            </div>
	          )}
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
	            <p className="font-semibold">{result.lottery.total_tickets}</p>
          </div>
          <div className="flex flex-col items-center">
            <UsersIcon className="w-6 h-6 text-gray-500 mb-1" />
	            <p className="text-sm text-gray-500">{t('lottery.participants')}</p>
	            <p className="font-semibold">{result.total_shares}</p>
          </div>
          <div className="flex flex-col items-center">
            <BanknotesIcon className="w-6 h-6 text-gray-500 mb-1" />
	            <p className="text-sm text-gray-500">{t('lottery.ticketPrice')}</p>
			            <p className="font-semibold">{formatCurrency('TJS', result.lottery.ticket_price || 0)}</p>
          </div>
        </div>
      </div>

      {/* Fairness Explanation */}
      <div className="px-4">
        <FairnessExplanation 
          timestampSum={(result.algorithm_data as any)?.timestamp_sum || '0'}
          totalTickets={(result.algorithm_data as any)?.total_tickets || result.lottery.total_tickets}
          winningNumber={result.winning_number}
          showVerificationData={true}
        />
      </div>
    </div>
  );
};

export default LotteryResultPage;
