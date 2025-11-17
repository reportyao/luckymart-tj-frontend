import React, { useState, useEffect, useCallback } from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  ArrowLeftIcon,
  TicketIcon,
  ClockIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface MyTicket {
  id: string;
  lottery_id: string;
  lottery_title: string;
  lottery_image: string;
  ticket_numbers: string;
  purchase_price: number;
  currency: string;
  draw_time: string;
  status: 'ACTIVE' | 'DRAWN';
}

const MarketCreatePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [myTickets, setMyTickets] = useState<MyTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  const fetchMyTickets = useCallback(async () => {
    setIsLoadingTickets(true);
    try {
      // 调用API获取我的奖品(可转售的)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-prizes`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '获取奖品列表失败');
      }

      // 过滤出可以转售的奖品(PENDING或REJECTED状态)
      const resellablePrizes = result.data.filter((prize: any) => 
        prize.status === 'PENDING' || prize.status === 'REJECTED'
      );

      // 转换数据格式
      const formattedTickets: MyTicket[] = resellablePrizes.map((prize: any) => ({
        id: prize.id,
        lottery_id: prize.lottery_id,
        lottery_title: prize.lotteries?.title || '未知商品',
        lottery_image: prize.lotteries?.image_url || '',
        ticket_numbers: prize.ticket_numbers || '',
        purchase_price: prize.lotteries?.ticket_price || 0,
        currency: 'TJS',
        draw_time: prize.lotteries?.end_time || new Date().toISOString(),
        status: 'ACTIVE',
      }));

      setMyTickets(formattedTickets);
    } catch (error: any) {
      console.error('获取奖品列表失败:', error);
      toast.error(error.message || t('error.networkError'));
      // 如果API失败，使用mock数据
      await new Promise(resolve => setTimeout(resolve, 500));

      const mockTickets: MyTicket[] = [
        {
          id: '1',
          lottery_id: 'lottery1',
          lottery_title: 'iPhone 15 Pro Max 夺宝',
          lottery_image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400',
          ticket_numbers: '023,024,025',
          purchase_price: 30,
          currency: 'TJS',
          draw_time: new Date(Date.now() + 7200000).toISOString(),
          status: 'ACTIVE'
        },
        {
          id: '2',
          lottery_id: 'lottery2',
          lottery_title: 'MacBook Pro 夺宝',
          lottery_image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
          ticket_numbers: '045,046',
          purchase_price: 20,
          currency: 'TJS',
          draw_time: new Date(Date.now() + 14400000).toISOString(),
          status: 'ACTIVE'
        }
      ];

      setMyTickets(mockTickets);
    } finally {
      setIsLoadingTickets(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMyTickets();
  }, [fetchMyTickets]);

  const selectedTicketData = myTickets.find(t => t.id === selectedTicket);

  const calculateDiscount = () => {
    if (!selectedTicketData || !sellingPrice) return 0;
    const price = parseFloat(sellingPrice);
    if (isNaN(price) || price >= selectedTicketData.purchase_price) return 0;
    return Math.round(((selectedTicketData.purchase_price - price) / selectedTicketData.purchase_price) * 100);
  };

  const calculateProfit = () => {
    if (!selectedTicketData || !sellingPrice) return 0;
    const price = parseFloat(sellingPrice);
    if (isNaN(price)) return 0;
    return price - selectedTicketData.purchase_price;
  };

  const handleSubmit = async () => {
    if (!selectedTicket) {
      toast.error('请选择要出售的彩票');
      return;
    }

    if (!sellingPrice || parseFloat(sellingPrice) <= 0) {
      toast.error('请输入有效的售价');
      return;
    }

    const price = parseFloat(sellingPrice);
    if (!selectedTicketData) return;

    if (price > selectedTicketData.purchase_price * 1.5) {
      toast.error('售价不能超过原价的150%');
      return;
    }

    if (price < selectedTicketData.purchase_price * 0.5) {
      toast.error('售价不能低于原价的50%');
      return;
    }

    setIsLoading(true);
    try {
      // 调用API创建转售
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-resale`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prizeId: selectedTicket,
            price: parseFloat(sellingPrice),
            description: `转售 ${selectedTicketData?.lottery_title}`,
          }),
        }
      );

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '发布转售失败');
      }

      toast.success('转售信息发布成功');
      navigate('/market');
    } catch (error) {
      console.error('Failed to create listing:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const discount = calculateDiscount();
  const profit = calculateProfit();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>返回</span>
          </button>
          <h1 className="text-lg font-bold text-gray-900">出售彩票</h1>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !selectedTicket || !sellingPrice}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '发布中...' : '发布'}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Select Ticket */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">选择要出售的彩票</h3>
          {isLoadingTickets ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : myTickets.length === 0 ? (
            <div className="text-center py-8">
              <TicketIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">暂无可出售的彩票</p>
              <p className="text-sm text-gray-400 mt-1">购买彩票后即可在此出售</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket.id)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                    selectedTicket === ticket.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={ticket.lottery_image}
                    alt={ticket.lottery_title}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">{ticket.lottery_title}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <TicketIcon className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-600">号码: {ticket.ticket_numbers}</span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <BanknotesIcon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-500">
                        原价: {formatCurrency(ticket.currency, ticket.purchase_price)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <ClockIcon className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-orange-600">
                        {formatDateTime(ticket.draw_time)}
                      </span>
                    </div>
                  </div>
                  {selectedTicket === ticket.id && (
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Set Price */}
        {selectedTicketData && (
          <div


            className="bg-white rounded-xl p-4"
          >
            <h3 className="font-semibold text-gray-900 mb-3">设置售价</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                售价 ({selectedTicketData.currency})
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="请输入售价"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  step="0.01"
                  min="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * 售价范围: {formatCurrency(selectedTicketData.currency, selectedTicketData.purchase_price * 0.5)} - {formatCurrency(selectedTicketData.currency, selectedTicketData.purchase_price * 1.5)}
              </p>
            </div>

            {/* Quick Price Options */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">快速选择</p>
              <div className="grid grid-cols-4 gap-2">
                {[0.7, 0.8, 0.9, 1.0].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setSellingPrice((selectedTicketData.purchase_price * ratio).toFixed(2))}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    {ratio === 1.0 ? '原价' : `${Math.round(ratio * 100)}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Analysis */}
            {sellingPrice && parseFloat(sellingPrice) > 0 && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">原价</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(selectedTicketData.currency, selectedTicketData.purchase_price)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">售价</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(selectedTicketData.currency, parseFloat(sellingPrice))}
                  </span>
                </div>

                {discount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">折扣</span>
                    <span className="text-sm font-bold text-red-600">-{discount}%</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-sm text-gray-600">
                    {profit >= 0 ? '盈利' : '亏损'}
                  </span>
                  <span className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {profit >= 0 ? '+' : ''}{formatCurrency(selectedTicketData.currency, Math.abs(profit))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h4 className="font-medium text-yellow-900 mb-2">💡 出售须知</h4>
          <ul className="space-y-1 text-sm text-yellow-800">
            <li>• 彩票一旦售出,号码归属权将转移给买家</li>
            <li>• 开奖前可随时取消转售</li>
            <li>• 建议合理定价,提高成交率</li>
            <li>• 平台不收取转售手续费</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MarketCreatePage;
