import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import {
  TicketIcon,
  TrophyIcon,
  ClockIcon,
  ArrowLeftIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { LazyImage } from '../components/LazyImage';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface Ticket {
  id: string;
  winning_code: string;
  purchase_time: string;
  is_winning: boolean;
}

interface LotteryInfo {
  id: string;
  period: string;
  title: string;
  image_url: string;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  status: string;
  winning_code?: string;
  winner_id?: string;
}

const MyTicketsPage: React.FC = () => {

  const params = useParams();
  const navigate = useNavigate();
  const lotteryId = params.id;

  const [lottery, setLottery] = useState<LotteryInfo | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: 调用实际API
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模拟数据
      const mockLottery: LotteryInfo = {
        id: lotteryId || '1',
        period: '20250107001',
        title: 'iPhone 15 Pro Max 256GB',
        image_url: 'https://images.unsplash.com/photo-1696446702183-cbd0674e0c99?w=400',
        ticket_price: 10,
        total_tickets: 100,
        sold_tickets: 100,
        status: 'COMPLETED',
        winning_code: 'LM-20250107001-00045',
        winner_id: 'user123'
      };

      const mockTickets: Ticket[] = [
        {
          id: '1',
          winning_code: 'LM-20250107001-00012',
          purchase_time: new Date().toISOString(),
          is_winning: false
        },
        {
          id: '2',
          winning_code: 'LM-20250107001-00045',
          purchase_time: new Date().toISOString(),
          is_winning: true
        },
        {
          id: '3',
          winning_code: 'LM-20250107001-00078',
          purchase_time: new Date().toISOString(),
          is_winning: false
        }
      ];

      setLottery(mockLottery);
      setTickets(mockTickets);
    } catch (error) {
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [lotteryId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('中奖码已复制');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">夺宝不存在</p>
      </div>
    );
  }

  const hasWinning = tickets.some(t => t.is_winning);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 头部 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center space-x-4">
          <button
            onClick={() => navigate(`/lottery/${lotteryId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex-1">我的中奖码</h1>
          <TicketIcon className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 夺宝信息卡片 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex space-x-4">
            <LazyImage
              src={lottery.image_url}
              alt={lottery.title}
              className="w-24 h-24 rounded-xl object-cover"
              width={96}
              height={96}
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
                <span>期号: {lottery.period}</span>
              </div>
              <h2 className="text-lg font-bold mb-2">{lottery.title}</h2>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-gray-600">
                  票价: <span className="font-semibold text-blue-600">TJS{lottery.ticket_price.toFixed(2)}</span>
                </span>
                <span className="text-gray-600">
                  进度: <span className="font-semibold">{lottery.sold_tickets}/{lottery.total_tickets}</span>
                </span>
              </div>
            </div>
          </div>

          {lottery.status === 'COMPLETED' && lottery.winning_code && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <TrophyIcon className="w-6 h-6 text-yellow-600" />
                  <div>
                    <p className="text-xs text-gray-600">中奖码</p>
                    <p className="text-lg font-bold text-yellow-700">{lottery.winning_code}</p>
                  </div>
                </div>
                {hasWinning && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircleIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">恭喜中奖!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{tickets.length}</p>
            <p className="text-sm text-gray-600 mt-1">我的中奖码</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{tickets.filter(t => t.is_winning).length}</p>
            <p className="text-sm text-gray-600 mt-1">中奖数量</p>
          </div>
        </div>

        {/* 中奖码列表 */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold px-2">中奖码列表</h3>
          {tickets.map((ticket, index) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-xl p-4 shadow-sm ${
                ticket.is_winning ? 'ring-2 ring-yellow-400' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <TicketIcon className={`w-5 h-5 ${ticket.is_winning ? 'text-yellow-600' : 'text-gray-400'}`} />
                    <span className={`text-lg font-mono font-bold ${
                      ticket.is_winning ? 'text-yellow-700' : 'text-gray-900'
                    }`}>
                      {ticket.winning_code}
                    </span>
                    {ticket.is_winning && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                        中奖
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <ClockIcon className="w-4 h-4" />
                    <span>{formatDateTime(ticket.purchase_time)}</span>
                  </div>
                </div>
                <button
                  onClick={() => copyCode(ticket.winning_code)}
                  className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  复制
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {tickets.length === 0 && (
          <div className="text-center py-12">
            <TicketIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">您还没有购买此夺宝的彩票</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTicketsPage;
